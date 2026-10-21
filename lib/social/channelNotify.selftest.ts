import assert from 'node:assert/strict'
import { sendTelegramChannelMessage, trimTelegramText } from './telegramChannel'
import { notifyWhatsAppPublished, sendWhatsAppNotify, toWhatsAppAddress } from './whatsappNotify'

async function main() {
  const previous = {
    bot: process.env.TELEGRAM_BOT_TOKEN,
    channel: process.env.TELEGRAM_CHANNEL_ID,
    sid: process.env.TWILIO_ACCOUNT_SID,
    auth: process.env.TWILIO_AUTH_TOKEN,
    from: process.env.TWILIO_WHATSAPP_FROM,
    to: process.env.TWILIO_WHATSAPP_TO,
  }
  process.env.TELEGRAM_BOT_TOKEN = 'test-token'
  process.env.TELEGRAM_CHANNEL_ID = '@egitim'
  process.env.TWILIO_ACCOUNT_SID = 'AC123'
  process.env.TWILIO_AUTH_TOKEN = 'secret'
  process.env.TWILIO_WHATSAPP_FROM = '+14155550100'
  process.env.TWILIO_WHATSAPP_TO = '+905551112233'

  assert.equal(trimTelegramText('kisa', 10), 'kisa')
  assert.equal(trimTelegramText('abcdefghij', 5).endsWith('…'), true)

  const calls: Array<{ url: string; body: string }> = []
  const sent = await sendTelegramChannelMessage({
    text: 'kanal metni',
    photoUrl: 'https://cdn.example/card.jpg',
    fetchImpl: async (url, init) => {
      calls.push({ url, body: String(init?.body) })
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, result: { message_id: 42 } }),
        text: async () => '',
      }
    },
  })
  assert.equal(sent.messageId, '42')
  assert.equal(sent.imageAttached, true)
  assert.match(calls[0].url, /\/bottest-token\/sendPhoto$/)
  assert.match(calls[0].body, /"chat_id":"@egitim"/)
  assert.doesNotMatch(calls[0].body, /parse_mode/)

  const waFetch: typeof fetch = async (url, init) => {
    calls.push({ url: String(url), body: String(init?.body) })
    return {
      ok: true,
      status: 201,
      json: async () => ({ sid: 'SM1' }),
      text: async () => '{"sid":"SM1"}',
    } as Response
  }
  const wa = await sendWhatsAppNotify({
    to: '+905551112233',
    body: 'deneme',
    fetchImpl: waFetch,
  })
  assert.equal(wa.ok && wa.sid, 'SM1')
  assert.equal(toWhatsAppAddress('+90555'), 'whatsapp:+90555')
  assert.match(calls[1].body, /To=whatsapp%3A%2B905551112233/)
  assert.match(String(calls[1].url), /Accounts\/AC123\/Messages.json$/)

  const beforeNotify = calls.length
  const originalFetch = globalThis.fetch
  globalThis.fetch = waFetch
  try {
    await notifyWhatsAppPublished({ platform: 'TELEGRAM', preview: 'kanal', url: 'https://t.me/egitim/1' })
  } finally {
    globalThis.fetch = originalFetch
  }
  assert.equal(calls.length, beforeNotify + 1)
  assert.match(calls[beforeNotify].body, /Content[+ ]Studio/)

  process.env.TELEGRAM_BOT_TOKEN = previous.bot
  process.env.TELEGRAM_CHANNEL_ID = previous.channel
  process.env.TWILIO_ACCOUNT_SID = previous.sid
  process.env.TWILIO_AUTH_TOKEN = previous.auth
  process.env.TWILIO_WHATSAPP_FROM = previous.from
  process.env.TWILIO_WHATSAPP_TO = previous.to
  console.log('ok')
}

main()
