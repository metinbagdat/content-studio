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
    return new Date(iso).toLocaleDateString('tr-TR')
  } catch {
    return iso
  }
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
    <ol className="top-performers-list">
      {posts.map((p, i) => (
        <li key={p.id} className="top-performer-item">
          <span className="top-performer-rank">#{i + 1}</span>
          <div className="top-performer-body">
            <div className="row" style={{ marginBottom: '0.3rem' }}>
              <PlatformIconLink platform={p.platform} />
              <time className="muted" style={{ fontSize: '0.78rem' }}>{formatWhen(p.publishedAt)}</time>
            </div>
            <p className="top-performer-preview">{p.postContent.slice(0, 140)}</p>
            <div className="row" style={{ fontSize: '0.78rem' }}>
              <span className="badge ok">etkileşim {p.engagement.toLocaleString('tr-TR')}</span>
              {p.impressions != null ? (
                <span className="badge">gösterim {p.impressions.toLocaleString('tr-TR')}</span>
              ) : null}
              {p.likes != null ? <span className="badge">beğeni {p.likes.toLocaleString('tr-TR')}</span> : null}
              {p.comments != null ? <span className="badge">yorum {p.comments.toLocaleString('tr-TR')}</span> : null}
              {p.shares != null ? <span className="badge">paylaşım {p.shares.toLocaleString('tr-TR')}</span> : null}
              {socialPostPublicUrl(p.platform, p.platformPostId) ? (
                <a href={socialPostPublicUrl(p.platform, p.platformPostId)!} target="_blank" rel="noopener noreferrer">
                  Aç ↗
                </a>
              ) : null}
            </div>
          </div>
        </li>
      ))}
    </ol>
  )
}
