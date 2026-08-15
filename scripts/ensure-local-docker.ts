/**
 * Start Docker Postgres when DATABASE_URL is local (Hobby egress).
 * npm predev / preworker — no-op if URL is Supabase or Vercel.
 */
import { existsSync, readFileSync } from 'node:fs'
import { spawn, spawnSync } from 'node:child_process'
import { createConnection } from 'node:net'
import { platform } from 'node:os'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

const ROOT = path.resolve(__dirname, '..')
const isWin = platform() === 'win32'
const DOCKER_DESKTOP = 'C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe'

function parseEnvFile(filePath: string): Record<string, string> {
  if (!existsSync(filePath)) return {}
  const out: Record<string, string> = {}
  for (const raw of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq < 1) continue
    let v = line.slice(eq + 1).trim()
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1)
    }
    out[line.slice(0, eq).trim()] = v
  }
  return out
}

function databaseUrl(): string {
  const merged = {
    ...parseEnvFile(path.join(ROOT, '.env')),
    ...parseEnvFile(path.join(ROOT, '.env.local')),
  }
  return (process.env.DATABASE_URL || merged.DATABASE_URL || '').trim()
}

function isLocalDockerUrl(url: string): boolean {
  if (!url) return false
  if (/supabase\.(co|com)|pooler\.supabase/i.test(url)) return false
  return /localhost|127\.0\.0\.1/i.test(url)
}

function run(cmd: string, args: string[], opts: { silent?: boolean } = {}) {
  return spawnSync(cmd, args, {
    cwd: ROOT,
    shell: isWin,
    stdio: opts.silent ? 'pipe' : 'inherit',
    encoding: 'utf8',
  })
}

function dockerEngineUp(): boolean {
  return run('docker', ['info'], { silent: true }).status === 0
}

async function startDockerDesktop(): Promise<void> {
  if (!isWin) {
    console.error('[db:up] Docker engine is down. Start Docker, then npm run dev again.')
    process.exit(1)
  }
  if (!existsSync(DOCKER_DESKTOP)) {
    console.error('[db:up] Docker Desktop not found. Install it, then retry.')
    process.exit(1)
  }
  console.log('[db:up] Starting Docker Desktop…')
  spawn(DOCKER_DESKTOP, [], { detached: true, stdio: 'ignore' }).unref()
  for (let i = 0; i < 36; i++) {
    await delay(5000)
    if (dockerEngineUp()) {
      console.log('[db:up] Docker engine ready')
      return
    }
    console.log(`[db:up] waiting for engine… ${i + 1}/36`)
  }
  console.error('[db:up] Docker engine did not start in time.')
  process.exit(1)
}

function postgresHealthy(): Promise<boolean> {
  return new Promise((resolve) => {
    const s = createConnection({ host: '127.0.0.1', port: 5434 })
    const done = (ok: boolean) => {
      s.removeAllListeners()
      s.destroy()
      resolve(ok)
    }
    s.setTimeout(1500)
    s.once('connect', () => done(true))
    s.once('timeout', () => done(false))
    s.once('error', () => done(false))
  })
}

async function main() {
  if (process.env.VERCEL || process.env.SKIP_LOCAL_DOCKER === 'true') return

  const url = databaseUrl()
  if (!isLocalDockerUrl(url)) {
    if (/supabase/i.test(url)) {
      console.warn(
        '[db:up] DATABASE_URL is Supabase — Docker skipped. Local Hobby egress still counts. Use localhost:5434.',
      )
    }
    return
  }

  if (!dockerEngineUp()) await startDockerDesktop()

  console.log('[db:up] docker compose up -d postgres')
  const up = run('docker', ['compose', 'up', '-d', 'postgres'])
  if (up.status !== 0) process.exit(up.status ?? 1)

  for (let i = 0; i < 24; i++) {
    if (await postgresHealthy()) break
    await delay(2000)
    if (i === 23) {
      console.error('[db:up] Postgres on :5434 did not become ready.')
      process.exit(1)
    }
  }

  const push = run('npx', ['prisma', 'db', 'push', '--skip-generate'])
  if (push.status !== 0) process.exit(push.status ?? 1)
  console.log('[db:up] local Postgres ready (localhost:5434)')
}

main().catch((err) => {
  console.error('[db:up]', err)
  process.exit(1)
})
