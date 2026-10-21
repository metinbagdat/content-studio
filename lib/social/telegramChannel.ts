/**
 * Telegram channel publish. The bot is a channel admin.
 * Student linking, coach replies, and consent broadcasts stay in LearnCon.
 */

const TEXT_MAX = 4096
const CAPTION_MAX = 1024

export type TelegramFetch = (
  url: string,
  init?: RequestInit,
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown>; text: () => Promise<string> }>

export function telegramBotToken(): string | undefined {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim()
  return token || undefined
}

export function telegramChannelId(): string | undefined {
  const id = process.env.TELEGRAM_CHANNEL_ID?.trim()
  return id || undefined
}

export function telegramChannelConfigured(): boolean {
  return Boolean(telegramBotToken() && telegramChannelId())
}

export function trimTelegramText(text: string, max: number): string {
  const trimmed = text.trim()
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max - 1).trim()}…`
}

function publicPhotoUrl(url: string | null | undefined): string | undefined {
  const value = url?.trim()
  if (!value || !/^https:\/\//i.test(value)) return undefined
  return value
}

async function telegramCall(
  method: string,
  body: Record<string, unknown>,
  fetchImpl: TelegramFetch,
): Promise<{ ok: true; result: Record<string, unknown> } | { ok: false; error: string }> {
  const token = telegramBotToken()
  if (!token) return { ok: false, error: 'TELEGRAM_BOT_TOKEN eksik' }
  const res = await fetchImpl(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 300)
    return { ok: false, error: `Telegram ${method} ${res.status}: ${detail}` }
  }
  const data = (await res.json()) as { ok?: boolean; result?: Record<string, unknown>; description?: string }
  if (!data.ok || !data.result) {
    return { ok: false, error: data.description || `Telegram ${method} reddetti` }
  }
  return { ok: true, result: data.result }
}

export async function sendTelegramChannelMessage(
  input: { text: string; photoUrl?: string | null; fetchImpl?: TelegramFetch },
): Promise<{ messageId: string; imageAttached: boolean; imageError?: string }> {
  const channelId = telegramChannelId()
  if (!channelId) throw new Error('TELEGRAM_CHANNEL_ID eksik')
  const fetchImpl = input.fetchImpl || fetch
  const photo = publicPhotoUrl(input.photoUrl)
  if (photo) {
    const caption = trimTelegramText(input.text, CAPTION_MAX)
    const sent = await telegramCall(
      'sendPhoto',
      { chat_id: channelId, photo, caption },
      fetchImpl,
    )
    if (sent.ok) {
      return { messageId: String(sent.result.message_id), imageAttached: true }
    }
    const textOnly = await telegramCall(
      'sendMessage',
      { chat_id: channelId, text: trimTelegramText(input.text, TEXT_MAX) },
      fetchImpl,
    )
    if (!textOnly.ok) throw new Error(textOnly.error)
    return {
      messageId: String(textOnly.result.message_id),
      imageAttached: false,
      imageError: sent.error,
    }
  }
  const sent = await telegramCall(
    'sendMessage',
    { chat_id: channelId, text: trimTelegramText(input.text, TEXT_MAX) },
    fetchImpl,
  )
  if (!sent.ok) throw new Error(sent.error)
  return { messageId: String(sent.result.message_id), imageAttached: false }
}

export async function deleteTelegramChannelMessage(
  messageId: string,
  fetchImpl: TelegramFetch = fetch,
): Promise<{ deleted: boolean; error?: string }> {
  const channelId = telegramChannelId()
  if (!channelId || !messageId) return { deleted: false }
  const sent = await telegramCall(
    'deleteMessage',
    { chat_id: channelId, message_id: Number(messageId) },
    fetchImpl,
  )
  if (!sent.ok) return { deleted: false, error: sent.error }
  return { deleted: true }
}

/** Channel account used by drafts. The bot token stays in the environment. */
export async function ensureTelegramChannelAccount() {
  const channelId = telegramChannelId()
  if (!telegramChannelConfigured() || !channelId) return null
  const { prisma } = await import('../prisma')
  const { encryptSecret } = await import('../crypto')
  return prisma.socialMediaAccount.upsert({
    where: { platform_accountId: { platform: 'TELEGRAM', accountId: channelId } },
    update: { isActive: true, accountName: channelId, config: { channel: true, oauth: true } },
    create: {
      platform: 'TELEGRAM',
      accountName: channelId,
      accountId: channelId,
      accessToken: encryptSecret('telegram-bot'),
      isActive: true,
      config: { channel: true, oauth: true },
    },
  })
}
