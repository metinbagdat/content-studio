/** Build public URL for a published social post when possible. */
export function socialPostPublicUrl(
  platform: string,
  platformPostId: string | null | undefined,
): string | null {
  if (!platformPostId || platformPostId.startsWith('mock_')) return null

  if (platform === 'LINKEDIN') {
    const id = platformPostId.startsWith('urn:') ? platformPostId : `urn:li:share:${platformPostId}`
    return `https://www.linkedin.com/feed/update/${encodeURIComponent(id)}`
  }

  if (platform === 'TWITTER') {
    return `https://twitter.com/i/web/status/${platformPostId}`
  }

  return null
}
