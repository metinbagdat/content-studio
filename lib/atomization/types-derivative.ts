import type { ContentType, SocialPlatform } from '@prisma/client'

export type AtomKind =
  | 'twitter_post'
  | 'twitter_thread'
  | 'long_form_video'
  | 'linkedin_post'
  | 'linkedin_carousel'
  | 'instagram_post'
  | 'instagram_reel'
  | 'tiktok_video'
  | 'youtube_short'
  | 'facebook_post'
  | 'pinterest_pin'
  | 'social_card'
  | 'short_video'
  | 'long_video'
  | 'infographic'

export type AtomMetadata = {
  atomKind: AtomKind
  platform?: SocialPlatform | 'PINTEREST'
  seriesId?: string
  partIndex?: number
  partTotal?: number
  slideIndex?: number
  slideTotal?: number
  tweetIndex?: number
  tweetTotal?: number
  articleTitle?: string
  articleUrl?: string
  autoGenerateImage?: boolean
  imageUrl?: string
  /** CS-SM-01 audience: tyt | ayt | lgs | veli | egitimci | genel */
  segment?: string
}

export type DerivativeDraft = {
  contentType: ContentType
  title: string
  content: string
  metadata: AtomMetadata & Record<string, unknown>
}

export type GenerateDerivativesInput = {
  sourceId: string
  title: string
  article: string
  articleUrl?: string
  tags?: string[]
  /** When set, only generate pieces for these platforms (X/YouTube prioritized upstream). */
  platforms?: SocialPlatform[]
}

export type GenerateDerivativesResult = {
  created: number
  byType: Record<string, number>
  /** Individual items that failed to persist (e.g. enum not yet migrated in DB) — the
   * rest of the batch still gets saved instead of the whole pipeline failing. */
  errors: string[]
}
