/**
 * Prod review bulk approve — WP/media OFF, tick from local against studio.egitim.today
 * Usage: node scripts/prod-review-bulk-approve.mjs
 */
require('dotenv').config({ path: '.env' })
require('dotenv').config({ path: '.env.local' })

const key = process.env.ADMIN_API_KEY || ''
const base = process.env.PROD_URL || 'https://studio.egitim.today'
const TICK_TIMEOUT_MS = 280_000
const MAX_RETRIES = 3

if (!key) {
  console.error('ADMIN_API_KEY required')
  process.exit(1)
}

function headers(json = false) {
  const h = { 'x-admin-key': key }
  if (json) h['Content-Type'] = 'application/json'
  return h
}

async function api(path, opts = {}) {
  const res = await fetch(`${base}${path}`, {
    ...opts,
    headers: { ...headers(Boolean(opts.body)), ...(opts.headers || {}) },
  })
  const text = await res.text()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    data = { raw: text.slice(0, 400) }
  }
  if (!res.ok) {
    const err = new Error(`${res.status} ${data.error || text.slice(0, 200)}`)
    err.status = res.status
    err.data = data
    throw err
  }
  return data
}

function isFault(meta) {
  return Boolean(meta && typeof meta === 'object' && meta.reviewFault === true)
}

async function tickWithTimeout(id) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), TICK_TIMEOUT_MS)
  try {
    return await api('/api/review/bulk-job', {
      method: 'POST',
      body: JSON.stringify({ action: 'tick', id }),
      signal: ctrl.signal,
    })
  } finally {
    clearTimeout(t)
  }
}

async function main() {
  console.log('base', base)

  // Cancel stale active jobs
  const active = await api('/api/review/bulk-job')
  if (active.job && ['PENDING', 'RUNNING', 'PAUSED'].includes(active.job.status)) {
    console.log('cancel stale', active.job.id.slice(0, 8), active.job.cursor, '/', active.job.total, active.job.status)
    await api('/api/review/bulk-job', {
      method: 'POST',
      body: JSON.stringify({ action: 'cancel', id: active.job.id }),
    })
  }

  const { items } = await api('/api/content?status=IN_REVIEW&take=500')
  const clean = items.filter((i) => !isFault(i.metadata))
  const fault = items.length - clean.length
  console.log('IN_REVIEW', items.length, 'clean', clean.length, 'arı', fault)

  if (!clean.length) {
    console.log('Nothing to approve')
    return
  }

  const created = await api('/api/review/bulk-job', {
    method: 'POST',
    body: JSON.stringify({
      action: 'create',
      bulkAction: 'APPROVE',
      itemIds: clean.map((i) => i.id),
      autoMedia: false,
      autoWpDraft: false,
      scopeFilter: 'ALL',
    }),
  })
  const jobId = created.job.id
  console.log('job', jobId, 'total', created.job.total)

  let retries = 0
  while (true) {
    try {
      const { job, done } = await tickWithTimeout(jobId)
      retries = 0
      const pct = job.total ? Math.round((100 * job.cursor) / job.total) : 0
      console.log(
        `${job.cursor}/${job.total} (${pct}%) approved=${job.approvedCount} drafts=${job.draftsCount} errors=${(job.errors || []).length} ${job.currentLabel || ''}`,
      )
      if (done || job.status === 'COMPLETED' || job.status === 'CANCELLED') {
        console.log('DONE', job.status, 'approved', job.approvedCount, 'errors', (job.errors || []).slice(-5))
        break
      }
      if (job.status === 'PAUSED') {
        console.log('PAUSED', (job.errors || []).slice(-3))
        break
      }
    } catch (e) {
      const isAbort = e.name === 'AbortError'
      retries += 1
      console.warn(
        `tick fail ${retries}/${MAX_RETRIES}:`,
        isAbort ? 'timeout' : e.message,
      )
      if (retries >= MAX_RETRIES) {
        await api('/api/review/bulk-job', {
          method: 'POST',
          body: JSON.stringify({ action: 'pause', id: jobId }),
        }).catch(() => {})
        console.error('Stopped — resume later with same job id', jobId)
        process.exit(2)
      }
      await new Promise((r) => setTimeout(r, 2000 * retries))
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
