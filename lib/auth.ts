import { NextRequest } from 'next/server'

export function requireAdmin(req: NextRequest): boolean {
  const key = process.env.ADMIN_API_KEY
  if (!key) return false
  const header = req.headers.get('x-admin-key') || ''
  const auth = req.headers.get('authorization') || ''
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  return header === key || bearer === key
}

export function brandCta(): string {
  const url = process.env.BRAND_URL || 'https://egitim.today'
  const name = process.env.BRAND_NAME || 'egitim.today'
  return `\n\n→ ${name}: ${url}`
}
