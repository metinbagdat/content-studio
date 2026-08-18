'use client'

export type CaptionPlatformBreakdown = {
  platform: string
  approvedCount: number
  draftCount: number
  publishedCount: number
  failedCount: number
  hasAccount: boolean
  isPublishable: boolean
  reason: string
}

export type DraftDiagnostics = {
  totalApprovedCaptions: number
  totalDrafts: number
  totalPublished: number
  totalFailed: number
  unsupportedApprovedCount: number
  breakdown: CaptionPlatformBreakdown[]
}

function platformLabel(p: string): string {
  switch (p) {
    case 'TWITTER':
      return 'X'
    case 'LINKEDIN':
      return 'LinkedIn'
    case 'INSTAGRAM':
      return 'Instagram'
    case 'FACEBOOK':
      return 'Facebook'
    case 'PINTEREST':
      return 'Pinterest'
    case 'YOUTUBE':
      return 'YouTube'
    case 'TIKTOK':
      return 'TikTok'
    default:
      return p
  }
}

export function DraftDiagnosticsPanel({
  diagnostics,
  onBulkPublish,
  bulkBusy,
}: {
  diagnostics: DraftDiagnostics | null
  onBulkPublish: (includeDryRun: boolean) => void
  bulkBusy: boolean
}) {
  if (!diagnostics) return null

  const readyToPublish = diagnostics.breakdown.some(
    (b) => b.isPublishable && b.hasAccount && b.draftCount > 0,
  )

  return (
    <section className="panel" style={{ marginBottom: '1rem' }}>
      <h2>Neden yayın yok? — tanılama</h2>
      <p className="muted" style={{ marginTop: 0, fontSize: '0.88rem' }}>
        {diagnostics.totalApprovedCaptions} onaylı içerik · {diagnostics.totalDrafts} taslak ·{' '}
        {diagnostics.totalPublished} yayında
        {diagnostics.totalFailed ? ` · ${diagnostics.totalFailed} başarısız` : ''}
        {diagnostics.unsupportedApprovedCount
          ? ` · ${diagnostics.unsupportedApprovedCount} içerik desteklenmeyen platform için (yayınlanamaz)`
          : ''}
      </p>

      <div className="diag-table">
        <div className="diag-row diag-head">
          <span>Platform</span>
          <span>Onaylı</span>
          <span>Taslak</span>
          <span>Yayında</span>
          <span>Durum</span>
        </div>
        {diagnostics.breakdown.map((b) => (
          <div className="diag-row" key={b.platform}>
            <span className="diag-platform" data-label="Platform">{platformLabel(b.platform)}</span>
            <span data-label="Onaylı">{b.approvedCount}</span>
            <span data-label="Taslak">{b.draftCount || '—'}</span>
            <span data-label="Yayında">{b.publishedCount || '—'}</span>
            <span
              data-label="Durum"
              className={
                !b.isPublishable
                  ? 'diag-reason diag-unsupported'
                  : !b.hasAccount
                    ? 'diag-reason diag-missing'
                    : b.draftCount === 0 && b.publishedCount === 0
                      ? 'diag-reason diag-missing'
                      : b.publishedCount === 0
                        ? 'diag-reason diag-pending'
                        : 'diag-reason diag-ok'
              }
            >
              {b.reason}
            </span>
          </div>
        ))}
      </div>

      {readyToPublish ? (
        <div className="row" style={{ marginTop: '0.85rem' }}>
          <button type="button" className="ok" disabled={bulkBusy} onClick={() => onBulkPublish(false)}>
            {bulkBusy ? 'Yayınlanıyor…' : 'Hazır taslakları toplu yayınla'}
          </button>
          <span className="muted" style={{ fontSize: '0.8rem' }}>Dry-run hesaplar hariç tutulur</span>
        </div>
      ) : null}
    </section>
  )
}
