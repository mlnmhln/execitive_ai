import { connect } from 'cloudflare:sockets';

const DEFAULT_SMTP_HOST = 'mail.hosting.reg.ru';
const DEFAULT_SMTP_PORT = 465;
const DEFAULT_RECIPIENTS = ['ceo@executive-ai.tech', 'team@executive-ai.tech'];

export async function onRequestPost({ request, env }) {
  const headers = jsonHeaders();
  let data;

  try {
    data = await request.json();
  } catch {
    return jsonResponse({ success: false, error: 'Invalid JSON' }, 400, headers);
  }

  if (clean(data.website, 200)) {
    return jsonResponse({ success: true }, 200, headers);
  }

  const lead = {
    name: clean(data.name, 120),
    phone: clean(data.phone, 40),
    telegram: clean(data.telegram, 120),
    comment: clean(data.comment, 2000),
    source: clean(data.source, 200) || 'Не указан',
    submittedAt: new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' }),
  };
  const consent = data.consent === true || data.consent === 'true' || data.consent === 'on';

  if (!lead.name || !lead.phone || !lead.telegram) {
    return jsonResponse({ success: false, error: 'Обязательные поля не заполнены' }, 422, headers);
  }

  if (!consent) {
    return jsonResponse(
      { success: false, error: 'Необходимо согласие на обработку персональных данных' },
      422,
      headers
    );
  }

  const smtpUser = clean(env.SMTP_USER, 254) || 'team@executive-ai.tech';
  const smtpPassword = String(env.SMTP_PASSWORD || '');
  const recipients = parseRecipients(env.LEAD_EMAIL_TO);

  if (!isEmail(smtpUser) || recipients.length === 0) {
    console.error('[lead] SMTP_USER or LEAD_EMAIL_TO is invalid');
    return jsonResponse({ success: false, error: 'Server misconfigured' }, 500, headers);
  }

  if (!smtpPassword) {
    console.warn('[lead] SMTP_PASSWORD is not configured; using Telegram-only compatibility mode');
    try {
      await duplicateToTelegram(env, lead);
      return jsonResponse({ success: true }, 200, headers);
    } catch (error) {
      console.error('[lead] Compatibility delivery failed:', safeError(error));
      return jsonResponse({ success: false, error: 'Delivery failed' }, 502, headers);
    }
  }

  try {
    await sendEmail({
      host: clean(env.SMTP_HOST, 255) || DEFAULT_SMTP_HOST,
      port: Number(env.SMTP_PORT) || DEFAULT_SMTP_PORT,
      username: smtpUser,
      password: smtpPassword,
      recipients,
      lead,
    });
  } catch (error) {
    console.error('[lead] Primary email delivery failed:', safeError(error));
    return jsonResponse({ success: false, error: 'Email delivery failed' }, 502, headers);
  }

  try {
    await duplicateToTelegram(env, lead);
  } catch (error) {
    // Email is the primary delivery channel. A Telegram outage must not lose the lead.
    console.error('[lead] Telegram duplicate failed:', safeError(error));
  }

  return jsonResponse({ success: true }, 200, headers);
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

async function sendEmail({ host, port, username, password, recipients, lead }) {
  const socket = connect(
    { hostname: host, port },
    { secureTransport: 'on', allowHalfOpen: false }
  );
  const timeout = setTimeout(() => {
    try {
      socket.close();
    } catch {
      // The socket may already be closed by the SMTP server.
    }
  }, 15000);
  const writer = socket.writable.getWriter();
  const reader = socket.readable.getReader();
  const smtp = createSmtpSession(reader, writer);

  try {
    await socket.opened;
    await smtp.expect([220]);
    await smtp.command(`EHLO executive-ai.tech`, [250]);
    await smtp.command('AUTH LOGIN', [334]);
    await smtp.command(utf8ToBase64(username), [334]);
    await smtp.command(utf8ToBase64(password), [235]);
    await smtp.command(`MAIL FROM:<${username}>`, [250]);

    for (const recipient of recipients) {
      await smtp.command(`RCPT TO:<${recipient}>`, [250, 251]);
    }

    await smtp.command('DATA', [354]);
    await smtp.write(buildEmailMessage(username, recipients, lead) + '\r\n.\r\n');
    await smtp.expect([250]);
    await smtp.command('QUIT', [221]);
  } finally {
    clearTimeout(timeout);
    writer.releaseLock();
    reader.releaseLock();
    try {
      socket.close();
    } catch {
      // The SMTP server may close the socket immediately after QUIT.
    }
  }
}

function createSmtpSession(reader, writer) {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = '';

  async function write(value) {
    await writer.write(encoder.encode(value));
  }

  async function expect(expectedCodes) {
    const lines = [];

    while (true) {
      const newline = buffer.indexOf('\n');
      if (newline === -1) {
        const { value, done } = await reader.read();
        if (done) throw new Error('SMTP connection closed unexpectedly');
        buffer += decoder.decode(value, { stream: true });
        continue;
      }

      const line = buffer.slice(0, newline).replace(/\r$/, '');
      buffer = buffer.slice(newline + 1);
      lines.push(line);

      const match = line.match(/^(\d{3})([ -])/);
      if (!match || match[2] === '-') continue;

      const code = Number(match[1]);
      if (!expectedCodes.includes(code)) {
        throw new Error(`SMTP ${code}: ${lines.join(' | ')}`);
      }
      return lines;
    }
  }

  async function command(value, expectedCodes) {
    await write(value + '\r\n');
    return expect(expectedCodes);
  }

  return { write, expect, command };
}

function buildEmailMessage(sender, recipients, lead) {
  const subject = 'Новая заявка — Executive AI';
  const body = [
    'Новая заявка — Executive AI',
    '',
    `Имя: ${lead.name}`,
    `Телефон: ${lead.phone}`,
    `Telegram: ${lead.telegram}`,
    ...(lead.comment ? [`Комментарий: ${lead.comment}`] : []),
    `Источник: ${lead.source}`,
    `Дата и время: ${lead.submittedAt} (МСК)`,
  ].join('\r\n');

  return [
    `Date: ${new Date().toUTCString()}`,
    `From: Executive AI <${sender}>`,
    `To: ${recipients.join(', ')}`,
    `Subject: =?UTF-8?B?${utf8ToBase64(subject)}?=`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    wrapBase64(utf8ToBase64(body)),
  ].join('\r\n');
}

async function duplicateToTelegram(env, lead) {
  const botToken = String(env.BOT_TOKEN || '');
  const chatId = String(env.CHAT_ID || '');
  if (!botToken || !chatId) {
    throw new Error('BOT_TOKEN or CHAT_ID is not configured');
  }

  const text =
    '🚀 *Новая заявка — Executive AI*\n\n' +
    `👤 *Имя:* ${escapeMarkdown(lead.name)}\n` +
    `📞 *Телефон:* ${escapeMarkdown(lead.phone)}\n` +
    `💬 *Telegram:* ${escapeMarkdown(lead.telegram)}\n` +
    (lead.comment ? `💬 *Комментарий:* ${escapeMarkdown(lead.comment)}\n` : '') +
    `📍 *Источник:* ${escapeMarkdown(lead.source)}\n` +
    `🕒 ${escapeMarkdown(lead.submittedAt)} МСК`;

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'MarkdownV2' }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Telegram API ${response.status}: ${body.slice(0, 500)}`);
  }
}

function parseRecipients(value) {
  const candidates = String(value || DEFAULT_RECIPIENTS.join(','))
    .split(/[;,]/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set(candidates.filter(isEmail))].slice(0, 10);
}

function isEmail(value) {
  return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value);
}

function clean(value, maxLength) {
  return String(value || '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, maxLength);
}

function utf8ToBase64(value) {
  const bytes = new TextEncoder().encode(String(value));
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

function wrapBase64(value) {
  return value.match(/.{1,76}/g)?.join('\r\n') || '';
}

function escapeMarkdown(value) {
  return String(value).replace(/[_*\[\]()~`>#+=|{}.!-]/g, '\\$&');
}

function safeError(error) {
  return error instanceof Error ? error.message : String(error);
}

function jsonHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json; charset=UTF-8',
    'Cache-Control': 'no-store',
  };
}

function jsonResponse(payload, status, headers) {
  return new Response(JSON.stringify(payload), { status, headers });
}
