/**
 * One Twilio WhatsApp message to a known number.
 * Student templates, orders, and consent stay in LearnCon.
 */

export type WhatsAppFetch = (
  url: string,
  init?: RequestInit,
) => Promise<{ ok: boolean; status: number; text: () => Promise<string> }>

export function whatsAppNotifyTo(): string | undefined {
  const to = process.env.TWILIO_WHATSAPP_TO?.trim() || process.env.ADMIN_ALERT_PHONE?.trim()
  return to || undefined
}

export function whatsAppNotifyConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID?.trim() &&
      process.env.TWILIO_AUTH_TOKEN?.trim() &&
      process.env.TWILIO_WHATSAPP_FROM?.trim(),
  )
}

export function toWhatsAppAddress(to: string): string {
  const trimmed = to.trim()
  return trimmed.startsWith('whatsapp:') ? trimmed : `whatsapp:${trimmed}`
}

export async function sendWhatsAppNotify(input: {
  to: string
  body: string
  fetchImpl?: WhatsAppFetch
}): Promise<{ ok: true; sid?: string } | { ok: false; error: string }> {
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim()
  const token = process.env.TWILIO_AUTH_TOKEN?.trim()
  const from = process.env.TWILIO_WHATSAPP_FROM?.trim()
  if (!sid || !token || !from) return { ok: false, error: 'Twilio WhatsApp env eksik' }
  const to = input.to?.trim()
  const body = input.body?.trim()
  if (!to || !body) return { ok: false, error: 'alıcı veya metin eksik' }

  const fetchImpl = input.fetchImpl || fetch
  const res = await fetchImpl(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        From: toWhatsAppAddress(from),
        To: toWhatsAppAddress(to),
        Body: body.slice(0, 1600),
      }),
    },
  )
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 300)
    return { ok: false, error: `Twilio ${res.status}: ${detail}` }
  }
  const data = JSON.parse(await res.text()) as { sid?: string }
  return { ok: true, sid: data.sid }
}

/** One admin ping after a channel post goes live. Failures stay in the log. */
export async function notifyWhatsAppPublished(input: {
  platform: string
  preview: string
  url?: string | null
}): Promise<void> {
  const to = whatsAppNotifyTo()
  if (!whatsAppNotifyConfigured() || !to) return
  const preview = input.preview.replace(/\s+/g, ' ').trim().slice(0, 280)
  const url = input.url?.trim()
  const body = [`Content Studio yayınlandı: ${input.platform}`, preview, url].filter(Boolean).join('\n')
  const result = await sendWhatsAppNotify({ to, body })
  if (!result.ok) console.warn('[whatsappNotify]', result.error)
}
