'use client'

import { socialPostPublicUrl } from '@/lib/social/postUrl'
import { PlatformIconLink } from '@/components/admin/PlatformIconLink'
import { HoverExpandList, HoverExpandRow, hoverSnippet } from '@/components/admin/HoverExpandList'
import { SEGMENT_LABELS, isAudienceSegment } from '@/lib/audience/segments'

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
  segment?: string | null
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

function segmentLabel(segment?: string | null): string {
  if (segment && isAudienceSegment(segment)) return SEGMENT_LABELS[segment]
  return 'Segment yok'
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
    <HoverExpandList>
      {posts.map((p) => {
        const publicUrl = socialPostPublicUrl(p.platform, p.platformPostId)
        const accountName = p.account?.accountName
        const a = p.analytics
        return (
          <HoverExpandRow
            key={p.id}
            summary={
              <>
                <PlatformIconLink platform={p.platform} username={accountName} />
                <span
                  className={
                    p.segment && isAudienceSegment(p.segment)
                      ? 'hover-row-chip'
                      : 'hover-row-chip muted'
                  }
                  title="Hedef kitle segmenti"
                >
                  {segmentLabel(p.segment)}
                </span>
                <span className="hover-row-line">{hoverSnippet(p.postContent)}</span>
                {a?.engagement != null ? (
                  <span className="hover-row-chip">{a.engagement.toLocaleString('tr-TR')}</span>
                ) : null}
                <time className="muted hover-row-when">{formatWhen(p.publishedAt || p.createdAt)}</time>
              </>
            }
          >
            <p className="hover-row-preview">{p.postContent.trim() || '(içerik yok)'}</p>
            {p.imagePreviewUrl ? (
              <img src={p.imagePreviewUrl} alt="" className="hover-row-thumb" loading="lazy" />
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
            <div className="hover-row-actions row">
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
          </HoverExpandRow>
        )
      })}
    </HoverExpandList>
  )
}
