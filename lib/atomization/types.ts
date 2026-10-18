import type { SocialPlatform } from '@prisma/client'

export type ContentPieceCounts = {
  longFormVideo: number
  shortVideos: number
  podcastEpisodes: number
  songs: number
  marches: number
  socialCards: number
  twitterPosts: number
  twitterThreads: number
  linkedinPosts: number
  linkedinCarousels: number
  instagramPosts: number
  instagramReels: number
  tiktokVideos: number
  youtubeShorts: number
  facebookPosts: number
  pinterestPins: number
  infographicSlides: number
}

export type AtomizationPlan = {
  keyConcepts: string[]
  mainArguments: string[]
  quotes: string[]
  targetAudience: string
  emotionalTone: string
  contentPieces: ContentPieceCounts
  distributionDays: number
  platformPriority: Lowercase<SocialPlatform | 'pinterest'>[]
  generatedAt: string
  mock?: boolean
}

/**
 * Lean budget: one long video, one podcast, a few LinkedIn/Facebook posts.
 * X and Pinterest stay at 0 until those APIs can publish. Shorts, carousels,
 * songs, and infographics stay at 0 so one article does not fan out into ~50 LLM calls.
 */
export const DEFAULT_PIECE_COUNTS: ContentPieceCounts = {
  longFormVideo: 1,
  shortVideos: 0,
  podcastEpisodes: 1,
  songs: 0,
  marches: 0,
  socialCards: 2,
  twitterPosts: 0,
  twitterThreads: 0,
  linkedinPosts: 2,
  linkedinCarousels: 0,
  instagramPosts: 0,
  instagramReels: 0,
  tiktokVideos: 0,
  youtubeShorts: 0,
  facebookPosts: 2,
  pinterestPins: 0,
  infographicSlides: 0,
}

const PIECE_KEYS = Object.keys(DEFAULT_PIECE_COUNTS) as (keyof ContentPieceCounts)[]

/** LLM plans cannot exceed the lean defaults. */
export function capPieceCounts(pieces: Partial<ContentPieceCounts> | undefined): ContentPieceCounts {
  const out = { ...DEFAULT_PIECE_COUNTS }
  if (!pieces) return out
  for (const key of PIECE_KEYS) {
    const raw = Number(pieces[key])
    if (!Number.isFinite(raw)) continue
    out[key] = Math.max(0, Math.min(Math.floor(raw), DEFAULT_PIECE_COUNTS[key]))
  }
  return out
}

export function totalPlannedPieces(counts: ContentPieceCounts): number {
  return Object.values(counts).reduce((a, b) => a + b, 0)
}
