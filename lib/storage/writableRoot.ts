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

export function contentStorageRoot(): string {
  if (isServerlessRuntime()) {
    return path.join('/tmp', 'content-studio-storage')
  }
  return path.join(process.cwd(), 'storage')
}

export function storageSubdir(...parts: string[]): string {
  return path.join(contentStorageRoot(), ...parts)
}
