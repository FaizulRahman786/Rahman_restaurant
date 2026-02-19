require('dotenv').config();

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
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

  if (!normalized) {
    return fallback;
  }

  if (normalized === 'true') {
    return 1;
  }

  if (normalized === 'false') {
    return 0;
  }

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
const PORT = parsePositiveInt(process.env.PORT, 3000);
const DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5432/restaurant_db';
const PGSSL = String(process.env.PGSSL || 'false').toLowerCase() === 'true';
const PGSSL_REJECT_UNAUTHORIZED =
  String(process.env.PGSSL_REJECT_UNAUTHORIZED || 'true').toLowerCase() ===
  'true';
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
const CORS_ORIGIN = 

  process.env.CORS_ORIGIN ||
  'http://localhost:3000,http://127.0.0.1:3000,http://localhost:5500,http://127.0.0.1:5500';
const CORS_ALLOWLIST = CORS_ORIGIN.split(',')
  .map(origin => normalizeOrigin(origin))
  .filter(Boolean);
const TRUST_PROXY = parseTrustProxy(process.env.TRUST_PROXY, IS_PRODUCTION ? 1 : 0);
const API_RATE_LIMIT_WINDOW_MS =
  parsePositiveInt(process.env.API_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000);
const API_RATE_LIMIT_MAX =
  parsePositiveInt(process.env.API_RATE_LIMIT_MAX, IS_PRODUCTION ? 200 : 1000);
const DB_INIT_RETRY_MS = parsePositiveInt(process.env.DB_INIT_RETRY_MS, 10000);
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const RESERVATION_WHATSAPP_NUMBER =
  process.env.RESERVATION_WHATSAPP_NUMBER || '7858062571';
const WHATSAPP_PROVIDER = process.env.WHATSAPP_PROVIDER || 'none';
const WHATSAPP_DEFAULT_COUNTRY_CODE =
  process.env.WHATSAPP_DEFAULT_COUNTRY_CODE || '91';
const WHATSAPP_META_ACCESS_TOKEN = process.env.WHATSAPP_META_ACCESS_TOKEN || '';
const WHATSAPP_META_PHONE_NUMBER_ID =
  process.env.WHATSAPP_META_PHONE_NUMBER_ID || '';
const WHATSAPP_META_API_VERSION = process.env.WHATSAPP_META_API_VERSION || 'v20.0';
const WHATSAPP_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || '';
const WHATSAPP_META_APP_SECRET = process.env.WHATSAPP_META_APP_SECRET || '';
const WHATSAPP_TWILIO_ACCOUNT_SID = process.env.WHATSAPP_TWILIO_ACCOUNT_SID || '';
const WHATSAPP_TWILIO_AUTH_TOKEN =
  process.env.WHATSAPP_TWILIO_AUTH_TOKEN || '';
const WHATSAPP_TWILIO_FROM = process.env.WHATSAPP_TWILIO_FROM || '';
const WHATSAPP_RESERVATION_TEMPLATE_NAME =
  process.env.WHATSAPP_RESERVATION_TEMPLATE_NAME || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const SERVER_STARTED_AT_MS = Date.now();
const FRONTEND_ROOT_FROM_ENV = process.env.FRONTEND_ROOT
  ? path.resolve(process.env.FRONTEND_ROOT)
  : '';
const FRONTEND_ROOT_DEFAULT = path.resolve(__dirname, '..', 'frontend');
const APP_ROOT = fs.existsSync(FRONTEND_ROOT_FROM_ENV)
  ? FRONTEND_ROOT_FROM_ENV
  : fs.existsSync(FRONTEND_ROOT_DEFAULT)
    ? FRONTEND_ROOT_DEFAULT
    : path.join(__dirname);
const ASSETS_ROOT = path.join(APP_ROOT, 'assets');
const FALLBACK_IMAGE_RELATIVE_PATH = '/assets/images/misc/image-fallback.svg';
const FALLBACK_IMAGE_ABSOLUTE_PATH = path.join(
  ASSETS_ROOT,
  'images',
  'misc',
  'image-fallback.svg'
);

if (IS_PRODUCTION && !process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be set in production.');
}

if (IS_PRODUCTION && (!JWT_SECRET || JWT_SECRET === 'change-this-secret' || JWT_SECRET.length < 32)) {
  throw new Error('JWT_SECRET must be at least 32 characters and not use the default in production.');
}

