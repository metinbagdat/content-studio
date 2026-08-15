'use client'

import { socialPostPublicUrl } from '@/lib/social/postUrl'
import { PlatformIconLink } from '@/components/admin/PlatformIconLink'

export type PublishedPostRow = {
  id: string
  platform: string
  status: string
  postContent: string
  platformPostId?: string | null
  publishedAt?: string | null
  createdAt: string
  isDryRun?: boolean
  isMockPost?: boolean
  imagePreviewUrl?: string | null
  account?: { accountName?: string; platform?: string; isActive?: boolean }
  analytics?: {
    impressions?: number | null
    likes?: number | null
    comments?: number | null
    shares?: number | null
    clicks?: number | null
    engagement?: number | null
    fetchedAt?: string
  } | null
}

function formatWhen(iso?: string | null): string {
  if (!iso) return '—'
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

export function PublishedPostsPanel({
  posts,
  emptyHint,
}: {
  posts: PublishedPostRow[]
  emptyHint?: string
}) {
  if (!posts.length) {
    return (
      <p className="muted" style={{ margin: 0 }}>
        {emptyHint ||
          'Henüz yayınlanan post yok — taslaklardan «Şimdi yayınla» veya «Otomatik görsel + platformda yayınla» kullanın.'}
      </p>
    )
  }

  return (
    <ul className="published-posts-list">
      {posts.map((p) => {
        const publicUrl = socialPostPublicUrl(p.platform, p.platformPostId)
        const accountName = p.account?.accountName
        const a = p.analytics
        return (
          <li key={p.id} className="published-post-card" tabIndex={0}>
            <div className="published-post-row">
              <PlatformIconLink platform={p.platform} username={accountName} />
              <span className="published-post-line">{snippet(p.postContent)}</span>
              {a?.engagement != null ? (
                <span className="published-post-chip">{a.engagement.toLocaleString('tr-TR')}</span>
              ) : null}
              <time className="muted published-post-when">{formatWhen(p.publishedAt || p.createdAt)}</time>
            </div>
            <div className="published-post-grow">
              <p className="published-post-preview">{p.postContent.trim() || '(içerik yok)'}</p>
              {p.imagePreviewUrl ? (
                <img src={p.imagePreviewUrl} alt="" className="published-post-thumb" loading="lazy" />
              ) : null}
              {a ? (
                <div className="sm-post-stats row">
                  {a.impressions != null ? (
                    <span className="badge">gösterim {a.impressions.toLocaleString('tr-TR')}</span>
                  ) : null}
                  {a.engagement != null ? (
                    <span className="badge ok">etkileşim {a.engagement.toLocaleString('tr-TR')}</span>
                  ) : null}
                  {a.likes != null ? <span className="badge">beğeni {a.likes.toLocaleString('tr-TR')}</span> : null}
                  {a.comments != null ? (
                    <span className="badge">yorum {a.comments.toLocaleString('tr-TR')}</span>
                  ) : null}
                  {a.shares != null ? (
                    <span className="badge">paylaşım {a.shares.toLocaleString('tr-TR')}</span>
                  ) : null}
                  {a.clicks != null ? (
                    <span className="badge">tıklama {a.clicks.toLocaleString('tr-TR')}</span>
                  ) : null}
                </div>
              ) : (
                <p className="muted published-post-nometrics">Metrik yok — «İstatistikleri yenile»</p>
              )}
              <div className="published-post-actions row">
                {publicUrl ? (
                  <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                    Paylaşımı aç ↗
                  </a>
                ) : p.platformPostId ? (
                  <span className="muted">mock: {p.platformPostId}</span>
                ) : (
                  <span className="muted">{accountName || p.platform}</span>
                )}
                {p.isDryRun || p.isMockPost ? <span className="badge warn">dry-run / mock</span> : null}
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
