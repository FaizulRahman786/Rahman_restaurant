const crypto = require('crypto');

function normalizePhoneNumber(phone, defaultCountryCode = '91') {
  const raw = String(phone || '').trim();
  if (!raw) return '';

  if (raw.startsWith('+')) {
    return `+${raw.replace(/\D/g, '')}`;
  }

  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';

  if (digits.length === 10) {
    return `+${defaultCountryCode}${digits}`;
  }

  return `+${digits}`;
}

function toMetaWaId(phone) {
  return normalizePhoneNumber(phone).replace(/\D/g, '');
}

function getTextFromIncomingMessage(message) {
  if (!message) return '';
  if (message.type === 'text') {
    return String(message.text?.body || '').trim();
  }
  if (message.type === 'button') {
    return String(message.button?.text || '').trim();
  }
  if (message.type === 'interactive') {
    return String(
      message.interactive?.button_reply?.title ||
        message.interactive?.list_reply?.title ||
        ''
    ).trim();
  }
  return '';
}

function buildReservationText(reservation) {
  return `New reservation: Table ${reservation.tableNumber} for ${reservation.name} at ${reservation.dateTime}. Guests: ${reservation.guests}, Phone: ${reservation.phone}`;
}

async function postJson(url, payload, headers = {}) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers
    },
    body: JSON.stringify(payload)
  });

  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    throw new Error(`WhatsApp API error (${response.status}): ${JSON.stringify(data)}`);
  }

  return data;
}

async function postForm(url, form, basicAuth) {
  const body = new URLSearchParams(form);
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(basicAuth).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body
  });

  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    throw new Error(`Twilio API error (${response.status}): ${JSON.stringify(data)}`);
  }

  return data;
}

class WhatsAppService {
  constructor(config = {}) {
    this.config = {
      provider: String(config.provider || 'none').toLowerCase(),
      adminNumber: normalizePhoneNumber(config.adminNumber || ''),
      defaultCountryCode: String(config.defaultCountryCode || '91'),
      metaAccessToken: config.metaAccessToken || '',
      metaPhoneNumberId: config.metaPhoneNumberId || '',
      metaApiVersion: config.metaApiVersion || 'v20.0',
      metaVerifyToken: config.metaVerifyToken || '',
      metaAppSecret: config.metaAppSecret || '',
      twilioAccountSid: config.twilioAccountSid || '',
      twilioAuthToken: config.twilioAuthToken || '',
      twilioWhatsAppFrom: config.twilioWhatsAppFrom || '',
      reservationTemplateName: config.reservationTemplateName || '',
      openAiApiKey: config.openAiApiKey || '',
      openAiModel: config.openAiModel || 'gpt-4o-mini'
    };

    this.sessions = new Map();
  }

  isEnabled() {
    return this.config.provider === 'meta' || this.config.provider === 'twilio';
  }

  shouldVerifyMetaSignature() {
    return this.config.provider === 'meta' && Boolean(this.config.metaAppSecret);
  }

  verifyMetaSignature(rawBody, signatureHeader) {
    if (!this.shouldVerifyMetaSignature()) return true;
    if (!rawBody || !signatureHeader) return false;

    const expected = crypto
      .createHmac('sha256', this.config.metaAppSecret)
      .update(rawBody)
      .digest('hex');

    const provided = String(signatureHeader || '').replace(/^sha256=/, '').trim();

    try {
      return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
    } catch {
      return false;
    }
  }

  async sendText(to, text) {
    const normalized = normalizePhoneNumber(to, this.config.defaultCountryCode);
    if (!normalized) {
      return { sent: false, reason: 'missing-recipient' };
    }

    if (!this.isEnabled()) {
      return { sent: false, reason: 'provider-disabled', recipient: normalized };
    }

    if (this.config.provider === 'meta') {
      const url = `https://graph.facebook.com/${this.config.metaApiVersion}/${this.config.metaPhoneNumberId}/messages`;
      const payload = {
        messaging_product: 'whatsapp',
        to: toMetaWaId(normalized),
        type: 'text',
        text: { body: text }
      };

      const data = await postJson(url, payload, {
        Authorization: `Bearer ${this.config.metaAccessToken}`
      });

      return {
        sent: true,
        provider: 'meta',
        recipient: normalized,
        messageId: data?.messages?.[0]?.id || ''
      };
    }

    const sid = this.config.twilioAccountSid;
    const token = this.config.twilioAuthToken;
    const from = this.config.twilioWhatsAppFrom;

    const data = await postForm(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        From: `whatsapp:${normalizePhoneNumber(from, this.config.defaultCountryCode)}`,
        To: `whatsapp:${normalized}`,
        Body: text
      },
      `${sid}:${token}`
    );

