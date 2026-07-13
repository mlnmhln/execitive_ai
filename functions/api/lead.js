/**
 * Cloudflare Pages Function: /api/lead
 *
 * Принимает POST-запрос с данными заявки, валидирует их,
 * проверяет honeypot и отправляет уведомление в Telegram.
 *
 * Переменные окружения (задаются в Cloudflare Pages → Settings → Environment variables):
 *   BOT_TOKEN  — токен Telegram-бота от @BotFather
 *   CHAT_ID    — ID чата / канала / группы, куда приходят уведомления
 */

export async function onRequestPost({ request, env }) {
  // ── 1. CORS-заголовки (запросы только со своего домена) ──────────────────
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',   // при желании замените на 'https://executive-ai.tech'
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  // ── 2. Читаем тело запроса ──────────────────────────────────────────────
  let data;
  try {
    data = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ success: false, error: 'Invalid JSON' }),
      { status: 400, headers: corsHeaders }
    );
  }

  // ── 3. Honeypot-защита ──────────────────────────────────────────────────
  // Если скрытое поле «website» заполнено — это бот, молча отбрасываем.
  if (data.website && data.website.trim() !== '') {
    // Возвращаем 200, чтобы бот не знал, что его поймали
    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: corsHeaders }
    );
  }

  // ── 4. Валидация обязательных полей ────────────────────────────────────
  const name  = (data.name  || '').trim();
  const telegram = (data.telegram || '').trim();
  const phone = (data.phone || '').trim();
  const consent = data.consent === true || data.consent === 'true' || data.consent === 'on';

  if (!name || !telegram || !phone) {
    return new Response(
      JSON.stringify({ success: false, error: 'Обязательные поля не заполнены' }),
      { status: 422, headers: corsHeaders }
    );
  }

  if (!consent) {
    return new Response(
      JSON.stringify({ success: false, error: 'Необходимо согласие на обработку персональных данных' }),
      { status: 422, headers: corsHeaders }
    );
  }

  // ── 5. Проверяем наличие переменных окружения ───────────────────────────
  const botToken = env.BOT_TOKEN;
  const chatId   = env.CHAT_ID;

  if (!botToken || !chatId) {
    console.error('[lead] BOT_TOKEN or CHAT_ID not configured');
    return new Response(
      JSON.stringify({ success: false, error: 'Server misconfigured' }),
      { status: 500, headers: corsHeaders }
    );
  }

  // ── 6. Формируем текст сообщения ────────────────────────────────────────
  const comment   = (data.comment || '').trim();
  const source    = (data.source  || '—').trim();
  const now       = new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });

  const text =
    '🚀 *Новая заявка — Executive AI*\n\n' +
    `👤 *Имя:* ${escapeMarkdown(name)}\n` +
    `📞 *Телефон:* ${escapeMarkdown(phone)}\n` +
    `💬 *Telegram:* ${escapeMarkdown(telegram)}\n` +
    (comment ? `💬 *Комментарий:* ${escapeMarkdown(comment)}\n` : '') +
    `📍 *Источник:* ${escapeMarkdown(source)}\n` +
    `🕒 ${now}`;

  // ── 7. Отправляем в Telegram ────────────────────────────────────────────
  try {
    const tgUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const tgResp = await fetch(tgUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id:    chatId,
        text:       text,
        parse_mode: 'Markdown',
      }),
    });

    if (!tgResp.ok) {
      const errBody = await tgResp.text();
      console.error('[lead] Telegram API error:', tgResp.status, errBody);
      return new Response(
        JSON.stringify({ success: false, error: 'Telegram delivery failed' }),
        { status: 502, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    console.error('[lead] Fetch error:', err);
    return new Response(
      JSON.stringify({ success: false, error: 'Network error' }),
      { status: 502, headers: corsHeaders }
    );
  }
}

// ── OPTIONS preflight ───────────────────────────────────────────────────────
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

// ── Вспомогательная функция: экранирование символов Markdown ───────────────
function escapeMarkdown(str) {
  return String(str).replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
}
