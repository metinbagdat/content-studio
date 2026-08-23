/**
 * Prod social ops (studio.egitim.today).
 *
 *   ADMIN_API_KEY=... node scripts/prod-social-drain.mjs status
 *   ADMIN_API_KEY=... node scripts/prod-social-drain.mjs sync-drafts
 *   ADMIN_API_KEY=... node scripts/prod-social-drain.mjs bulk:FACEBOOK
 *   ADMIN_API_KEY=... node scripts/prod-social-drain.mjs bulk:TWITTER   # X credits restored
 *   ADMIN_API_KEY=... node scripts/prod-social-drain.mjs bulk:LINKEDIN
 */
const key = process.env.ADMIN_API_KEY || ''
const base = process.env.PROD_URL || 'https://studio.egitim.today'

if (!key) {
  console.error('Set ADMIN_API_KEY (Vercel production admin key)')
  process.exit(1)
}

async function api(body) {
  const res = await fetch(`${base}/api/social`, {
    method: 'POST',
    headers: { 'x-admin-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 400)}`)
  return JSON.parse(text)
}

async function getDiag() {
  const res = await fetch(`${base}/api/social`, { headers: { 'x-admin-key': key } })
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`)
  return res.json()
}

const cmd = process.argv[2] || 'status'

async function main() {
  if (cmd === 'status' || cmd === 'help') {
    if (cmd === 'help') {
      console.log(`Usage: ADMIN_API_KEY=... node scripts/prod-social-drain.mjs <cmd>
  status       diagnostics JSON
  sync-drafts  create social drafts from approved captions
  bulk:PLATFORM  publish DRAFT+FAILED (FACEBOOK|INSTAGRAM|LINKEDIN|TWITTER|YOUTUBE|TIKTOK)`)
      return
    }
    const j = await getDiag()
    const d = j.diagnostics || j
    console.log(JSON.stringify(d, null, 2))
    return
  }
  if (cmd === 'sync-drafts') {
    const j = await api({ action: 'sync-drafts' })
    console.log(JSON.stringify(j, null, 2))
    return
  }
  if (cmd.startsWith('bulk:')) {
    const platform = cmd.slice(5).toUpperCase()
    const j = await api({ action: 'bulk-publish', platform, includeDryRun: false, limit: 8 })
    console.log(JSON.stringify(j, null, 2))
    return
  }
  console.error('Unknown cmd:', cmd, '— try help')
  process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
