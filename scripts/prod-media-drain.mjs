/**
 * Prod media audio drain (studio.egitim.today).
 *
 *   ADMIN_API_KEY=... node scripts/prod-media-drain.mjs status
 *   ADMIN_API_KEY=... node scripts/prod-media-drain.mjs drain          # podcasts first, then song/march
 *   ADMIN_API_KEY=... node scripts/prod-media-drain.mjs drain:podcast  # only PODCAST_SCRIPT
 *   ADMIN_API_KEY=... node scripts/prod-media-drain.mjs drain:song     # SONG + MARCH
 *
 * Env: ADMIN_API_KEY, optional PROD_URL, LIMIT (default 8).
 */
const key = process.env.ADMIN_API_KEY || ''
const base = process.env.PROD_URL || 'https://studio.egitim.today'
const limit = Math.max(1, Number(process.env.LIMIT || 8))

if (!key) {
  console.error('Set ADMIN_API_KEY (Vercel production admin key)')
  process.exit(1)
}

async function getPending() {
  const res = await fetch(`${base}/api/media?needsAudio=1`, {
    headers: { 'x-admin-key': key },
  })
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`)
  return res.json()
}

async function generate(derivedContentId, contentType) {
  const kind =
    contentType === 'MARCH_LYRICS' ? 'march' : contentType === 'SONG_LYRICS' ? 'song' : 'podcast'
  const res = await fetch(`${base}/api/media/generate`, {
    method: 'POST',
    headers: { 'x-admin-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ derivedContentId, kind }),
  })
  const text = await res.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    json = { error: text.slice(0, 300) }
  }
  if (!res.ok) throw new Error(json.error || `${res.status}`)
  return json
}

const cmd = process.argv[2] || 'status'

function filterPending(pending, mode) {
  const rows = pending || []
  if (mode === 'podcast') return rows.filter((r) => r.contentType === 'PODCAST_SCRIPT')
  if (mode === 'song') {
    return rows.filter((r) => r.contentType === 'SONG_LYRICS' || r.contentType === 'MARCH_LYRICS')
  }
  // default: podcast first (API already sorts; keep stable)
  return [...rows].sort((a, b) => {
    const rank = (t) =>
      t === 'PODCAST_SCRIPT' ? 0 : t === 'MARCH_LYRICS' || t === 'SONG_LYRICS' ? 1 : 2
    return rank(a.contentType) - rank(b.contentType)
  })
}

async function main() {
  if (cmd === 'help') {
    console.log(`Usage: ADMIN_API_KEY=... node scripts/prod-media-drain.mjs <cmd>
  status          pending audio counts
  drain           up to LIMIT (default 8), podcasts first
  drain:podcast   only podcasts
  drain:song      only song/march`)
    return
  }

  const data = await getPending()
  const pending = data.pending || []
  const byType = {}
  for (const r of pending) {
    byType[r.contentType] = (byType[r.contentType] || 0) + 1
  }

  if (cmd === 'status') {
    console.log(JSON.stringify({ total: pending.length, ttsMode: data.ttsMode, byType }, null, 2))
    return
  }

  let mode = 'all'
  if (cmd === 'drain:podcast') mode = 'podcast'
  else if (cmd === 'drain:song') mode = 'song'
  else if (cmd !== 'drain') {
    console.error('Unknown cmd:', cmd, '— try help')
    process.exit(1)
  }

  const queue = filterPending(pending, mode).slice(0, limit)
  console.log(`drain mode=${mode} limit=${limit} queue=${queue.length} of ${pending.length}`)

  let ok = 0
  let fail = 0
  for (let i = 0; i < queue.length; i++) {
    const row = queue[i]
    const title = (row.title || '').slice(0, 48)
    process.stdout.write(`[${i + 1}/${queue.length}] ${row.contentType} ${title}… `)
    try {
      const result = await generate(row.id, row.contentType)
      const sec = result.durationSec ?? result.media?.duration ?? '?'
      console.log(result.reused ? `reused` : `ok ~${sec}s`)
      ok += 1
    } catch (err) {
      console.log(`FAIL ${err instanceof Error ? err.message : String(err)}`)
      fail += 1
    }
  }
  console.log(JSON.stringify({ ok, fail, remainingHint: Math.max(0, pending.length - ok) }, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
