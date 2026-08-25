import type { SocialPlatform } from '@prisma/client'

export type PlatformFormat = {
  maxChars: number
  supportsThreads: boolean
  supportsCarousel: boolean
  supportsVideo: boolean
  hashtagStyle: 'minimal' | 'moderate' | 'heavy'
  tone: string
}

export const PLATFORM_FORMATS: Record<SocialPlatform, PlatformFormat> = {
  TWITTER: {
    maxChars: 280,
    supportsThreads: true,
    supportsCarousel: false,
    supportsVideo: true,
    hashtagStyle: 'moderate',
    tone: 'punchy, hook-first',
  },
  LINKEDIN: {
    maxChars: 1300,
    supportsThreads: false,
    supportsCarousel: true,
    supportsVideo: true,
    hashtagStyle: 'minimal',
    tone: 'professional storytelling',
  },
  INSTAGRAM: {
    maxChars: 2200,
    supportsThreads: false,
    supportsCarousel: true,
    supportsVideo: true,
    hashtagStyle: 'heavy',
    tone: 'engaging, emoji-friendly',
  },
  FACEBOOK: {
    maxChars: 4000,
    supportsThreads: false,
    supportsCarousel: true,
    supportsVideo: true,
    hashtagStyle: 'minimal',
    tone: 'conversational',
  },
  TIKTOK: {
    maxChars: 2200,
    supportsThreads: false,
    supportsCarousel: false,
    supportsVideo: true,
    hashtagStyle: 'moderate',
    tone: 'short-form video caption',
  },
  YOUTUBE: {
    maxChars: 5000,
    supportsThreads: false,
    supportsCarousel: false,
    supportsVideo: true,
    hashtagStyle: 'moderate',
    tone: 'SEO description',
  },
  PINTEREST: {
    maxChars: 500,
    supportsThreads: false,
    supportsCarousel: false,
    supportsVideo: true,
    hashtagStyle: 'heavy',
    tone: 'keyword-rich pin description',
  },
}

/** @deprecated use PLATFORM_FORMATS.PINTEREST */
export const PINTEREST_FORMAT: PlatformFormat = PLATFORM_FORMATS.PINTEREST

/** Trim text to platform limit with ellipsis. */
export function formatForPlatform(text: string, platform: SocialPlatform): string {
  const max = PLATFORM_FORMATS[platform].maxChars
  const trimmed = text.trim()
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max - 1).trim()}…`
}