if (!IS_PRODUCTION && (JWT_SECRET === 'change-this-secret' || JWT_SECRET.length < 16)) {
  console.warn('[security] Update JWT_SECRET in .env before production deployment.');
}

if (IS_PRODUCTION && CORS_ALLOWLIST.length === 0) {
  throw new Error('CORS_ORIGIN must include at least one allowed origin in production.');
}

if (
  IS_PRODUCTION &&
  CORS_ALLOWLIST.some(origin => !/^https:\/\//i.test(origin))
) {
  throw new Error('CORS_ORIGIN must use https origins in production.');
}

if (
  IS_PRODUCTION &&
  CORS_ALLOWLIST.some(
    origin =>
      /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(origin)
  )
) {
  throw new Error('CORS_ORIGIN must not include localhost origins in production.');
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

    if (!origin) {
      return callback(null, true);
    }

    const isLoopbackOrigin =
      /^https?:\/\/localhost(:\d+)?$/i.test(normalizedOrigin) ||
      /^https?:\/\/127\.0\.0\.1(:\d+)?$/i.test(normalizedOrigin) ||
      /^https?:\/\/\[::1\](:\d+)?$/i.test(normalizedOrigin);

    if (isLoopbackOrigin) {
      return callback(null, true);
    }

    if (!IS_PRODUCTION) {
      return callback(null, true);
    }

    if (CORS_ALLOWLIST.includes(normalizedOrigin)) {
      return callback(null, true);
    }

    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-Hub-Signature-256'
  ],
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

const apiLimiter = rateLimit({
  windowMs: API_RATE_LIMIT_WINDOW_MS,
  max: API_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: 'Too many requests, please try again later.'
  }
});

app.use('/api', apiLimiter);

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
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return next();
  }

  const requestPath = decodeURIComponent(req.path || '');
  const extension = path.extname(requestPath).toLowerCase();
  const imageExtensions = new Set([
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.webp',
    '.svg',
    '.avif',
    '.bmp',
    '.ico'
  ]);

  if (!imageExtensions.has(extension)) {
    return next();
  }

  const normalizedPath = path
    .normalize(path.join(ASSETS_ROOT, 'images', requestPath))
    .replace(/[\\/]+$/, '');
  const expectedPrefix = path.join(ASSETS_ROOT, 'images');

  if (!normalizedPath.startsWith(expectedPrefix)) {
    return res.status(400).json({ message: 'Invalid image path.' });
  }

  if (fs.existsSync(normalizedPath)) {
    return next();
  }

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

const whatsAppService = createWhatsAppService({
  provider: WHATSAPP_PROVIDER,
  adminNumber: normalizePhoneNumber(
    RESERVATION_WHATSAPP_NUMBER,
    WHATSAPP_DEFAULT_COUNTRY_CODE
  ),
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

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: PGSSL ? { rejectUnauthorized: PGSSL_REJECT_UNAUTHORIZED } : false
});

let isSqlReady = false;
let dbInitError = '';

async function runSql(sql, params = [], returnField = 'id') {
  const result = await pool.query(sql, params);
  return {
    lastID: result.rows?.[0]?.[returnField] || null,
    changes: result.rowCount || 0,
    rows: result.rows || []
  };
}

async function getSql(sql, params = []) {
  const result = await pool.query(sql, params);
  return result.rows?.[0] || null;
}

