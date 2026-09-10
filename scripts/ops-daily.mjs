/**
 * Daily Content Studio ops checklist (egress-safe).
 *
 * Default: print playbook. Subcommands run prod HTTP (no CS_ALLOW) or one-shot
 * local video drain (CS_ALLOW only for that child process).
 *
 *   npm run ops:daily
 *   npm run ops:daily -- status
 *   npm run ops:daily -- social
 *   npm run ops:daily -- social:LINKEDIN
 *   npm run ops:daily -- video -- --limit=5 --type=SHORT_VIDEO_SCRIPT --approve
 *   npm run ops:daily -- media-status
 *
 * Env:
 *   ADMIN_API_KEY  — Vercel production admin key (status/social/media)
 *   PROD_URL       — default https://studio.egitim.today
 *   BLOB_READ_WRITE_TOKEN — from .env for video drain
 *
 * Never leave CS_ALLOW_SUPABASE_WORKER set in the parent shell after video.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const key = process.env.ADMIN_API_KEY || ''
const base = process.env.PROD_URL || 'https://studio.egitim.today'
const cmd = process.argv[2] || 'help'
const passthrough = process.argv.slice(3)

function printPlaybook() {
  console.log(`Content Studio — günlük ops (Hobby egress güvenli)

Sıra:
  1) Onay          studio.egitim.today /admin/review  (temiz Onay; Arı engellemez)
  2) Arı video     npm run ops:daily -- video -- --limit=10 --type=SHORT_VIDEO_SCRIPT --approve
                   (yerel ffmpeg → Blob; CS_ALLOW yalnız child process’te)
  3) Sosyal sync   npm run ops:daily -- social
                   (prod HTTP; CS_ALLOW yok — LI/FB bulk; X kredi yoksa atlanır)
  4) YT SEO        npm run ops:daily -- youtube-seo
                   (Blob URL hazır long-form)
  5) Pinterest     Trial Standard onayına kadar production Pin yok

Kurallar:
  · Günlük browse / npm run dev → Docker localhost:5434 (CS_ALLOW yok)
  · npm run worker:loop + Supabase → YAPMA (Hobby egress)
  · Video one-shot bitince parent shell’de CS_ALLOW bırakılmaz

Komutlar: help | status | social | social:PLATFORM | youtube-seo | media-status | video
`)
}

async function api(path, { method = 'GET', body } = {}) {
  if (!key) {
    console.error('ADMIN_API_KEY gerekli (Vercel Production admin key)')
    process.exit(1)
  }
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      'x-admin-key': key,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    json = { raw: text.slice(0, 400) }
  }
  if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(json).slice(0, 400)}`)
  return json
}

function readEnvFile(name) {
  const p = resolve(root, name)
  if (!existsSync(p)) return {}
  const out = {}
  for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    if (!line || line.trim().startsWith('#')) continue
    const i = line.indexOf('=')
    if (i < 0) continue
    const k = line.slice(0, i).trim()
    let v = line.slice(i + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    out[k] = v
  }
  return out
}

function runVideoDrain() {
  const prodPull = readEnvFile('.env.prod.pull')
  const localEnv = readEnvFile('.env')
  const databaseUrl = process.env.DATABASE_URL || prodPull.DATABASE_URL || ''
  const blob = process.env.BLOB_READ_WRITE_TOKEN || localEnv.BLOB_READ_WRITE_TOKEN || ''

  if (!databaseUrl || /localhost:5434/i.test(databaseUrl) || /SENSITIVE/i.test(databaseUrl)) {
    console.error(
      'video: prod DATABASE_URL gerekli. Önce: npx vercel env pull .env.prod.pull --environment=production',
    )
    process.exit(1)
  }

  const args = ['tsx', '--env-file=.env', 'scripts/prod-video-drain.ts', ...passthrough]
  if (!passthrough.some((a) => a.startsWith('--limit='))) args.push('--limit=5')
  if (!passthrough.includes('--approve') && !passthrough.includes('--no-approve')) {
    /* default: leave approve to explicit flag; hint only */
  }

  console.log('[ops:daily video] CS_ALLOW=1 only in child; Blob OIDC cleared when RW token set')
  const env = {
    ...process.env,
    DATABASE_URL: databaseUrl,
    DIRECT_URL: process.env.DIRECT_URL || prodPull.DIRECT_URL || databaseUrl,
    CS_ALLOW_SUPABASE_WORKER: '1',
    BLOB_READ_WRITE_TOKEN: blob,
  }
  delete env.BLOB_STORE_ID
  delete env.VERCEL_OIDC_TOKEN

  const r = spawnSync('npx', args, {
    cwd: root,
    env,
    stdio: 'inherit',
    shell: true,
  })
  if (r.status !== 0) process.exit(r.status || 1)
  console.log('[ops:daily video] done — parent CS_ALLOW untouched; Docker’a dön (.env localhost:5434)')
}

async function main() {
  if (cmd === 'help' || cmd === '--help' || cmd === '-h') {
    printPlaybook()
    return
  }

  if (cmd === 'status') {
    const social = await api('/api/social')
    const d = social.diagnostics || social
    console.log(JSON.stringify({ host: base, diagnostics: d }, null, 2))
    return
  }

  if (cmd === 'media-status') {
    const j = await api('/api/media?needsAudio=1')
    const n = Array.isArray(j.pending) ? j.pending.length : Array.isArray(j.items) ? j.items.length : null
    console.log(JSON.stringify({ needsAudioHint: n, sample: j }, null, 2))
    return
  }

  if (cmd === 'social') {
    console.log('[ops:daily social] sync-drafts…')
    console.log(JSON.stringify(await api('/api/social', { method: 'POST', body: { action: 'sync-drafts' } }), null, 2))
    for (const platform of ['LINKEDIN', 'FACEBOOK']) {
      console.log(`[ops:daily social] bulk:${platform}…`)
      console.log(
        JSON.stringify(
          await api('/api/social', {
            method: 'POST',
            body: { action: 'bulk-publish', platform, includeDryRun: false, limit: 8 },
          }),
          null,
          2,
        ),
      )
    }
    console.log('[ops:daily social] X/Pinterest atlandı (kredi / Trial). İstersen: social:TWITTER')
    return
  }

  if (cmd.startsWith('social:')) {
    const platform = cmd.slice('social:'.length).toUpperCase()
    console.log(
      JSON.stringify(
        await api('/api/social', {
          method: 'POST',
          body: { action: 'bulk-publish', platform, includeDryRun: false, limit: 8 },
        }),
        null,
        2,
      ),
    )
    return
  }

  if (cmd === 'youtube-seo') {
    console.log(
      JSON.stringify(
        await api('/api/social', {
          method: 'POST',
          body: {
            action: 'youtube-sync',
            limit: 5,
            maxPublish: 1,
            preferLongForm: true,
            generateVideo: false,
            requireDurableVideo: true,
            schedule: true,
            publishNow: true,
          },
        }),
        null,
        2,
      ),
    )
    return
  }

  if (cmd === 'video') {
    runVideoDrain()
    return
  }

  console.error('Unknown cmd:', cmd)
  printPlaybook()
  process.exit(1)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
