import { metaGraphVersion } from './metaApi'

function graphBase(): string {
  return `https://graph.facebook.com/${metaGraphVersion()}`
}

export type MetaPublishOutcome = {
  platformPostId: string
  imageAttached: boolean
  imageError?: string
}

/** Publish to a Facebook Page — direct binary upload when an image exists (no public URL
 * needed), plain text feed post otherwise. */
export async function publishFacebookPost(
  pageId: string,
  pageAccessToken: string,
  message: string,
  imageBuffer?: Buffer,
): Promise<MetaPublishOutcome> {
  if (imageBuffer) {
    try {
      const form = new FormData()
      form.append('caption', message)
      form.append('access_token', pageAccessToken)
      form.append('source', new Blob([imageBuffer]), 'image.png')

      const res = await fetch(`${graphBase()}/${pageId}/photos`, { method: 'POST', body: form })
      if (!res.ok) {
        const body = await res.text()
        throw new Error(`Facebook photos ${res.status}: ${body.slice(0, 300)}`)
      }
      const data = (await res.json()) as { post_id?: string; id?: string }
      return { platformPostId: data.post_id || data.id || `fb_${Date.now()}`, imageAttached: true }
    } catch (err) {
      const imageError = err instanceof Error ? err.message : String(err)
      console.warn('[publishFacebookPost] image upload failed, posting text-only', imageError)
      // fall through to text-only post below
      const textResult = await publishFacebookTextOnly(pageId, pageAccessToken, message)
      return { ...textResult, imageAttached: false, imageError }
    }
  }
  return publishFacebookTextOnly(pageId, pageAccessToken, message)
}

async function publishFacebookTextOnly(
  pageId: string,
  pageAccessToken: string,
  message: string,
): Promise<MetaPublishOutcome> {
  const res = await fetch(`${graphBase()}/${pageId}/feed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, access_token: pageAccessToken }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Facebook feed ${res.status}: ${body.slice(0, 300)}`)
  }
  const data = (await res.json()) as { id?: string }
  return { platformPostId: data.id || `fb_${Date.now()}`, imageAttached: false }
}

/** Publish to Instagram — two-step Graph API flow. Requires a PUBLICLY reachable imageUrl
 * (Meta fetches it server-side); localhost URLs will fail until deployed or tunneled. */
export async function publishInstagramPost(
  igUserId: string,
  pageAccessToken: string,
  caption: string,
  imageUrl: string,
): Promise<MetaPublishOutcome> {
  if (!imageUrl.startsWith('https://') && !imageUrl.startsWith('http://')) {
    throw new Error('Instagram için geçerli bir görsel URL gerekli')
  }
  if (imageUrl.includes('localhost')) {
    throw new Error(
      'Instagram, localhost URL\'lerine erişemez — production\'a deploy edin ya da ngrok gibi bir tünel kullanın',
    )
  }

  const createRes = await fetch(`${graphBase()}/${igUserId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_url: imageUrl, caption, access_token: pageAccessToken }),
  })
  if (!createRes.ok) {
    const body = await createRes.text()
    throw new Error(`Instagram media create ${createRes.status}: ${body.slice(0, 300)}`)
  }
  const created = (await createRes.json()) as { id?: string }
  if (!created.id) throw new Error('Instagram media container ID alınamadı')

  const publishRes = await fetch(`${graphBase()}/${igUserId}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creation_id: created.id, access_token: pageAccessToken }),
  })
  if (!publishRes.ok) {
    const body = await publishRes.text()
    throw new Error(`Instagram publish ${publishRes.status}: ${body.slice(0, 300)}`)
  }
  const published = (await publishRes.json()) as { id?: string }
  return { platformPostId: published.id || `ig_${Date.now()}`, imageAttached: true }
}