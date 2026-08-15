'use client'

import { PlatformIconLink } from '@/components/admin/PlatformIconLink'
import { socialPostPublicUrl } from '@/lib/social/postUrl'

export type TopPerformingPost = {
  id: string
  platform: string
  postContent: string
  publishedAt: string
  platformPostId: string | null
  engagement: number
  impressions: number | null
  likes: number | null
  comments: number | null
  shares: number | null
}

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function snippet(text: string, n = 72): string {
  const t = text.replace(/\s+/g, ' ').trim()
  return t.length > n ? `${t.slice(0, n)}…` : t
}

export function TopPerformersPanel({ posts }: { posts: TopPerformingPost[] }) {
  if (!posts.length) {
    return (
      <p className="muted" style={{ margin: 0 }}>
        Henüz metrikli yayın yok — postlar yayınlandıkça ve &quot;İstatistikleri yenile&quot; ile
        senkronlandıkça burada en çok etkileşim alanlar sıralanır.
      </p>
    )
  }

  return (
    <ol className="published-posts-list top-performers-list">
      {posts.map((p, i) => {
        const publicUrl = socialPostPublicUrl(p.platform, p.platformPostId)
        return (
          <li key={p.id} className="published-post-card" tabIndex={0}>
            <div className="published-post-row top-performer-row">
              <span className="top-performer-rank">#{i + 1}</span>
              <PlatformIconLink platform={p.platform} />
              <span className="published-post-line">{snippet(p.postContent)}</span>
              <span className="published-post-chip">{p.engagement.toLocaleString('tr-TR')}</span>
              <time className="muted published-post-when">{formatWhen(p.publishedAt)}</time>
            </div>
            <div className="published-post-grow">
              <p className="published-post-preview">{p.postContent.trim() || '(içerik yok)'}</p>
              <div className="sm-post-stats row">
                <span className="badge ok">etkileşim {p.engagement.toLocaleString('tr-TR')}</span>
                {p.impressions != null ? (
                  <span className="badge">gösterim {p.impressions.toLocaleString('tr-TR')}</span>
                ) : null}
                {p.likes != null ? <span className="badge">beğeni {p.likes.toLocaleString('tr-TR')}</span> : null}
                {p.comments != null ? (
                  <span className="badge">yorum {p.comments.toLocaleString('tr-TR')}</span>
                ) : null}
                {p.shares != null ? (
                  <span className="badge">paylaşım {p.shares.toLocaleString('tr-TR')}</span>
                ) : null}
              </div>
              <div className="published-post-actions row">
                {publicUrl ? (
                  <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                    Paylaşımı aç ↗
                  </a>
                ) : (
                  <span className="muted">{p.platform}</span>
                )}
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
