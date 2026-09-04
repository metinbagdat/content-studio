/** WordPress (wp-seo-hub) draft payload — never status=publish from Content Studio. */

export type WpPostType = 'article' | 'podcast' | 'anthem' | 'video' | 'career_insight'

export type WpContentPayload = {
  title: string
  content: string
  excerpt?: string
  slug?: string
  wpPostId?: number
  post_type: WpPostType
  categories?: number[]
  tags?: number[]
  meta?: {
    podcast_audio_url?: string
    podcast_duration?: number
    video_url?: string
    lyrics?: string
    script?: string
    anthem_song_url?: string
  }
  acf?: {
    hkmt_hazir_durum?: string
    hkmt_kavramsal_hedef?: string
    hkmt_metodoloji?: string
    hkmt_takip_transformasyon?: string
    hkmt_search_value_score?: number
    hkmt_hpv_score?: number
    skill_tags?: string[]
  }
}

export type WpPublishResult = {
  success: boolean
  wpPostId?: number
  editLink?: string
  message?: string
  errorMessage?: string
}

export type SamuraiValidation = {
  approved: boolean
  reason: string
  score?: number
  layer?: 'moderation' | 'hkmt' | 'config' | 'skip'
}
