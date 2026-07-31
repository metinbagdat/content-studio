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
    return new Date(iso).toLocaleString('tr-TR')
  } catch {
    return iso
  }
}

function PostImagePreview({ src }: { src: string }) {
  return (
    <img
      src={src}
      alt=""
      className="published-post-thumb"
      loading="lazy"
    />
  )
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
        return (
          <li key={p.id} className="published-post-card">
            <div className="published-post-head row">
              <PlatformIconLink platform={p.platform} username={accountName} />
              <strong>{accountName || 'Hesap'}</strong>
              {p.isDryRun || p.isMockPost ? <span className="badge warn">dry-run / mock</span> : null}
              <time className="muted">{formatWhen(p.publishedAt || p.createdAt)}</time>
            </div>
            <p className="published-post-preview">{p.postContent.slice(0, 200).trim()}</p>
            {p.imagePreviewUrl ? <PostImagePreview src={p.imagePreviewUrl} /> : null}
            {p.analytics ? (
              <div className="sm-post-stats row">
                {p.analytics.impressions != null ? (
                  <span className="badge">gösterim {p.analytics.impressions.toLocaleString('tr-TR')}</span>
                ) : null}
                {p.analytics.engagement != null ? (
                  <span className="badge ok">etkileşim {p.analytics.engagement.toLocaleString('tr-TR')}</span>
                ) : null}
                {p.analytics.likes != null ? (
                  <span className="badge">beğeni {p.analytics.likes.toLocaleString('tr-TR')}</span>
                ) : null}
                {p.analytics.comments != null ? (
                  <span className="badge">yorum {p.analytics.comments.toLocaleString('tr-TR')}</span>
                ) : null}
                {p.analytics.shares != null ? (
                  <span className="badge">paylaşım {p.analytics.shares.toLocaleString('tr-TR')}</span>
                ) : null}
                {p.analytics.clicks != null ? (
                  <span className="badge">tıklama {p.analytics.clicks.toLocaleString('tr-TR')}</span>
                ) : null}
              </div>
            ) : (
              <p className="muted" style={{ fontSize: '0.78rem', margin: '0.35rem 0 0' }}>
                Metrik yok — Sosyal’de «İstatistikleri yenile»
              </p>
            )}
            <div className="published-post-actions row">
              {publicUrl ? (
                <a
                  href={publicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn ok"
                  style={{ textDecoration: 'none' }}
                >
                  Paylaşımı yeni sekmede aç ↗
                </a>
              ) : p.platformPostId ? (
                <span className="muted">mock: {p.platformPostId}</span>
              ) : null}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