    return {
      sent: true,
      provider: 'twilio',
      recipient: normalized,
      messageId: data?.sid || ''
    };
  }

  async sendTemplate(to, templateName, bodyVariables = []) {
    const normalized = normalizePhoneNumber(to, this.config.defaultCountryCode);
    if (!normalized) {
      return { sent: false, reason: 'missing-recipient' };
    }

    if (this.config.provider !== 'meta') {
      return { sent: false, reason: 'template-only-supported-on-meta' };
    }

    const url = `https://graph.facebook.com/${this.config.metaApiVersion}/${this.config.metaPhoneNumberId}/messages`;
    const payload = {
      messaging_product: 'whatsapp',
      to: toMetaWaId(normalized),
      type: 'template',
      template: {
        name: templateName,
        language: { code: 'en_US' },
        components: [
          {
            type: 'body',
            parameters: bodyVariables.map((value) => ({
              type: 'text',
              text: String(value)
            }))
          }
        ]
      }
    };

    const data = await postJson(url, payload, {
      Authorization: `Bearer ${this.config.metaAccessToken}`
    });

    return {
      sent: true,
      provider: 'meta',
      recipient: normalized,
      messageId: data?.messages?.[0]?.id || ''
    };
  }

  async sendReservationNotification(reservation) {
    if (!this.config.adminNumber) {
      return { sent: false, reason: 'missing-admin-number' };
    }

    const text = buildReservationText(reservation);
    return this.sendText(this.config.adminNumber, text);
  }

  async sendReservationConfirmation(reservation) {
    if (!reservation.whatsappOptIn) {
      return { sent: false, reason: 'customer-not-opted-in' };
    }

    const target = normalizePhoneNumber(
      reservation.phone,
      this.config.defaultCountryCode
    );

    if (!target) {
      return { sent: false, reason: 'invalid-customer-phone' };
    }

    if (
      this.config.provider === 'meta' &&
      this.config.reservationTemplateName
    ) {
      try {
        return await this.sendTemplate(target, this.config.reservationTemplateName, [
          reservation.name,
          String(reservation.tableNumber),
          reservation.dateTime,
          String(reservation.guests)
        ]);
      } catch (error) {
        return {
          sent: false,
          reason: 'template-send-failed',
          detail: error.message
        };
      }
    }

    const text = `Hi ${reservation.name}, your reservation is confirmed at RAHMAN Restaurant. Table ${reservation.tableNumber}, ${reservation.dateTime}, Guests: ${reservation.guests}. Reply HELP for support.`;
    return this.sendText(target, text);
  }

  getSession(from) {
    if (!this.sessions.has(from)) {
      this.sessions.set(from, { intent: '', createdAt: Date.now() });
    }
    return this.sessions.get(from);
  }

  detectIntent(text) {
    const input = String(text || '').toLowerCase();
    if (/book|reserve|reservation|table/.test(input)) return 'reservation';
    if (/menu|dish|food|item|price/.test(input)) return 'menu';
    if (/hello|hi|hey|start/.test(input)) return 'greeting';
    if (/confirm|status|check/.test(input)) return 'confirmation';
    if (/help|support/.test(input)) return 'help';
    return 'fallback';
  }

  async maybeOpenAiReply(userText, intent) {
    if (!this.config.openAiApiKey) {
      return '';
    }

    const prompt = [
      'You are a concise WhatsApp assistant for RAHMAN Restaurant.',
      'Reply in under 2 short sentences.',
      'If booking related, direct user to website reservation or ask date/time and guests.',
      `Detected intent: ${intent}`,
      `User message: ${userText}`
    ].join('\n');

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.openAiApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.config.openAiModel,
          temperature: 0.3,
          messages: [{ role: 'user', content: prompt }]
        })
      });

      if (!response.ok) return '';
      const data = await response.json();
      return String(data?.choices?.[0]?.message?.content || '').trim();
    } catch {
      return '';
    }
  }

  getDefaultBotReply(intent) {
    switch (intent) {
      case 'greeting':
        return 'Welcome to RAHMAN Restaurant! You can book a table, ask for menu highlights, or check a reservation.';
      case 'reservation':
        return 'For instant booking, use our website reservation form. Share your preferred date/time, guests, and we can guide you.';
      case 'menu':
        return 'Today\'s popular items include Butter Chicken, Tandoori Chicken, and Chana Masala. Want veg or non-veg suggestions?';
      case 'confirmation':
        return 'Please share your name and reservation date/time, and our team will confirm availability.';
      case 'help':
        return 'Type BOOK TABLE, MENU, or STATUS. You can also call us directly for urgent support.';
      default:
        return 'I can help with table bookings, menu queries, and reservation confirmations. Type HELP to see options.';
    }
  }

  async buildBotReply(from, text) {
    const session = this.getSession(from);
    const intent = this.detectIntent(text);
    session.intent = intent;
    session.lastMessageAt = Date.now();

    const aiReply = await this.maybeOpenAiReply(text, intent);
    return aiReply || this.getDefaultBotReply(intent);
  }

  async handleMetaWebhook(payload) {
    const entries = Array.isArray(payload?.entry) ? payload.entry : [];
    let processedMessages = 0;

    for (const entry of entries) {
      const changes = Array.isArray(entry?.changes) ? entry.changes : [];
      for (const change of changes) {
        const messages = change?.value?.messages || [];
        for (const message of messages) {
          const from = normalizePhoneNumber(message?.from || '');
          const text = getTextFromIncomingMessage(message);
          if (!from || !text) continue;

          const reply = await this.buildBotReply(from, text);
          await this.sendText(from, reply);
          processedMessages += 1;
        }
      }
    }

    return { processedMessages };
  }

  async handleTwilioWebhook(body = {}) {
    const fromRaw = String(body.From || '').replace(/^whatsapp:/i, '');
    const from = normalizePhoneNumber(fromRaw, this.config.defaultCountryCode);
    const text = String(body.Body || '').trim();

    if (!from || !text) {
      return { processedMessages: 0 };
    }

    const reply = await this.buildBotReply(from, text);
    await this.sendText(from, reply);
    return { processedMessages: 1 };
  }
}

function createWhatsAppService(config) {
  return new WhatsAppService(config);
}

module.exports = {
  createWhatsAppService,
  normalizePhoneNumber,
  buildReservationText
};
