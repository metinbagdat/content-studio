import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const isWin = process.platform === 'win32'

function envFiles(): string[] {
  const files = [path.join(root, '.env')]
  if (existsSync(path.join(root, '.env.local'))) files.push(path.join(root, '.env.local'))
  return files
}

function tsxArgs(script: string, extra: string[] = []): string[] {
  const args = ['tsx']
  for (const f of envFiles()) {
    args.push('--env-file', f)
  }
  args.push(script, ...extra)
  return args
}

function start(cmd: string, args: string[], name: string) {
  const child = spawn(cmd, args, {
    cwd: root,
    stdio: 'inherit',
    shell: isWin,
    env: process.env,
  })
  child.on('exit', (code) => {
    if (name === 'web' && code && code !== 0) process.exit(code)
  })
  return child
}

async function main() {
  console.log('[dev] Docker already via predev. Starting drain worker, then Next on :3100')
  const worker = start('npx', tsxArgs('apps/worker/src/index.ts', ['--drain']), 'worker')
  const web = start('npm', ['run', 'dev', '-w', '@content-studio/web'], 'web')

  const stop = () => {
    worker.kill('SIGTERM')
    web.kill('SIGTERM')
    process.exit(0)
  }
  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)

  await new Promise<void>((resolve) => {
    web.on('exit', () => resolve())
  })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
