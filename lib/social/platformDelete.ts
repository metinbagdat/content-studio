import { SocialPlatform } from '@prisma/client'

function isMockPlatformId(id: string | null | undefined): boolean {
  return !id || id.startsWith('mock_') || id.startsWith('dryrun_')
}

export async function deleteLinkedInPost(
  accessToken: string,
  platformPostId: string,
): Promise<{ deleted: boolean; error?: string }> {
  if (!accessToken || accessToken === 'dry-run' || isMockPlatformId(platformPostId)) {
    return { deleted: false }
  }

  const urn = platformPostId.startsWith('urn:')
    ? platformPostId
    : `urn:li:share:${platformPostId}`
  const encoded = encodeURIComponent(urn)

  const res = await fetch(`https://api.linkedin.com/v2/ugcPosts/${encoded}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'X-Restli-Protocol-Version': '2.0.0',
    },
  })

  if (res.status === 204 || res.status === 200 || res.status === 404) {
    return { deleted: true }
  }

  const body = await res.text()
  return { deleted: false, error: `LinkedIn silme ${res.status}: ${body.slice(0, 300)}` }
}

export async function deleteTwitterPost(
  accessToken: string,
  platformPostId: string,
): Promise<{ deleted: boolean; error?: string }> {
  if (!accessToken || accessToken === 'dry-run' || isMockPlatformId(platformPostId)) {
    return { deleted: false }
  }
  if (!process.env.X_CLIENT_ID) return { deleted: false }

  const res = await fetch(`https://api.twitter.com/2/tweets/${platformPostId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (res.ok) {
    const data = (await res.json()) as { data?: { deleted?: boolean } }
    return { deleted: Boolean(data.data?.deleted) }
  }
  if (res.status === 404) return { deleted: true }

  const body = await res.text()
  return { deleted: false, error: `X silme ${res.status}: ${body.slice(0, 300)}` }
}

export async function deletePlatformPost(
  platform: SocialPlatform,
  platformPostId: string | null | undefined,
  accessToken: string,
): Promise<{ deleted: boolean; error?: string }> {
  if (!platformPostId || isMockPlatformId(platformPostId)) {
    return { deleted: false }
  }
  if (platform === 'LINKEDIN') return deleteLinkedInPost(accessToken, platformPostId)
  if (platform === 'TWITTER') return deleteTwitterPost(accessToken, platformPostId)
  return { deleted: false, error: `Platform delete not implemented: ${platform}` }
}
