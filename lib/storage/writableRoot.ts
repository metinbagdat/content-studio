import fs from 'fs'
import path from 'path'

/** Vercel / Lambda: only `/tmp` is writable; local dev uses repo `storage/`. */
export function isServerlessRuntime(): boolean {
  return Boolean(
    process.env.VERCEL ||
      process.env.VERCEL_ENV ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.AWS_EXECUTION_ENV,
  )
}

/**
 * Monorepo root for local storage — Next may run with cwd `apps/web`, worker with repo root.
 * Without this, PNGs land in `apps/web/storage` while the drain worker looks in `./storage`.
 */
function monorepoRootFromCwd(cwd: string): string {
  let dir = cwd
  for (let i = 0; i < 6; i++) {
    const pkg = path.join(dir, 'package.json')
    try {
      if (fs.existsSync(pkg)) {
        const raw = fs.readFileSync(pkg, 'utf8')
        const json = JSON.parse(raw) as { workspaces?: unknown; name?: string }
        if (json.workspaces || json.name === 'content-studio') return dir
      }
    } catch {
      /* keep walking */
    }
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return cwd
}

export function contentStorageRoot(): string {
  if (isServerlessRuntime()) {
    return path.join('/tmp', 'content-studio-storage')
  }
  if (process.env.CS_STORAGE_ROOT?.trim()) {
    return path.resolve(process.env.CS_STORAGE_ROOT.trim())
  }
  return path.join(monorepoRootFromCwd(process.cwd()), 'storage')
}

export function storageSubdir(...parts: string[]): string {
  return path.join(contentStorageRoot(), ...parts)
}
