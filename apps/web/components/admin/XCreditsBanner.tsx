'use client'

import { BtnInfoMark } from '@/components/admin/BtnInfoMark'

export type XCreditsBannerStatus = {
  level: 'ok' | 'low' | 'exhausted' | 'unknown'
  totalBalanceUsd: number | null
  failedCreditPosts: number
  billingUrl: string
  message: string
  source?: string
}

function formatUsd(n: number): string {
  return n.toLocaleString('tr-TR', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  })
}

/**
 * Admin warning for X pay-per-use credits — remaining balance + top-up link.
 */
export function XCreditsBanner({ status }: { status: XCreditsBannerStatus | null }) {
  if (!status) {
    return (
      <p className="flash" style={{ marginTop: '0.5rem' }}>
        <strong>X (Twitter):</strong> Toplu yayın 402 / credits depleted →{' '}
        <a href="https://console.x.com" target="_blank" rel="noreferrer">
          console.x.com → Billing → Credits
        </a>{' '}
        kredi yükle; FB/LI/YT ayrı kartlardan devam eder.
      </p>
    )
  }

  const flashClass =
    status.level === 'exhausted' || status.level === 'low'
      ? 'flash error'
      : status.level === 'ok'
        ? 'flash'
        : 'flash'

  const balance =
    typeof status.totalBalanceUsd === 'number' ? (
      <span className="badge" style={{ marginLeft: '0.35rem' }} title="Spendable X API kredisi (USD)">
        Kalan: {formatUsd(status.totalBalanceUsd)}
      </span>
    ) : null

  const levelBadge =
    status.level === 'exhausted' ? (
      <span className="badge danger">kredi tükendi</span>
    ) : status.level === 'low' ? (
      <span className="badge warn">kredi düşük</span>
    ) : status.level === 'ok' ? (
      <span className="badge ok">kredi OK</span>
    ) : (
      <span className="badge warn">bakiye bilinmiyor</span>
    )

  return (
    <p className={flashClass} style={{ marginTop: '0.5rem' }} data-testid="x-credits-banner">
      <span className="row" style={{ flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' }}>
        <strong>X API kredisi</strong>
        {levelBadge}
        {balance}
        <a
          className="has-info"
          href={status.billingUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="X Developer Console → Billing → Credits: kredi yükle / satın al"
          style={{ marginLeft: '0.25rem' }}
        >
          Kredi yükle ↗
          <BtnInfoMark />
        </a>
      </span>
      <span style={{ display: 'block', marginTop: '0.35rem' }}>{status.message}</span>
      {status.failedCreditPosts > 0 && status.level === 'ok' ? (
        <span className="muted" style={{ display: 'block', marginTop: '0.25rem', fontSize: '0.85rem' }}>
          Not: {status.failedCreditPosts} eski FAILED post hâlâ kredi hatası kaydı taşıyor — kredi yüklendiyse
          yeniden yayınlayın.
        </span>
      ) : null}
    </p>
  )
}
