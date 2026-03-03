require('dotenv').config();

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { OAuth2Client } = require('google-auth-library');
const { createWhatsAppService, normalizePhoneNumber } = require('./whatsapp');

const app = express();

function parsePositiveInt(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function parseTrustProxy(value, fallback) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();

  if (!normalized) return fallback;
  if (normalized === 'true') return 1;
  if (normalized === 'false') return 0;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function normalizeOrigin(origin) {
  return String(origin || '')
    .trim()
    .replace(/\/+$/, '');
}

const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PRODUCTION = NODE_ENV === 'production';
const PORT = parsePositiveInt(process.env.PORT, 3001);
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/rahman_restaurant';
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
const CORS_ORIGIN =
  process.env.CORS_ORIGIN ||
  'http://localhost:3000,http://127.0.0.1:3000,http://localhost:5500,http://127.0.0.1:5500';
const CORS_ALLOWLIST = CORS_ORIGIN.split(',')
  .map(origin => normalizeOrigin(origin))
  .filter(Boolean);
const TRUST_PROXY = parseTrustProxy(process.env.TRUST_PROXY, IS_PRODUCTION ? 1 : 0);
const API_RATE_LIMIT_WINDOW_MS = parsePositiveInt(process.env.API_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000);
const API_RATE_LIMIT_MAX = parsePositiveInt(process.env.API_RATE_LIMIT_MAX, IS_PRODUCTION ? 200 : 1000);
const DB_INIT_RETRY_MS = parsePositiveInt(process.env.DB_INIT_RETRY_MS, 10000);
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const RESERVATION_WHATSAPP_NUMBER = process.env.RESERVATION_WHATSAPP_NUMBER || '7858062571';
const WHATSAPP_PROVIDER = process.env.WHATSAPP_PROVIDER || 'none';
const WHATSAPP_DEFAULT_COUNTRY_CODE = process.env.WHATSAPP_DEFAULT_COUNTRY_CODE || '91';
const WHATSAPP_META_ACCESS_TOKEN = process.env.WHATSAPP_META_ACCESS_TOKEN || '';
const WHATSAPP_META_PHONE_NUMBER_ID = process.env.WHATSAPP_META_PHONE_NUMBER_ID || '';
const WHATSAPP_META_API_VERSION = process.env.WHATSAPP_META_API_VERSION || 'v20.0';
const WHATSAPP_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || '';
const WHATSAPP_META_APP_SECRET = process.env.WHATSAPP_META_APP_SECRET || '';
const WHATSAPP_TWILIO_ACCOUNT_SID = process.env.WHATSAPP_TWILIO_ACCOUNT_SID || '';
const WHATSAPP_TWILIO_AUTH_TOKEN = process.env.WHATSAPP_TWILIO_AUTH_TOKEN || '';
const WHATSAPP_TWILIO_FROM = process.env.WHATSAPP_TWILIO_FROM || '';
const WHATSAPP_RESERVATION_TEMPLATE_NAME = process.env.WHATSAPP_RESERVATION_TEMPLATE_NAME || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const SERVER_STARTED_AT_MS = Date.now();

const FRONTEND_ROOT_FROM_ENV = process.env.FRONTEND_ROOT ? path.resolve(process.env.FRONTEND_ROOT) : '';
const FRONTEND_ROOT_DEFAULT = path.resolve(__dirname, '..', 'frontend');
const APP_ROOT = fs.existsSync(FRONTEND_ROOT_FROM_ENV)
  ? FRONTEND_ROOT_FROM_ENV
  : fs.existsSync(FRONTEND_ROOT_DEFAULT)
    ? FRONTEND_ROOT_DEFAULT
    : path.join(__dirname);
const ASSETS_ROOT = path.join(APP_ROOT, 'assets');
const FALLBACK_IMAGE_RELATIVE_PATH = '/assets/images/misc/image-fallback.svg';
const FALLBACK_IMAGE_ABSOLUTE_PATH = path.join(ASSETS_ROOT, 'images', 'misc', 'image-fallback.svg');

if (IS_PRODUCTION && (!JWT_SECRET || JWT_SECRET === 'change-this-secret' || JWT_SECRET.length < 32)) {
  throw new Error('JWT_SECRET must be at least 32 characters and not use the default in production.');
}

if (!IS_PRODUCTION && (JWT_SECRET === 'change-this-secret' || JWT_SECRET.length < 16)) {
  console.warn('[security] Update JWT_SECRET in .env before production deployment.');
}

if (IS_PRODUCTION && CORS_ALLOWLIST.length === 0) {
  throw new Error('CORS_ORIGIN must include at least one allowed origin in production.');
}

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID || undefined);

