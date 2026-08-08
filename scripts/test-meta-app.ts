#!/usr/bin/env npx tsx
/**
 * Meta app permission audit — run: npx tsx --env-file=.env scripts/test-meta-app.ts
 */
import { metaAppId, metaAuthUrl, metaOAuthConnectScopes } from '../lib/social/metaApi'

async function graphGet(path: string, token: string) {
  const url = new URL(`https://graph.facebook.com/v21.0/${path}`)
  url.searchParams.set('access_token', token)
  const res = await fetch(url.toString())
  return { status: res.status, body: await res.text() }
}

async function main() {
  const appId = metaAppId()
  const secret = process.env.META_APP_SECRET
  if (!appId || !secret) {
    console.error('META_APP_ID / META_APP_SECRET eksik (.env)')
    process.exit(1)
  }

  const appToken = `${appId}|${secret}`

  console.log('\n=== App ===')
  console.log('ID:', appId)

  const perms = await graphGet(`${appId}/permissions`, appToken)
  console.log('\n=== Kayıtlı izinler (Meta API) ===')
  console.log(perms.body)

  console.log('\n=== OAuth scope (config_id yoksa) ===')
  console.log(metaOAuthConnectScopes())
  const configId = process.env.META_LOGIN_CONFIG_ID?.trim()
  console.log('\n=== META_LOGIN_CONFIG_ID ===')
  console.log(configId || '(eksik — Facebook Login for Business → Configurations)')

  console.log('\n=== OAuth URL (tarayıcıda aç) ===')
  console.log(metaAuthUrl('FACEBOOK', 'cli-test'))

  console.log('\n=== Use case ekle (sen — 2 dk) ===')
  console.log(`https://developers.facebook.com/apps/${appId}/use-cases/add/`)
  console.log('1. "Manage everything on your Page" → Ekle  (pages_show_list gelir)')
  console.log('2. "Manage messaging & content on Instagram" → Ekle  (instagram_basic gelir)')
  console.log('3. Tekrar: npx tsx --env-file=.env scripts/test-meta-app.ts')
  console.log('4. .env: META_OAUTH_SCOPES="public_profile,email,pages_show_list,pages_read_engagement,instagram_basic"')
  console.log('5. npm run dev restart → /admin/social OAuth bağla')
}

main().catch(console.error)
