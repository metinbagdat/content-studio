export type ImageSpec = {
  width: number
  height: number
  label: string
  aspectRatio: string
}

/** Platform image dimensions for social cards and thumbnails. */
export const PLATFORM_IMAGE_SIZES = {
  instagramPost: { width: 1080, height: 1080, label: 'Instagram Post', aspectRatio: '1:1' },
  instagramStory: { width: 1080, height: 1920, label: 'Instagram Story', aspectRatio: '9:16' },
  facebookPost: { width: 1200, height: 630, label: 'Facebook Post', aspectRatio: '1.91:1' },
  linkedinPost: { width: 1200, height: 627, label: 'LinkedIn Post', aspectRatio: '1.91:1' },
  twitterPost: { width: 1600, height: 900, label: 'Twitter/X Post', aspectRatio: '16:9' },
  pinterestPin: { width: 1000, height: 1500, label: 'Pinterest Pin', aspectRatio: '2:3' },
  youtubeThumbnail: { width: 1280, height: 720, label: 'YouTube Thumbnail', aspectRatio: '16:9' },
  tiktokVertical: { width: 1080, height: 1920, label: 'TikTok/Reels', aspectRatio: '9:16' },
  ogDefault: { width: 1200, height: 630, label: 'OG Card (current)', aspectRatio: '1.91:1' },
} as const satisfies Record<string, ImageSpec>

export type PlatformImageKey = keyof typeof PLATFORM_IMAGE_SIZES

export function getImageSpec(key: PlatformImageKey): ImageSpec {
  return PLATFORM_IMAGE_SIZES[key]
}
