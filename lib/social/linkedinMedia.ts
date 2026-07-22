/**
 * Upload image to LinkedIn Assets API for feed share.
 * Returns digitalmediaAsset URN.
 */
async function linkedinRegisterAndUpload(
  accessToken: string,
  ownerUrn: string,
  bytes: Buffer,
  contentType: string,
): Promise<string> {
  if (bytes.length > 10 * 1024 * 1024) {
    throw new Error('Image larger than 10MB')
  }

  const regRes = await fetch(
    'https://api.linkedin.com/v2/assets?action=registerUpload',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify({
        registerUploadRequest: {
          recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
          owner: ownerUrn,
          serviceRelationships: [
            {
              relationshipType: 'OWNER',
              identifier: 'urn:li:userGeneratedContent',
            },
          ],
        },
      }),
    },
  )
  if (!regRes.ok) {
    throw new Error(`LinkedIn registerUpload ${regRes.status}: ${await regRes.text()}`)
  }

  const reg = (await regRes.json()) as {
    value?: {
      asset?: string
      uploadMechanism?: {
        'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'?: {
          uploadUrl?: string
        }
      }
    }
  }
  const asset = reg.value?.asset
  const uploadUrl =
    reg.value?.uploadMechanism?.[
      'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'
    ]?.uploadUrl
  if (!asset || !uploadUrl) {
    throw new Error('LinkedIn registerUpload missing asset or uploadUrl')
  }

  const upRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': contentType,
    },
    body: new Uint8Array(bytes),
  })
  if (!upRes.ok) {
    throw new Error(`LinkedIn image upload ${upRes.status}: ${await upRes.text()}`)
  }

  return asset
}

export async function linkedinUploadImageFromBuffer(
  accessToken: string,
  ownerUrn: string,
  bytes: Buffer,
  contentType = 'image/png',
): Promise<string> {
  return linkedinRegisterAndUpload(accessToken, ownerUrn, bytes, contentType)
}

export async function linkedinUploadImageFromUrl(
  accessToken: string,
  ownerUrn: string,
  imageUrl: string,
): Promise<string> {
  const imgRes = await fetch(imageUrl, { redirect: 'follow' })
  if (!imgRes.ok) {
    throw new Error(`Image fetch ${imgRes.status}: ${imageUrl}`)
  }
  const contentType = imgRes.headers.get('content-type') || 'image/jpeg'
  if (!contentType.startsWith('image/')) {
    throw new Error(`URL is not an image: ${contentType}`)
  }
  const bytes = Buffer.from(await imgRes.arrayBuffer())
  return linkedinRegisterAndUpload(accessToken, ownerUrn, bytes, contentType)
}