async function allSql(sql, params = []) {
  const result = await pool.query(sql, params);
  return result.rows || [];
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function parseJsonArray(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (value === null || value === undefined) {
    return [];
  }

  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function mapUser(row) {
  if (!row) {
    return null;
  }

  return {
    id: String(row.id),
    name: row.name,
    email: row.email,
    password: row.password,
    picture: row.picture || '',
    authProvider: row.auth_provider || 'local',
    favorites: parseJsonArray(row.favorites),
    orderHistory: parseJsonArray(row.order_history)
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
  const safeDetail =
    detail instanceof Error
      ? detail.message
      : String(detail || 'unknown-error');

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
function getUserId(user) {
  return String(user?.id || '');
}

function createSessionToken(user) {
  return jwt.sign({ id: getUserId(user), email: user.email }, JWT_SECRET, {
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
      id: getUserId(user),
      name: user.name || user.email,
      email: user.email,
      picture: user.picture || ''
    }
  };
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';

  if (!token) {
    return res.status(401).json({ message: 'Missing token' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.auth = payload;
    return next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

function getOptionalAuth(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';

  if (!token) {
    return null;
  }

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
  return `https://wa.me/${RESERVATION_WHATSAPP_NUMBER}?text=${encodeURIComponent(
    message
  )}`;
}

async function initSql() {
  await runSql(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      name TEXT,
      email TEXT NOT NULL UNIQUE,
      password TEXT,
      picture TEXT DEFAULT '',
      auth_provider TEXT DEFAULT 'local',
      favorites JSONB DEFAULT '[]'::jsonb,
      order_history JSONB DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await runSql(`
    CREATE TABLE IF NOT EXISTS activities (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      email TEXT NOT NULL,
      action_type TEXT,
      description TEXT,
      item_id TEXT,
      timestamp TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await runSql(`
    CREATE TABLE IF NOT EXISTS reviews (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT,
      user_name TEXT,
      user_email TEXT,
      rating INTEGER,
      text TEXT,
      text_urdu TEXT,
      date TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await runSql(`
    CREATE TABLE IF NOT EXISTS reservations (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT,
      user_email TEXT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      date_time TIMESTAMPTZ NOT NULL,
      guests INTEGER NOT NULL,
      table_number INTEGER NOT NULL,
      whatsapp_opt_in BOOLEAN DEFAULT FALSE,
      whatsapp_delivery JSONB DEFAULT '{}'::jsonb,
      status TEXT DEFAULT 'booked',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await runSql(
    `ALTER TABLE reservations ADD COLUMN IF NOT EXISTS whatsapp_opt_in BOOLEAN DEFAULT FALSE`
  );
  await runSql(
    `ALTER TABLE reservations ADD COLUMN IF NOT EXISTS whatsapp_delivery JSONB DEFAULT '{}'::jsonb`
  );

  await runSql(
    'CREATE UNIQUE INDEX IF NOT EXISTS reservations_table_slot_idx ON reservations (table_number, date_time)'
  );

  await runSql(`
    CREATE TABLE IF NOT EXISTS password_resets (
      id BIGSERIAL PRIMARY KEY,
      email TEXT NOT NULL,
      code TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      used BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  isSqlReady = true;
  console.log('PostgreSQL connected');
}

async function findUserByEmail(email) {
  const row = await getSql('SELECT * FROM users WHERE email = $1', [email]);
  return mapUser(row);
}

async function findUserById(id) {
  const row = await getSql('SELECT * FROM users WHERE id = $1', [id]);
  return mapUser(row);
}

async function createUserRecord(data) {
  const result = await runSql(
    `
      INSERT INTO users (name, email, password, picture, auth_provider, favorites, order_history, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, NOW())
      RETURNING id
    `,
    [
      data.name || null,
      data.email,
      data.password || null,
      data.picture || '',
      data.authProvider || 'local',
      JSON.stringify(Array.isArray(data.favorites) ? data.favorites : []),
      JSON.stringify(Array.isArray(data.orderHistory) ? data.orderHistory : [])
    ]
  );

  return findUserById(result.lastID);
}

async function updateUserRecord(user, changes) {
  const merged = {
    name: changes.name !== undefined ? changes.name : user.name,
    email: changes.email !== undefined ? changes.email : user.email,
    password: changes.password !== undefined ? changes.password : user.password,
    picture: changes.picture !== undefined ? changes.picture : user.picture,
    authProvider:
      changes.authProvider !== undefined ? changes.authProvider : user.authProvider,
    favorites: changes.favorites !== undefined ? changes.favorites : user.favorites,
    orderHistory:
      changes.orderHistory !== undefined
        ? changes.orderHistory
        : user.orderHistory
  };

  await runSql(
    `
      UPDATE users
      SET name = $1,
          email = $2,
          password = $3,
          picture = $4,
          auth_provider = $5,
          favorites = $6::jsonb,
          order_history = $7::jsonb,
          updated_at = NOW()
      WHERE id = $8
    `,
    [
      merged.name,
      merged.email,
      merged.password,
      merged.picture,
      merged.authProvider,
      JSON.stringify(Array.isArray(merged.favorites) ? merged.favorites : []),
      JSON.stringify(
        Array.isArray(merged.orderHistory) ? merged.orderHistory : []
      ),
      user.id
    ]
  );

  return findUserById(user.id);
}

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name = '', email = '', password = '' } = req.body || {};
    const normalizedEmail = normalizeEmail(email);
    const normalizedPassword = String(password || '').trim();

    if (!normalizedEmail || !normalizedPassword) {
      logApiFailure(req, 'auth.register', 'missing-email-or-password');
      return res
        .status(400)
        .json({ message: 'Email and password are required.' });
    }

    if (normalizedPassword.length < 6) {
      logApiFailure(req, 'auth.register', 'password-too-short', {
        passwordLength: normalizedPassword.length
      });
      return res
        .status(400)
        .json({ message: 'Password must be at least 6 characters.' });
    }

    const existing = await findUserByEmail(normalizedEmail);
    if (existing) {
      logApiFailure(req, 'auth.register', 'account-already-exists');
      return res
        .status(409)
        .json({ message: 'Account already exists. Please sign in.' });
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
    return res
      .status(500)
      .json({ message: 'Registration failed.', detail: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email = '', password = '' } = req.body || {};
    const normalizedEmail = normalizeEmail(email);
    const normalizedPassword = String(password || '').trim();

    if (!normalizedEmail || !normalizedPassword) {
      logApiFailure(req, 'auth.login', 'missing-email-or-password');
      return res
        .status(400)
        .json({ message: 'Email and password are required.' });
    }

    const user = await findUserByEmail(normalizedEmail);
    if (!user || !user.password) {
      logApiFailure(req, 'auth.login', 'invalid-credentials:user-not-found');
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const matched = await bcrypt.compare(normalizedPassword, user.password);
    if (!matched) {
      logApiFailure(req, 'auth.login', 'invalid-credentials:password-mismatch');
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    return res.json(getSessionResponse(user));
  } catch (error) {
    logApiFailure(req, 'auth.login', error);
    return res
      .status(500)
      .json({ message: 'Login failed.', detail: error.message });
  }
});

app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email = '' } = req.body || {};
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail) {
      logApiFailure(req, 'auth.forgot-password', 'missing-email');
      return res.status(400).json({ message: 'Email is required.' });
    }

    const responsePayload = {
      message: 'If this email exists, reset instructions have been sent.'
    };

    const user = await findUserByEmail(normalizedEmail);
    if (user) {
      const resetCode = String(Math.floor(100000 + Math.random() * 900000));
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

      await runSql(
        'UPDATE password_resets SET used = TRUE WHERE email = $1 AND used = FALSE',
        [normalizedEmail]
      );

      await runSql(
        'INSERT INTO password_resets (email, code, expires_at, used) VALUES ($1, $2, $3, FALSE)',
        [normalizedEmail, resetCode, expiresAt]
      );

      console.log(
        `[password-reset] ${normalizedEmail} code: ${resetCode} (expires: ${expiresAt})`
      );

      if (process.env.NODE_ENV !== 'production') {
        responsePayload.devResetCode = resetCode;
        responsePayload.devExpiresAt = expiresAt;
      }
    }

    return res.json(responsePayload);
  } catch (error) {
    logApiFailure(req, 'auth.forgot-password', error);
    return res.status(500).json({
      message: 'Forgot password request failed.',
      detail: error.message
    });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { email = '', code = '', newPassword = '' } = req.body || {};
    const normalizedEmail = normalizeEmail(email);
    const normalizedCode = String(code || '').trim();
    const normalizedNewPassword = String(newPassword || '').trim();

    if (!normalizedEmail || !normalizedCode || !normalizedNewPassword) {
      logApiFailure(req, 'auth.reset-password', 'missing-required-fields');
      return res
        .status(400)
        .json({ message: 'Email, code and new password are required.' });
    }

    if (normalizedNewPassword.length < 6) {
      logApiFailure(req, 'auth.reset-password', 'new-password-too-short', {
        passwordLength: normalizedNewPassword.length
      });
      return res
        .status(400)
        .json({ message: 'New password must be at least 6 characters.' });
    }

    const resetRow = await getSql(
      `
        SELECT id, email, code, expires_at AS "expiresAt", used
        FROM password_resets
        WHERE email = $1 AND code = $2 AND used = FALSE
        ORDER BY id DESC
        LIMIT 1
      `,
      [normalizedEmail, normalizedCode]
    );

    if (!resetRow) {
      logApiFailure(req, 'auth.reset-password', 'invalid-or-expired-reset-code');
      return res.status(400).json({ message: 'Invalid or expired reset code.' });
    }

    const expiresAt = new Date(resetRow.expiresAt).getTime();
    if (Number.isNaN(expiresAt) || expiresAt < Date.now()) {
      await runSql('UPDATE password_resets SET used = TRUE WHERE id = $1', [
        resetRow.id
      ]);
      logApiFailure(req, 'auth.reset-password', 'reset-code-expired');
      return res.status(400).json({
        message: 'Reset code has expired. Please request a new one.'
      });
    }

    const user = await findUserByEmail(normalizedEmail);
    if (!user) {
      logApiFailure(req, 'auth.reset-password', 'user-not-found');
      return res.status(404).json({ message: 'User not found.' });
    }

    const hashedPassword = await bcrypt.hash(normalizedNewPassword, 10);
    await updateUserRecord(user, {
      password: hashedPassword,
      authProvider: 'local'
    });

    await runSql('UPDATE password_resets SET used = TRUE WHERE id = $1', [
      resetRow.id
    ]);

    return res.json({ message: 'Password updated successfully. Please sign in.' });
  } catch (error) {
    logApiFailure(req, 'auth.reset-password', error);
    return res
      .status(500)
      .json({ message: 'Reset password failed.', detail: error.message });
  }
});

app.post('/api/auth/google', async (req, res) => {
  try {
    if (!GOOGLE_CLIENT_ID) {
      logApiFailure(req, 'auth.google', 'google-client-id-missing');
      return res
        .status(500)
        .json({ message: 'Server Google client ID is not configured.' });
    }

    const { credential = '' } = req.body || {};
    if (!credential) {
      logApiFailure(req, 'auth.google', 'missing-credential');
      return res.status(400).json({ message: 'Google credential is required.' });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    const email = normalizeEmail(payload?.email);

    if (!email) {
      logApiFailure(req, 'auth.google', 'google-email-missing');
      return res
        .status(400)
        .json({ message: 'Google account email not available.' });
    }

    const name = payload?.name || email.split('@')[0];
    const picture = payload?.picture || '';

    let user = await findUserByEmail(email);
    if (!user) {
      user = await createUserRecord({
        name,
        email,
        picture,
        authProvider: 'google'
      });
    } else {
      user = await updateUserRecord(user, {
        name,
        picture,
        authProvider: 'google'
      });
    }

    return res.json(getSessionResponse(user));
  } catch (error) {
    logApiFailure(req, 'auth.google', error);
    return res
      .status(401)
      .json({ message: 'Google sign-in failed.', detail: error.message });
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
    await pool.query('SELECT 1');
    const pingEndedAtNs = process.hrtime.bigint();
    pingLatencyMs = Number(pingEndedAtNs - pingStartedAtNs) / 1_000_000;
    pingOk = true;
  } catch (error) {
    pingError = error.message;
  }

  const healthEndedAtNs = process.hrtime.bigint();
  const healthLatencyMs = Number(healthEndedAtNs - healthStartedAtNs) / 1_000_000;
  const uptimeSeconds = Math.floor(process.uptime());
  const startedAt = new Date(SERVER_STARTED_AT_MS).toISOString();

  return res.json({
    ok: isSqlReady && pingOk,
    service: 'rahman-restaurant-api',
    uptimeSeconds,
    startedAt,
    db: {
      type: 'sql',
      engine: 'postgresql',
      initialized: isSqlReady,
      connected: pingOk,
      pingLatencyMs,
      mode: isSqlReady ? 'sql' : 'not-ready',
      url: DATABASE_URL.replace(/:[^:@/]+@/, ':****@'),
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
    if (!user) {
      logApiFailure(req, 'auth.me', 'user-not-found', { userId: req.auth.id });
      return res.status(404).json({ message: 'User not found.' });
    }

    return res.json({
      user: {
        id: getUserId(user),
        name: user.name || user.email,
        email: user.email,
        picture: user.picture || ''
      }
    });
  } catch (error) {
    logApiFailure(req, 'auth.me', error, { userId: req.auth?.id || null });
    return res
      .status(500)
      .json({ message: 'Failed to fetch profile.', detail: error.message });
  }
});

app.post('/api/activity/track', requireAuth, async (req, res) => {
  try {
    const { actionType, description, itemId } = req.body || {};
    await runSql(
      'INSERT INTO activities (user_id, email, action_type, description, item_id) VALUES ($1, $2, $3, $4, $5)',
      [req.auth.id, req.auth.email, actionType || null, description || null, itemId || null]
    );
    return res.json({ success: true, message: 'Activity tracked' });
  } catch (error) {
    return res
      .status(500)
      .json({ message: 'Failed to track activity', detail: error.message });
  }
});

app.get('/api/activity/history', requireAuth, async (req, res) => {
  try {
    const activities = await allSql(
      'SELECT id, user_id AS "userId", email, action_type AS "actionType", description, item_id AS "itemId", timestamp FROM activities WHERE user_id = $1 ORDER BY timestamp DESC LIMIT 50',
      [req.auth.id]
    );
    return res.json({ activities });
  } catch (error) {
    return res
      .status(500)
      .json({ message: 'Failed to fetch activity', detail: error.message });
  }
});

app.post('/api/favorites/add', requireAuth, async (req, res) => {
  try {
    const { itemId } = req.body || {};
    const user = await findUserById(req.auth.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const favorites = [...(user.favorites || [])];
    if (itemId && !favorites.includes(itemId)) {
      favorites.push(itemId);
      await updateUserRecord(user, { favorites });
      await runSql(
        'INSERT INTO activities (user_id, email, action_type, description, item_id) VALUES ($1, $2, $3, $4, $5)',
        [
          req.auth.id,
          req.auth.email,
          'favorite',
          `Added item ${itemId} to favorites`,
          itemId
        ]
      );
    }

    return res.json({ success: true, message: 'Added to favorites' });
  } catch (error) {
    return res
      .status(500)
      .json({ message: 'Failed to add favorite', detail: error.message });
  }
});

app.post('/api/favorites/remove', requireAuth, async (req, res) => {
  try {
    const { itemId } = req.body || {};
    const user = await findUserById(req.auth.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const favorites = (user.favorites || []).filter((id) => id !== itemId);
    await updateUserRecord(user, { favorites });

    return res.json({ success: true, message: 'Removed from favorites' });
  } catch (error) {
    return res
      .status(500)
      .json({ message: 'Failed to remove favorite', detail: error.message });
  }
});

app.get('/api/favorites/list', requireAuth, async (req, res) => {
  try {
    const user = await findUserById(req.auth.id);
    return res.json({ favorites: user?.favorites || [] });
  } catch (error) {
    return res
      .status(500)
      .json({ message: 'Failed to fetch favorites', detail: error.message });
  }
});

app.post('/api/orders/add', requireAuth, async (req, res) => {
  try {
    const { items, total, orderId } = req.body || {};
    const user = await findUserById(req.auth.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

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

    await runSql(
      'INSERT INTO activities (user_id, email, action_type, description, item_id) VALUES ($1, $2, $3, $4, $5)',
      [
        req.auth.id,
        req.auth.email,
        'order',
        `Placed order for Rs. ${nextOrder.total}`,
        nextOrder.orderId
      ]
    );

    return res.json({ success: true, message: 'Order saved' });
  } catch (error) {
    return res
      .status(500)
      .json({ message: 'Failed to save order', detail: error.message });
  }
});

app.get('/api/orders/history', requireAuth, async (req, res) => {
  try {
    const user = await findUserById(req.auth.id);
    return res.json({ orders: user?.orderHistory || [] });
  } catch (error) {
    return res
      .status(500)
      .json({ message: 'Failed to fetch orders', detail: error.message });
  }
});

app.post('/api/reviews/add', requireAuth, async (req, res) => {
  try {
    const { rating, text, textUrdu } = req.body || {};
    const user = await findUserById(req.auth.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const result = await runSql(
      `
        INSERT INTO reviews (user_id, user_name, user_email, rating, text, text_urdu)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `,
      [
        req.auth.id,
        user.name || user.email,
        req.auth.email,
        Number(rating || 0),
        text || '',
        textUrdu || ''
      ]
    );

    await runSql(
      'INSERT INTO activities (user_id, email, action_type, description, item_id) VALUES ($1, $2, $3, $4, $5)',
      [
        req.auth.id,
        req.auth.email,
        'review',
        `Posted a ${rating}-star review`,
        String(result.lastID)
      ]
    );

    return res.json({ success: true, message: 'Review posted' });
  } catch (error) {
    return res
      .status(500)
      .json({ message: 'Failed to post review', detail: error.message });
  }
});

app.get('/api/reviews/all', async (req, res) => {
  try {
    const reviews = await allSql(
      'SELECT id, user_id AS "userId", user_name AS "userName", user_email AS "userEmail", rating, text, text_urdu AS "textUrdu", date FROM reviews ORDER BY date DESC LIMIT 100'
    );
    return res.json({ reviews });
  } catch (error) {
    return res
      .status(500)
      .json({ message: 'Failed to fetch reviews', detail: error.message });
  }
});

app.get('/api/restaurant/info', async (req, res) => {
  try {
    return res.json({
      name: 'RAHMAN',
      nameUrdu: 'رحمان',
      description: 'Welcome to RAHMAN Restaurant - Your Culinary Paradise',
      descriptionUrdu: 'رحمان ریستوران میں خوش آمدید - آپ کے ذائقے کی جنت',
      phone: '+92-300-1234567',
      email: 'contact@rahman.com',
      address: 'Karachi, Pakistan',
      addressUrdu: 'کراچی، پاکستان',
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
          textUrdu:
            'مسالے رقص کرتے ہیں، خوشبوؤں گیت گاتی ہیں، ہر کھانے میں خوشی لاتی ہیں',
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
    return res.status(500).json({
      message: 'Failed to fetch restaurant info',
      detail: error.message
    });
  }
});

app.get('/api/reservations', async (req, res) => {
  try {
    const dateTime = String(req.query.dateTime || '').trim();
    const tableNumber = Number(req.query.tableNumber || 0);

    const clauses = [];
    const params = [];

    if (dateTime) {
      params.push(dateTime);
      clauses.push(`date_time = $${params.length}::timestamptz`);
    }

    if (tableNumber > 0) {
      params.push(tableNumber);
      clauses.push(`table_number = $${params.length}`);
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    const reservations = await allSql(
      `
        SELECT
          id,
          user_id AS "userId",
          user_email AS "userEmail",
          name,
          email,
          phone,
          date_time AS "dateTime",
          guests,
          table_number AS "tableNumber",
          whatsapp_opt_in AS "whatsappOptIn",
          whatsapp_delivery AS "whatsappDelivery",
          status,
          created_at AS "createdAt"
        FROM reservations
        ${where}
        ORDER BY date_time ASC, table_number ASC
      `,
      params
    );

    return res.json({ reservations });
  } catch (error) {
    logApiFailure(req, 'reservation.list', error);
    return res.status(500).json({
      message: 'Failed to fetch reservations',
      detail: error.message
    });
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
      logApiFailure(req, 'reservation.create', 'missing-required-fields');
      return res.status(400).json({ message: 'All reservation fields are required.' });
    }

    if (payload.guests < 1 || payload.guests > 10) {
      logApiFailure(req, 'reservation.create', 'invalid-guests', {
        guests: payload.guests
      });
      return res.status(400).json({ message: 'Guests must be between 1 and 10.' });
    }

    if (payload.tableNumber < 1 || payload.tableNumber > 50) {
      logApiFailure(req, 'reservation.create', 'invalid-table-number', {
        tableNumber: payload.tableNumber
      });
      return res.status(400).json({ message: 'Table number must be between 1 and 50.' });
    }

    const existing = await getSql(
      'SELECT id FROM reservations WHERE table_number = $1 AND date_time = $2::timestamptz LIMIT 1',
      [payload.tableNumber, payload.dateTime]
    );

    if (existing) {
      logApiFailure(req, 'reservation.create', 'slot-already-booked', {
        tableNumber: payload.tableNumber,
        dateTime: payload.dateTime
      });
      return res.status(409).json({ message: 'Table is already reserved for this slot.' });
    }

    let notificationStatus = {
      admin: { sent: false, reason: 'not-attempted' },
      customer: { sent: false, reason: 'not-attempted' }
    };

    if (whatsAppService.isEnabled()) {
      try {
        notificationStatus.admin =
          await whatsAppService.sendReservationNotification(payload);
      } catch (error) {
        logApiFailure(req, 'reservation.create.whatsapp.admin', error);
        notificationStatus.admin = {
          sent: false,
          reason: 'send-failed',
          detail: error.message
        };
      }

      try {
        notificationStatus.customer =
          await whatsAppService.sendReservationConfirmation(payload);
      } catch (error) {
        logApiFailure(req, 'reservation.create.whatsapp.customer', error);
        notificationStatus.customer = {
          sent: false,
          reason: 'send-failed',
          detail: error.message
        };
      }
    }

    const result = await runSql(
      `
        INSERT INTO reservations (
          user_id,
          user_email,
          name,
          email,
          phone,
          date_time,
          guests,
          table_number,
          whatsapp_opt_in,
          whatsapp_delivery,
          status
        )
        VALUES ($1, $2, $3, $4, $5, $6::timestamptz, $7, $8, $9, $10::jsonb, 'booked')
        RETURNING id
      `,
      [
        auth?.id || null,
        auth?.email || null,
        payload.name,
        payload.email,
        payload.phone,
        payload.dateTime,
        payload.guests,
        payload.tableNumber,
        payload.whatsappOptIn,
        JSON.stringify(notificationStatus)
      ]
    );

    const reservation = await getSql(
      `
        SELECT
          id,
          user_id AS "userId",
          user_email AS "userEmail",
          name,
          email,
          phone,
          date_time AS "dateTime",
          guests,
          table_number AS "tableNumber",
          whatsapp_opt_in AS "whatsappOptIn",
          whatsapp_delivery AS "whatsappDelivery",
          status,
          created_at AS "createdAt"
        FROM reservations
        WHERE id = $1
      `,
      [result.lastID]
    );

    const whatsappLink = getReservationWhatsAppLink(payload);
    console.log('[reservation] WhatsApp notify:', whatsappLink);

    return res.status(201).json({
      success: true,
      reservation,
      whatsappLink,
      whatsappDelivery: notificationStatus,
      providerHint:
        whatsAppService.isEnabled()
          ? ''
          : 'Set WHATSAPP_PROVIDER=meta or twilio in .env to enable automated sends.'
    });
  } catch (error) {
    logApiFailure(req, 'reservation.create', error);
    return res.status(500).json({
      message: 'Failed to create reservation',
      detail: error.message
    });
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
    return res.status(500).json({
      message: 'Failed to process WhatsApp webhook',
      detail: error.message
    });
  }
});

app.post('/api/whatsapp/twilio', async (req, res) => {
  try {
    const result = await whatsAppService.handleTwilioWebhook(req.body || {});
    return res.status(200).type('text/xml').send(`<Response></Response>`);
  } catch (error) {
    return res
      .status(500)
      .type('text/xml')
      .send(`<Response><Message>Temporary issue. Please retry later.</Message></Response>`);
  }
});

app.get('/dashboard', requireAuth, (req, res) => {
  res.send('Welcome to dashboard');
});

app.get('/', (req, res) => {
  res.sendFile(path.join(APP_ROOT, 'login.html'));
});

app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  console.error('[unhandled-error]', {
    method: req.method,
    path: req.originalUrl || req.url,
    message: error?.message || String(error),
    at: new Date().toISOString()
  });

  const payload = { message: 'Internal server error' };
  if (!IS_PRODUCTION) {
    payload.detail = error?.message || String(error);
  }

  return res.status(500).json(payload);
});

function scheduleSqlInitRetry() {
  setTimeout(() => {
    initSql()
      .then(() => {
        dbInitError = '';
      })
      .catch((error) => {
        dbInitError = error?.message || String(error);
        console.error('PostgreSQL initialization retry failed:', dbInitError);
        if (error?.stack) {
          console.error(error.stack);
        }
        scheduleSqlInitRetry();
      });
  }, DB_INIT_RETRY_MS);
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

initSql().catch((error) => {
  dbInitError = error?.message || String(error);
  console.error('PostgreSQL initialization failed:', dbInitError);
  if (error?.stack) {
    console.error(error.stack);
  }
  console.error('DATABASE_URL:', DATABASE_URL.replace(/:[^:@/]+@/, ':****@'));
  console.error(`Retrying SQL init every ${DB_INIT_RETRY_MS}ms while keeping server online.`);
  scheduleSqlInitRetry();
});
