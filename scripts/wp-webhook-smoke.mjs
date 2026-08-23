/**
 * Smoke test WP → CS publish webhook (CS-WP-04 / issue #37).
 *
 *   WP_PUBLISH_WEBHOOK_SECRET=... node scripts/wp-webhook-smoke.mjs
 *   CONNECT_STUDIO_API_KEY=... node scripts/wp-webhook-smoke.mjs
 *
 * Sends a synthetic payload; idempotent tag wp-post:smoke-{date}.
 */
const secret =
  process.env.WP_PUBLISH_WEBHOOK_SECRET?.trim() ||
  process.env.CONNECT_STUDIO_API_KEY?.trim() ||
  ''
const base = process.env.PROD_URL || 'https://studio.egitim.today'
const url = `${base}/api/webhooks/wordpress-published`

if (!secret) {
  console.error('Set WP_PUBLISH_WEBHOOK_SECRET or CONNECT_STUDIO_API_KEY')
  process.exit(1)
}

const postId = `smoke-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`
const payload = {
  post_id: postId,
  title: `[CS smoke] Webhook test ${postId}`,
  link: `https://blog.egitim.today/smoke-test-${postId}`,
  post_type: 'post',
  content: '<p>Automated webhook smoke test — safe to delete in WP.</p>',
  meta: { cs_safe_samurai_validated: 'yes' },
}

const headers = process.env.WP_PUBLISH_WEBHOOK_SECRET
  ? { 'x-wp-webhook-secret': secret, 'Content-Type': 'application/json' }
  : { 'X-API-Key': secret, 'Content-Type': 'application/json' }

const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(payload) })
const text = await res.text()
console.log('POST', url)
console.log('Status:', res.status)
try {
  console.log(JSON.stringify(JSON.parse(text), null, 2))
} catch {
  console.log(text.slice(0, 500))
}
process.exit(res.ok ? 0 : 1)