app.disable('x-powered-by');
app.set('trust proxy', TRUST_PROXY);

const helmetDirectives = {
  defaultSrc: ["'self'"],
  baseUri: ["'self'"],
  frameAncestors: ["'none'"],
  objectSrc: ["'none'"],
  scriptSrc: ["'self'", "'unsafe-inline'", 'https:'],
  styleSrc: ["'self'", "'unsafe-inline'", 'https:'],
  imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
  fontSrc: ["'self'", 'data:', 'https:'],
  connectSrc: ["'self'", 'https:'],
  mediaSrc: ["'self'", 'blob:', 'https:'],
  formAction: ["'self'"],
  upgradeInsecureRequests: IS_PRODUCTION ? [] : null
};

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: helmetDirectives
    },
    crossOriginEmbedderPolicy: false,
    hsts: IS_PRODUCTION
      ? {
          maxAge: 15552000,
          includeSubDomains: true,
          preload: false
        }
      : false,
    referrerPolicy: { policy: 'no-referrer' }
  })
);

const corsOptions = {
  origin(origin, callback) {
    const normalizedOrigin = normalizeOrigin(origin);

    if (!origin) return callback(null, true);

    const isLoopbackOrigin =
      /^https?:\/\/localhost(:\d+)?$/i.test(normalizedOrigin) ||
      /^https?:\/\/127\.0\.0\.1(:\d+)?$/i.test(normalizedOrigin) ||
      /^https?:\/\/\[::1\](:\d+)?$/i.test(normalizedOrigin);

    if (isLoopbackOrigin) return callback(null, true);
    if (!IS_PRODUCTION) return callback(null, true);
    if (CORS_ALLOWLIST.includes(normalizedOrigin)) return callback(null, true);

    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Hub-Signature-256'],
  optionsSuccessStatus: 204,
  maxAge: IS_PRODUCTION ? 86400 : 0
};

app.use(cors(corsOptions));

app.use((error, req, res, next) => {
  if (error?.message === 'Not allowed by CORS') {
    return res.status(403).json({ message: 'Request origin is not allowed.' });
  }
  return next(error);
});

app.use(
  '/api',
  rateLimit({
    windowMs: API_RATE_LIMIT_WINDOW_MS,
    max: API_RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many requests, please try again later.' }
  })
);

app.use(
  express.json({
    limit: '1mb',
    verify(req, res, buf) {
      req.rawBody = buf?.toString('utf8') || '';
    }
  })
);
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

app.use(
  '/assets',
  express.static(ASSETS_ROOT, {
    fallthrough: true,
    etag: true,
    maxAge: IS_PRODUCTION ? '7d' : 0,
    immutable: IS_PRODUCTION
  })
);

app.use('/assets/images', (req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();

  const requestPath = decodeURIComponent(req.path || '');
  const extension = path.extname(requestPath).toLowerCase();
  const imageExtensions = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.avif', '.bmp', '.ico']);
  if (!imageExtensions.has(extension)) return next();

  const normalizedPath = path.normalize(path.join(ASSETS_ROOT, 'images', requestPath)).replace(/[\\/]+$/, '');
  const expectedPrefix = path.join(ASSETS_ROOT, 'images');

  if (!normalizedPath.startsWith(expectedPrefix)) {
    return res.status(400).json({ message: 'Invalid image path.' });
  }

  if (fs.existsSync(normalizedPath)) return next();

  if (fs.existsSync(FALLBACK_IMAGE_ABSOLUTE_PATH)) {
    res.setHeader('X-Fallback-Image', 'true');
    return res.sendFile(FALLBACK_IMAGE_ABSOLUTE_PATH);
  }

  return res.status(404).json({
    message: 'Image not found and fallback image is unavailable.',
    fallback: FALLBACK_IMAGE_RELATIVE_PATH
  });
});

app.use(express.static(APP_ROOT));
app.use('/frontend', express.static(APP_ROOT));

const whatsAppService = createWhatsAppService({
  provider: WHATSAPP_PROVIDER,
  adminNumber: normalizePhoneNumber(RESERVATION_WHATSAPP_NUMBER, WHATSAPP_DEFAULT_COUNTRY_CODE),
  defaultCountryCode: WHATSAPP_DEFAULT_COUNTRY_CODE,
  metaAccessToken: WHATSAPP_META_ACCESS_TOKEN,
  metaPhoneNumberId: WHATSAPP_META_PHONE_NUMBER_ID,
  metaApiVersion: WHATSAPP_META_API_VERSION,
  metaVerifyToken: WHATSAPP_VERIFY_TOKEN,
  metaAppSecret: WHATSAPP_META_APP_SECRET,
  twilioAccountSid: WHATSAPP_TWILIO_ACCOUNT_SID,
  twilioAuthToken: WHATSAPP_TWILIO_AUTH_TOKEN,
  twilioWhatsAppFrom: WHATSAPP_TWILIO_FROM,
  reservationTemplateName: WHATSAPP_RESERVATION_TEMPLATE_NAME,
  openAiApiKey: OPENAI_API_KEY,
  openAiModel: OPENAI_MODEL
});

const userSchema = new mongoose.Schema(
  {
    name: String,
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, default: null },
    picture: { type: String, default: '' },
    authProvider: { type: String, default: 'local' },
    favorites: { type: [String], default: [] },
    orderHistory: { type: [mongoose.Schema.Types.Mixed], default: [] }
  },
  { timestamps: true }
);

const activitySchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    email: { type: String, required: true },
    actionType: String,
    description: String,
    itemId: String,
    timestamp: { type: Date, default: Date.now }
  },
  { versionKey: false }
);

const reviewSchema = new mongoose.Schema(
  {
    userId: String,
    userName: String,
    userEmail: String,
    rating: Number,
    text: String,
    textUrdu: String,
    date: { type: Date, default: Date.now }
  },
  { versionKey: false }
);

const reservationSchema = new mongoose.Schema(
  {
    userId: String,
    userEmail: String,
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    dateTime: { type: Date, required: true },
    guests: { type: Number, required: true },
    tableNumber: { type: Number, required: true },
    whatsappOptIn: { type: Boolean, default: false },
    whatsappDelivery: { type: mongoose.Schema.Types.Mixed, default: {} },
    status: { type: String, default: 'booked' }
  },
  { timestamps: true }
);
reservationSchema.index({ tableNumber: 1, dateTime: 1 }, { unique: true });

const passwordResetSchema = new mongoose.Schema(
  {
    email: { type: String, required: true },
    code: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    used: { type: Boolean, default: false }
  },
  { timestamps: true }
);

const User = mongoose.model('User', userSchema);
const Activity = mongoose.model('Activity', activitySchema);
const Review = mongoose.model('Review', reviewSchema);
const Reservation = mongoose.model('Reservation', reservationSchema);
const PasswordReset = mongoose.model('PasswordReset', passwordResetSchema);

let isDbReady = false;
let dbInitError = '';

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function mapUser(user) {
  if (!user) return null;
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    password: user.password,
    picture: user.picture || '',
    authProvider: user.authProvider || 'local',
    favorites: Array.isArray(user.favorites) ? user.favorites : [],
    orderHistory: Array.isArray(user.orderHistory) ? user.orderHistory : []
  };
}

function getRequestIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function logApiFailure(req, scope, detail, extra = {}) {
  const safeDetail = detail instanceof Error ? detail.message : String(detail || 'unknown-error');

  console.warn('[api-failure]', {
    scope,
    method: req.method,
    path: req.originalUrl || req.url,
    ip: getRequestIp(req),
    email: normalizeEmail(req.body?.email || req.auth?.email || ''),
    detail: safeDetail,
    ...extra,
    at: new Date().toISOString()
  });
}

function createSessionToken(user) {
  return jwt.sign({ id: String(user?.id || ''), email: user.email }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN
  });
}

