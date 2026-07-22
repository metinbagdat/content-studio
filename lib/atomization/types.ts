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

export const DEFAULT_PIECE_COUNTS: ContentPieceCounts = {
  longFormVideo: 1,
  shortVideos: 3,
  podcastEpisodes: 1,
  songs: 1,
  marches: 1,
  socialCards: 5,
  twitterPosts: 10,
  twitterThreads: 2,
  linkedinPosts: 5,
  linkedinCarousels: 1,
  instagramPosts: 5,
  instagramReels: 3,
  tiktokVideos: 3,
  youtubeShorts: 2,
  facebookPosts: 3,
  pinterestPins: 5,
}

export function totalPlannedPieces(counts: ContentPieceCounts): number {
  return Object.values(counts).reduce((a, b) => a + b, 0)
}
