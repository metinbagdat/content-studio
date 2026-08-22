'use client'

import { PlatformIconLink } from '@/components/admin/PlatformIconLink'
import { HoverExpandList, HoverExpandRow, hoverSnippet } from '@/components/admin/HoverExpandList'
import type { EngagementDigest } from '@/lib/social/engagementDigest'

export function EngagementDigestPanel({
  digest,
  busy,
  onRefresh,
  autoNote,
}: {
  digest: EngagementDigest | null
  busy: boolean
  onRefresh: () => void
  /** Shown when page auto-loads the digest */
  autoNote?: string
}) {
  const topic = digest?.topic

  return (
    <section className="panel digest-panel" style={{ marginBottom: '1rem' }} id="yorumlar">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
        <div>
          <h2 style={{ margin: 0 }}>Yorumlar</h2>
          <p className="muted" style={{ margin: '0.35rem 0 0', fontSize: '0.88rem' }}>
            Salt okuma — DM/yorum yanıtı yok. Gelen yorum ve geri bildirim otomatik derlenir; içerik
            değişikliklerini buradan kontrol edersin.
          </p>
        </div>
        <button type="button" className="secondary" disabled={busy} onClick={onRefresh}>
          {busy ? 'Derleniyor…' : 'Derlemeyi yenile'}
        </button>
      </div>

      {autoNote ? (
        <p className="muted" style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>
          {autoNote}
        </p>
      ) : null}

      {!digest ? (
        <p className="muted" style={{ marginTop: '0.75rem' }}>
          İlk derleme için «Derlemeyi yenile» — LinkedIn/X (ve metrikli diğer) yayınlardan yorum sinyali
          toplanır.
        </p>
      ) : (
        <>
          {topic ? (
            <article className="digest-topic" aria-labelledby="digest-topic-title">
              <header>
                <p className="digest-topic-kicker">Konsolide özet konusu</p>
                <h3 id="digest-topic-title" style={{ margin: '0.2rem 0 0' }}>
                  {topic.title}
                </h3>
                <p className="digest-topic-headline">{topic.headline}</p>
              </header>
              <p className="digest-topic-body">{topic.body}</p>

              <div className="digest-topic-stats row">
                <span className="badge">{topic.stats.postsScanned} gönderi</span>
                <span className="badge ok">{topic.stats.totalComments} yorum</span>
                <span className="badge">{topic.stats.withComments} yorumlu</span>
                <span className="badge">{topic.stats.totalEngagement} etk.</span>
                {topic.stats.topPlatform ? (
                  <span className="badge warn">yoğun: {topic.stats.topPlatform}</span>
                ) : null}
              </div>

              {topic.themes.length ? (
                <div className="digest-themes">
                  <h4 style={{ margin: '0.85rem 0 0.35rem', fontSize: '0.92rem' }}>Temalar</h4>
                  <ul>
                    {topic.themes.map((t) => (
                      <li key={t.id}>
                        <strong>{t.label}</strong>
                        <span className="muted"> · {t.signal}</span>
                        <br />
                        <span className="digest-theme-hint">{t.changeHint}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {topic.changeChecklist.length ? (
                <div className="digest-checklist">
                  <h4 style={{ margin: '0.85rem 0 0.35rem', fontSize: '0.92rem' }}>
                    İçerik değişiklik kontrol listesi
                  </h4>
                  <ol>
                    {topic.changeChecklist.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ol>
                </div>
              ) : null}

              {topic.sampleQuotes.length ? (
                <div className="digest-quotes">
                  <h4 style={{ margin: '0.85rem 0 0.35rem', fontSize: '0.92rem' }}>Örnek yorumlar</h4>
                  <ul className="digest-comments">
                    {topic.sampleQuotes.map((q, i) => (
                      <li key={i}>
                        <q>{q}</q>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </article>
          ) : null}

          <p className="muted" style={{ fontSize: '0.8rem', marginTop: '0.85rem' }}>
            {digest.note} · senkron {digest.synced}
            {digest.syncErrors.length ? ` · ${digest.syncErrors.length} senkron uyarısı` : ''} ·{' '}
            {new Date(digest.fetchedAt).toLocaleString('tr-TR')}
          </p>

          <h3 style={{ margin: '1rem 0 0.35rem', fontSize: '1rem' }}>Gönderi bazlı sinyal</h3>
          {!digest.posts.length ? (
            <p className="muted">Henüz yorum/etkileşimli yayın yok — yayınla, sonra yeniden derle.</p>
          ) : (
            <div style={{ marginTop: '0.45rem' }}>
            <HoverExpandList>
              {digest.posts.map((p) => (
                <HoverExpandRow
                  key={p.id}
                  summary={
                    <>
                      <PlatformIconLink platform={p.platform} />
                      <span className="hover-row-line">{hoverSnippet(p.preview, 80)}</span>
                      <span className="hover-row-chip">
                        {p.comments} yorum · {p.engagement} etk.
                      </span>
                      <time className="muted hover-row-when">
                        {p.publishedAt
                          ? new Date(p.publishedAt).toLocaleString('tr-TR', {
                              day: '2-digit',
                              month: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '—'}
                      </time>
                    </>
                  }
                >
                  <div className="sm-post-stats row">
                    <span className="badge ok">yorum {p.comments}</span>
                    {p.likes != null ? <span className="badge">beğeni {p.likes}</span> : null}
                    {p.shares != null ? <span className="badge">paylaşım {p.shares}</span> : null}
                    {p.impressions != null ? (
                      <span className="badge">gösterim {p.impressions}</span>
                    ) : null}
                  </div>

                  {p.commentSamples.length ? (
                    <ul className="digest-comments">
                      {p.commentSamples.map((c, i) => (
                        <li key={i}>
                          <q>{c.text}</q>
                        </li>
                      ))}
                    </ul>
                  ) : p.commentFetchNote ? (
                    <p className="muted" style={{ fontSize: '0.78rem', margin: '0.4rem 0 0' }}>
                      {p.commentFetchNote}
                    </p>
                  ) : null}

                  {p.suggestions.length ? (
                    <ul className="digest-suggestions">
                      {p.suggestions.map((s, i) => (
                        <li key={i}>
                          <strong>{s.kind}:</strong> {s.text}
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  <div className="hover-row-actions row">
                    {p.publicUrl ? (
                      <a href={p.publicUrl} target="_blank" rel="noopener noreferrer">
                        Gönderiyi aç ↗
                      </a>
                    ) : (
                      <span className="muted">{p.platform}</span>
                    )}
                    <span className="badge">yanıt yok</span>
                  </div>
                </HoverExpandRow>
              ))}
            </HoverExpandList>
            </div>
          )}
        </>
      )}
    </section>
  )
}