function getSessionResponse(user) {
  const token = createSessionToken(user);
  const decoded = jwt.decode(token);
  return {
    token,
    exp: decoded?.exp,
    user: {
      id: String(user.id),
      name: user.name || user.email,
      email: user.email,
      picture: user.picture || ''
    }
  };
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';

  if (!token) return res.status(401).json({ message: 'Missing token' });

  try {
    req.auth = jwt.verify(token, JWT_SECRET);
    return next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

function getOptionalAuth(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return null;

  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

function getReservationWhatsAppMessage(data) {
  return `New reservation: Table ${data.tableNumber} by ${data.name} at ${data.dateTime}. Guests: ${data.guests}, Phone: ${data.phone}`;
}

function getReservationWhatsAppLink(data) {
  const message = getReservationWhatsAppMessage(data);
  return `https://wa.me/${RESERVATION_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

async function findUserByEmail(email) {
  const user = await User.findOne({ email: normalizeEmail(email) }).lean();
  return mapUser(user);
}

async function findUserById(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  const user = await User.findById(id).lean();
  return mapUser(user);
}

async function createUserRecord(data) {
  const user = await User.create({
    name: data.name || null,
    email: normalizeEmail(data.email),
    password: data.password || null,
    picture: data.picture || '',
    authProvider: data.authProvider || 'local',
    favorites: Array.isArray(data.favorites) ? data.favorites : [],
    orderHistory: Array.isArray(data.orderHistory) ? data.orderHistory : []
  });
  return mapUser(user.toObject());
}

async function updateUserRecord(user, changes) {
  const updated = await User.findByIdAndUpdate(
    user.id,
    {
      $set: {
        name: changes.name !== undefined ? changes.name : user.name,
        email: changes.email !== undefined ? normalizeEmail(changes.email) : user.email,
        password: changes.password !== undefined ? changes.password : user.password,
        picture: changes.picture !== undefined ? changes.picture : user.picture,
        authProvider: changes.authProvider !== undefined ? changes.authProvider : user.authProvider,
        favorites: changes.favorites !== undefined ? changes.favorites : user.favorites,
        orderHistory: changes.orderHistory !== undefined ? changes.orderHistory : user.orderHistory
      }
    },
    { new: true }
  ).lean();

  return mapUser(updated);
}

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name = '', email = '', password = '' } = req.body || {};
    const normalizedEmail = normalizeEmail(email);
    const normalizedPassword = String(password || '').trim();

    if (!normalizedEmail || !normalizedPassword) {
      logApiFailure(req, 'auth.register', 'missing-email-or-password');
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    if (normalizedPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }

    const existing = await findUserByEmail(normalizedEmail);
    if (existing) {
      return res.status(409).json({ message: 'Account already exists. Please sign in.' });
    }

    const hashedPassword = await bcrypt.hash(normalizedPassword, 10);
    const user = await createUserRecord({
      name: String(name).trim() || normalizedEmail.split('@')[0],
      email: normalizedEmail,
      password: hashedPassword,
      authProvider: 'local'
    });

    return res.status(201).json(getSessionResponse(user));
  } catch (error) {
    logApiFailure(req, 'auth.register', error);
    return res.status(500).json({ message: 'Registration failed.', detail: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email = '', password = '' } = req.body || {};
    const normalizedEmail = normalizeEmail(email);
    const normalizedPassword = String(password || '').trim();

    if (!normalizedEmail || !normalizedPassword) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const user = await findUserByEmail(normalizedEmail);
    if (!user || !user.password) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const matched = await bcrypt.compare(normalizedPassword, user.password);
    if (!matched) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    return res.json(getSessionResponse(user));
  } catch (error) {
    logApiFailure(req, 'auth.login', error);
    return res.status(500).json({ message: 'Login failed.', detail: error.message });
  }
});

app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email = '' } = req.body || {};
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail) {
      return res.status(400).json({ message: 'Email is required.' });
    }

    const responsePayload = {
      message: 'If this email exists, reset instructions have been sent.'
    };

    const user = await findUserByEmail(normalizedEmail);
    if (user) {
      const resetCode = String(Math.floor(100000 + Math.random() * 900000));
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      await PasswordReset.updateMany({ email: normalizedEmail, used: false }, { $set: { used: true } });
      await PasswordReset.create({ email: normalizedEmail, code: resetCode, expiresAt, used: false });

      console.log(`[password-reset] ${normalizedEmail} code: ${resetCode} (expires: ${expiresAt.toISOString()})`);

      if (!IS_PRODUCTION) {
        responsePayload.devResetCode = resetCode;
        responsePayload.devExpiresAt = expiresAt.toISOString();
      }
    }

    return res.json(responsePayload);
  } catch (error) {
    logApiFailure(req, 'auth.forgot-password', error);
    return res.status(500).json({ message: 'Forgot password request failed.', detail: error.message });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { email = '', code = '', newPassword = '' } = req.body || {};
    const normalizedEmail = normalizeEmail(email);
    const normalizedCode = String(code || '').trim();
    const normalizedNewPassword = String(newPassword || '').trim();

    if (!normalizedEmail || !normalizedCode || !normalizedNewPassword) {
      return res.status(400).json({ message: 'Email, code and new password are required.' });
    }

    if (normalizedNewPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters.' });
    }

    const resetRow = await PasswordReset.findOne({ email: normalizedEmail, code: normalizedCode, used: false })
      .sort({ _id: -1 })
      .lean();

    if (!resetRow) {
      return res.status(400).json({ message: 'Invalid or expired reset code.' });
    }

    const expiresAt = new Date(resetRow.expiresAt).getTime();
    if (Number.isNaN(expiresAt) || expiresAt < Date.now()) {
      await PasswordReset.updateOne({ _id: resetRow._id }, { $set: { used: true } });
      return res.status(400).json({ message: 'Reset code has expired. Please request a new one.' });
    }

    const user = await findUserByEmail(normalizedEmail);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    const hashedPassword = await bcrypt.hash(normalizedNewPassword, 10);
    await updateUserRecord(user, { password: hashedPassword, authProvider: 'local' });
    await PasswordReset.updateOne({ _id: resetRow._id }, { $set: { used: true } });

    return res.json({ message: 'Password updated successfully. Please sign in.' });
  } catch (error) {
    logApiFailure(req, 'auth.reset-password', error);
    return res.status(500).json({ message: 'Reset password failed.', detail: error.message });
  }
});

app.post('/api/auth/google', async (req, res) => {
  try {
    if (!GOOGLE_CLIENT_ID) {
      return res.status(500).json({ message: 'Server Google client ID is not configured.' });
    }

    const { credential = '' } = req.body || {};
    if (!credential) return res.status(400).json({ message: 'Google credential is required.' });

    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    const email = normalizeEmail(payload?.email);
    if (!email) return res.status(400).json({ message: 'Google account email not available.' });

    const name = payload?.name || email.split('@')[0];
    const picture = payload?.picture || '';

    let user = await findUserByEmail(email);
    if (!user) {
      user = await createUserRecord({ name, email, picture, authProvider: 'google' });
    } else {
      user = await updateUserRecord(user, { name, picture, authProvider: 'google' });
    }

    return res.json(getSessionResponse(user));
  } catch (error) {
    logApiFailure(req, 'auth.google', error);
    return res.status(401).json({ message: 'Google sign-in failed.', detail: error.message });
  }
});

app.get('/api/public/auth-config', (req, res) => {
  return res.json({ googleClientId: GOOGLE_CLIENT_ID || '' });
});

app.get('/api/health', async (req, res) => {
  const healthStartedAtNs = process.hrtime.bigint();
  let pingOk = false;
  let pingError = null;
  let pingLatencyMs = null;

  try {
    const pingStartedAtNs = process.hrtime.bigint();
    await mongoose.connection.db.admin().ping();
    const pingEndedAtNs = process.hrtime.bigint();
    pingLatencyMs = Number(pingEndedAtNs - pingStartedAtNs) / 1_000_000;
    pingOk = true;
  } catch (error) {
    pingError = error.message;
  }

  const healthEndedAtNs = process.hrtime.bigint();
  const healthLatencyMs = Number(healthEndedAtNs - healthStartedAtNs) / 1_000_000;

  return res.json({
    ok: isDbReady && pingOk,
    service: 'rahman-restaurant-mongodb-api',
    uptimeSeconds: Math.floor(process.uptime()),
    startedAt: new Date(SERVER_STARTED_AT_MS).toISOString(),
    db: {
      type: 'nosql',
      engine: 'mongodb',
      initialized: isDbReady,
      connected: pingOk,
      pingLatencyMs,
      mode: isDbReady ? 'mongodb' : 'not-ready',
      uri: MONGODB_URI.replace(/:[^:@/]+@/, ':****@'),
      initError: dbInitError || null,
      pingError
    },
    latencyMs: healthLatencyMs,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  try {
    const user = await findUserById(req.auth.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    return res.json({
      user: {
        id: String(user.id),
        name: user.name || user.email,
        email: user.email,
        picture: user.picture || ''
      }
    });
  } catch (error) {
    logApiFailure(req, 'auth.me', error, { userId: req.auth?.id || null });
    return res.status(500).json({ message: 'Failed to fetch profile.', detail: error.message });
  }
});

app.post('/api/activity/track', requireAuth, async (req, res) => {
  try {
    const { actionType, description, itemId } = req.body || {};
    await Activity.create({
      userId: req.auth.id,
      email: req.auth.email,
      actionType: actionType || null,
      description: description || null,
      itemId: itemId || null
    });
    return res.json({ success: true, message: 'Activity tracked' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to track activity', detail: error.message });
  }
});

app.get('/api/activity/history', requireAuth, async (req, res) => {
  try {
    const activities = await Activity.find({ userId: req.auth.id })
      .sort({ timestamp: -1 })
      .limit(50)
      .lean();

    return res.json({
      activities: activities.map(row => ({
        id: String(row._id),
        userId: row.userId,
        email: row.email,
        actionType: row.actionType,
        description: row.description,
        itemId: row.itemId,
        timestamp: row.timestamp
      }))
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch activity', detail: error.message });
  }
});

app.post('/api/favorites/add', requireAuth, async (req, res) => {
  try {
    const { itemId } = req.body || {};
    const user = await findUserById(req.auth.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    const favorites = [...(user.favorites || [])];
    if (itemId && !favorites.includes(itemId)) {
      favorites.push(itemId);
      await updateUserRecord(user, { favorites });
      await Activity.create({
        userId: req.auth.id,
        email: req.auth.email,
        actionType: 'favorite',
        description: `Added item ${itemId} to favorites`,
        itemId
      });
    }

    return res.json({ success: true, message: 'Added to favorites' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to add favorite', detail: error.message });
  }
});

app.post('/api/favorites/remove', requireAuth, async (req, res) => {
  try {
    const { itemId } = req.body || {};
    const user = await findUserById(req.auth.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    const favorites = (user.favorites || []).filter(id => id !== itemId);
    await updateUserRecord(user, { favorites });

    return res.json({ success: true, message: 'Removed from favorites' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to remove favorite', detail: error.message });
  }
});

app.get('/api/favorites/list', requireAuth, async (req, res) => {
  try {
    const user = await findUserById(req.auth.id);
    return res.json({ favorites: user?.favorites || [] });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch favorites', detail: error.message });
  }
});

app.post('/api/orders/add', requireAuth, async (req, res) => {
  try {
    const { items, total, orderId } = req.body || {};
    const user = await findUserById(req.auth.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    const orders = [...(user.orderHistory || [])];
    const nextOrder = {
      orderId: orderId || `ORD-${Date.now()}`,
      items: Array.isArray(items) ? items : [],
      total: Number(total || 0),
      status: 'completed',
      date: new Date().toISOString()
    };

    orders.push(nextOrder);
    await updateUserRecord(user, { orderHistory: orders });

    await Activity.create({
      userId: req.auth.id,
      email: req.auth.email,
      actionType: 'order',
      description: `Placed order for Rs. ${nextOrder.total}`,
      itemId: nextOrder.orderId
    });

    return res.json({ success: true, message: 'Order saved' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to save order', detail: error.message });
  }
});

app.get('/api/orders/history', requireAuth, async (req, res) => {
  try {
    const user = await findUserById(req.auth.id);
    return res.json({ orders: user?.orderHistory || [] });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch orders', detail: error.message });
  }
});

app.post('/api/reviews/add', requireAuth, async (req, res) => {
  try {
    const { rating, text, textUrdu } = req.body || {};
    const user = await findUserById(req.auth.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    const review = await Review.create({
      userId: req.auth.id,
      userName: user.name || user.email,
      userEmail: req.auth.email,
      rating: Number(rating || 0),
      text: text || '',
      textUrdu: textUrdu || ''
    });

    await Activity.create({
      userId: req.auth.id,
      email: req.auth.email,
      actionType: 'review',
      description: `Posted a ${rating}-star review`,
      itemId: String(review._id)
    });

    return res.json({ success: true, message: 'Review posted' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to post review', detail: error.message });
  }
});

app.get('/api/reviews/all', async (req, res) => {
  try {
    const reviews = await Review.find({}).sort({ date: -1 }).limit(100).lean();

    return res.json({
      reviews: reviews.map(row => ({
        id: String(row._id),
        userId: row.userId,
        userName: row.userName,
        userEmail: row.userEmail,
        rating: row.rating,
        text: row.text,
        textUrdu: row.textUrdu,
        date: row.date
      }))
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch reviews', detail: error.message });
  }
});

app.get('/api/restaurant/info', async (req, res) => {
  try {
    return res.json({
      name: 'RAHMAN',
      nameUrdu: 'رحمان',
      description: 'Welcome to RAHMAN Restaurant - Your Culinary Paradise',
      descriptionUrdu: 'رحمان ریستوران میں خوش آمدید - آپ کے ذائقے کی جنت',
      phone: '+91-78580-62571',
      email: 'contact@rahman.com',
      address: 'Punjab, India',
      addressUrdu: 'پنجاب، بھارت',
      hours: {
        weekday: '9:00 AM - 10:00 PM',
        weekend: '11:00 AM - 11:00 PM'
      },
      hoursUrdu: {
        weekday: 'صبح 9:00 - رات 10:00',
        weekend: 'صبح 11:00 - رات 11:00'
      },
      quotations: [
        {
          text: 'Great food is the foundation of genuine happiness',
          textUrdu: 'بہترین کھانا سچی خوشی کی بنیاد ہے',
          author: 'Auguste Escoffier'
        }
      ],
      poetry: [
        {
          text: 'Spices dance, aromas sing, joy in every meal we bring',
          textUrdu: 'مسالے رقص کرتے ہیں، خوشبوؤں گیت گاتی ہیں، ہر کھانے میں خوشی لاتی ہیں',
          author: 'RAHMAN Kitchen'
        }
      ],
      reviews: [
        {
          userName: 'خواجہ احمد',
          rating: 5,
          text: 'Amazing food and great service!',
          textUrdu: 'شاندار کھانا اور بہترین خدمت!'
        }
      ]
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch restaurant info', detail: error.message });
  }
});

app.get('/api/reservations', async (req, res) => {
  try {
    const dateTime = String(req.query.dateTime || '').trim();
    const tableNumber = Number(req.query.tableNumber || 0);

    const query = {};
    if (dateTime) {
      const parsedDate = new Date(dateTime);
      if (!Number.isNaN(parsedDate.getTime())) {
        query.dateTime = parsedDate;
      }
    }
    if (tableNumber > 0) query.tableNumber = tableNumber;

    const reservations = await Reservation.find(query)
      .sort({ dateTime: 1, tableNumber: 1 })
      .lean();

    return res.json({
      reservations: reservations.map(row => ({
        id: String(row._id),
        userId: row.userId || null,
        userEmail: row.userEmail || null,
        name: row.name,
        email: row.email,
        phone: row.phone,
        dateTime: row.dateTime,
        guests: row.guests,
        tableNumber: row.tableNumber,
        whatsappOptIn: Boolean(row.whatsappOptIn),
        whatsappDelivery: row.whatsappDelivery || {},
        status: row.status,
        createdAt: row.createdAt
      }))
    });
  } catch (error) {
    logApiFailure(req, 'reservation.list', error);
    return res.status(500).json({ message: 'Failed to fetch reservations', detail: error.message });
  }
});

app.post('/api/reservations', async (req, res) => {
  try {
    const auth = getOptionalAuth(req);
    const {
      name = '',
      email = '',
      phone = '',
      dateTime = '',
      guests = 1,
      tableNumber = 0,
      whatsappOptIn = false
    } = req.body || {};

    const payload = {
      name: String(name || '').trim(),
      email: normalizeEmail(email),
      phone: String(phone || '').trim(),
      dateTime: String(dateTime || '').trim(),
      guests: Number(guests || 1),
      tableNumber: Number(tableNumber || 0),
      whatsappOptIn: Boolean(whatsappOptIn)
    };

    if (!payload.name || !payload.email || !payload.phone || !payload.dateTime) {
      return res.status(400).json({ message: 'All reservation fields are required.' });
    }

    if (payload.guests < 1 || payload.guests > 10) {
      return res.status(400).json({ message: 'Guests must be between 1 and 10.' });
    }

    if (payload.tableNumber < 1 || payload.tableNumber > 50) {
      return res.status(400).json({ message: 'Table number must be between 1 and 50.' });
    }

    const parsedDateTime = new Date(payload.dateTime);
    if (Number.isNaN(parsedDateTime.getTime())) {
      return res.status(400).json({ message: 'Invalid reservation date/time.' });
    }

    let notificationStatus = {
      admin: { sent: false, reason: 'not-attempted' },
      customer: { sent: false, reason: 'not-attempted' }
    };

    if (whatsAppService.isEnabled()) {
      try {
        notificationStatus.admin = await whatsAppService.sendReservationNotification(payload);
      } catch (error) {
        notificationStatus.admin = { sent: false, reason: 'send-failed', detail: error.message };
      }

      try {
        notificationStatus.customer = await whatsAppService.sendReservationConfirmation(payload);
      } catch (error) {
        notificationStatus.customer = { sent: false, reason: 'send-failed', detail: error.message };
      }
    }

    let created;
    try {
      created = await Reservation.create({
        userId: auth?.id || null,
        userEmail: auth?.email || null,
        name: payload.name,
        email: payload.email,
        phone: payload.phone,
        dateTime: parsedDateTime,
        guests: payload.guests,
        tableNumber: payload.tableNumber,
        whatsappOptIn: payload.whatsappOptIn,
        whatsappDelivery: notificationStatus,
        status: 'booked'
      });
    } catch (error) {
      if (error?.code === 11000) {
        return res.status(409).json({ message: 'Table is already reserved for this slot.' });
      }
      throw error;
    }

    const reservation = {
      id: String(created._id),
      userId: created.userId,
      userEmail: created.userEmail,
      name: created.name,
      email: created.email,
      phone: created.phone,
      dateTime: created.dateTime,
      guests: created.guests,
      tableNumber: created.tableNumber,
      whatsappOptIn: created.whatsappOptIn,
      whatsappDelivery: created.whatsappDelivery,
      status: created.status,
      createdAt: created.createdAt
    };

    const whatsappLink = getReservationWhatsAppLink(payload);

    return res.status(201).json({
      success: true,
      reservation,
      whatsappLink,
      whatsappDelivery: notificationStatus,
      providerHint: whatsAppService.isEnabled()
        ? ''
        : 'Set WHATSAPP_PROVIDER=meta or twilio in .env to enable automated sends.'
    });
  } catch (error) {
    logApiFailure(req, 'reservation.create', error);
    return res.status(500).json({ message: 'Failed to create reservation', detail: error.message });
  }
});

app.get('/api/whatsapp/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === WHATSAPP_VERIFY_TOKEN) {
    return res.status(200).send(String(challenge || ''));
  }

  return res.status(403).json({ message: 'Webhook verification failed' });
});

app.post('/api/whatsapp/webhook', async (req, res) => {
  try {
    const signature = req.headers['x-hub-signature-256'];
    if (!whatsAppService.verifyMetaSignature(req.rawBody, signature)) {
      return res.status(401).json({ message: 'Invalid webhook signature' });
    }

    const result = await whatsAppService.handleMetaWebhook(req.body || {});
    return res.status(200).json({ ok: true, ...result });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to process WhatsApp webhook', detail: error.message });
  }
});

app.post('/api/whatsapp/twilio', async (req, res) => {
  try {
    await whatsAppService.handleTwilioWebhook(req.body || {});
    return res.status(200).type('text/xml').send('<Response></Response>');
  } catch (error) {
    return res.status(500).type('text/xml').send('<Response><Message>Temporary issue. Please retry later.</Message></Response>');
  }
});

app.get('/dashboard', requireAuth, (req, res) => {
  res.send('Welcome to dashboard');
});

app.get('/', (req, res) => {
  res.sendFile(path.join(APP_ROOT, 'index-scroll.html'));
});

app.get('/auth-signin.html', (req, res) => {
  res.sendFile(path.resolve(__dirname, '..', 'auth-signin.html'));
});

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);

  console.error('[unhandled-error]', {
    method: req.method,
    path: req.originalUrl || req.url,
    message: error?.message || String(error),
    at: new Date().toISOString()
  });

  const payload = { message: 'Internal server error' };
  if (!IS_PRODUCTION) payload.detail = error?.message || String(error);
  return res.status(500).json(payload);
});

async function initMongo() {
  await mongoose.connect(MONGODB_URI, {
    autoIndex: true
  });

  isDbReady = true;
  console.log('MongoDB connected');
}

function scheduleDbInitRetry() {
  setTimeout(() => {
    initMongo()
      .then(() => {
        dbInitError = '';
      })
      .catch(error => {
        dbInitError = error?.message || String(error);
        console.error('MongoDB initialization retry failed:', dbInitError);
        if (error?.stack) console.error(error.stack);
        scheduleDbInitRetry();
      });
  }, DB_INIT_RETRY_MS);
}

app.listen(PORT, () => {
  console.log(`Mongo backend running on http://localhost:${PORT}`);
});

initMongo().catch(error => {
  dbInitError = error?.message || String(error);
  console.error('MongoDB initialization failed:', dbInitError);
  if (error?.stack) console.error(error.stack);
  console.error(`Retrying DB init every ${DB_INIT_RETRY_MS}ms while keeping server online.`);
  scheduleDbInitRetry();
});
