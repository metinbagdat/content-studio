/** Verify a remote URL actually resolves to an image before trusting it as post media. */
export async function verifyImageUrl(url: string, timeoutMs = 4000): Promise<boolean> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    let res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: controller.signal })
    if (res.status === 405 || res.status === 501) {
      // Some hosts (e.g. Next.js dynamic OG routes) don't support HEAD — retry with GET.
      res = await fetch(url, { method: 'GET', redirect: 'follow', signal: controller.signal })
    }
    if (!res.ok) return false
    const contentType = res.headers.get('content-type') || ''
    return contentType.startsWith('image/')
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}
