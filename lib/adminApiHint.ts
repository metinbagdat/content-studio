import { DEFAULT_ADMIN_API_KEY } from '@/lib/adminKey'

export function adminApiErrorMessage(statuses: number[]): string {
  const codes = [...new Set(statuses.filter((s) => s > 0))].join(', ') || '?'
  if (statuses.includes(401)) {
    return `Yetkisiz (${codes}) — Admin API key, Vercel/.env içindeki ADMIN_API_KEY ile aynı olmalı. Prod'da ${DEFAULT_ADMIN_API_KEY} çalışmaz (localStorage cs_admin_key temizleyip yeniden deneyin).`
  }
  if (statuses.includes(500)) {
    return `Sunucu hatası (${codes}) — DATABASE_URL veya Prisma; prod'da Vercel env + redeploy kontrol edin.`
  }
  return `API hatası (${codes}) — admin key ve sunucu env kontrol edin.`
}
