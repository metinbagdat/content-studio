'use client'

import { PlatformIconLink } from '@/components/admin/PlatformIconLink'
import { platformLabel, platformProfileUrl } from '@/lib/social/platformLinks'

export type PlatformAccountStats = {
  username: string | null
  displayName: string | null
  profileUrl: string | null
  followers: number | null
  following: number | null
  postsCount: number | null
  impressions: number | null
  engagement: number | null
  likes: number | null
  comments: number | null
  shares: number | null
  clicks: number | null
  fetchedAt: string | null
  error?: string
}

export type PlatformCardAccount = {
  id: string
  platform: string
  accountName: string
  username?: string | null
  isActive: boolean
  dryRun?: boolean
  oauth?: boolean
  stats?: Partial<PlatformAccountStats> | null
  lastSyncAt?: string | null
  organizationId?: string | null
  linkedinAuthorUrn?: string | null
}

export type ReadyDraft = { id: string; preview: string; accountName: string; isDryRun: boolean }
export type RecentPublished = { id: string; preview: string; publishedAt: string; url: string | null }

type OAuthSlot = {
  configured: boolean
  clientIdSet?: boolean
  clientSecretSet?: boolean
  callbackUrl: string
  organizationId?: string | null
  orgPostEnabled?: boolean
  scopes?: string
}

type EnvCheck = {
  X_CLIENT_ID: boolean
  X_CLIENT_SECRET: boolean
  LINKEDIN_CLIENT_ID: boolean
  LINKEDIN_CLIENT_SECRET: boolean
  YOUTUBE_CLIENT_ID: boolean
  YOUTUBE_CLIENT_SECRET: boolean
  ready: boolean
}

type PipelinePlatformDef = {
  id: string
  note: string
  oauthKey?: 'youtube'
}

const PIPELINE_PLATFORMS: PipelinePlatformDef[] = [
  {
    id: 'YOUTUBE',
    oauthKey: 'youtube',
    note: 'OAuth bağla → Video senkronize: onaylı scriptlerden watermarked MP4 üretir ve YouTube\'a yükler.',
  },
  { id: 'INSTAGRAM', note: 'Pipeline caption üretir. Yayın için Meta Graph API entegrasyonu Faz 2.' },
  { id: 'TIKTOK', note: 'Pipeline kısa video script üretir. Yayın için TikTok API entegrasyonu Faz 2.' },
  { id: 'FACEBOOK', note: 'Pipeline caption üretir. Yayın için Meta Graph API entegrasyonu Faz 2.' },
]

function StatCell({ label, value }: { label: string; value: string | number | null | undefined }) {
  const display = value == null ? '—' : typeof value === 'number' ? value.toLocaleString('tr-TR') : value
  return (
    <div className="sm-stat-cell">
      <span className="sm-stat-label">{label}</span>
      <span className="sm-stat-value">{display}</span>
    </div>
  )
}

function EnvRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="row" style={{ marginBottom: '0.25rem' }}>
      <code style={{ fontSize: '0.8rem' }}>{label}</code>
      <span className={ok ? 'badge ok' : 'badge danger'}>{ok ? 'tanımlı' : 'eksik'}</span>
    </div>
  )
}

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString('tr-TR')
  } catch {
    return iso
  }
}

function ReadyDraftsList({
  drafts,
  busyId,
  onPublish,
}: {
  drafts: ReadyDraft[]
  busyId: string | null
  onPublish: (id: string) => void
}) {
  if (!drafts.length) return null
  return (
    <div className="sm-mini-list">
      <strong className="sm-mini-heading">Hazır taslaklar ({drafts.length})</strong>
      <ul className="sm-mini-items">
        {drafts.slice(0, 4).map((d) => (
          <li key={d.id} className="sm-mini-item">
            <span className="sm-mini-preview">{d.preview || '(içerik yok)'}</span>
            <div className="row" style={{ marginTop: '0.3rem' }}>
              {d.isDryRun ? <span className="badge warn">dry-run</span> : null}
              <button
                type="button"
                className="ok sm-mini-btn"
                disabled={busyId === d.id}
                onClick={() => onPublish(d.id)}
              >
                Yayınla
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function RecentPublishedList({ items }: { items: RecentPublished[] }) {
  if (!items.length) return null
  return (
    <div className="sm-mini-list">
      <strong className="sm-mini-heading">Son yayınlar</strong>
      <ul className="sm-mini-items">
        {items.map((p) => (
          <li key={p.id} className="sm-mini-item">
            <span className="sm-mini-preview">{p.preview || '(içerik yok)'}</span>
            <div className="row muted" style={{ marginTop: '0.25rem', fontSize: '0.76rem' }}>
              <time>{formatWhen(p.publishedAt)}</time>
              {p.url ? (
                <a href={p.url} target="_blank" rel="noopener noreferrer">
                  Aç ↗
                </a>
              ) : (
                <span>mock — gerçek linki yok</span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function SocialPlatformDashboard({
  accounts,
  oauth,
  envCheck,
  busyId,
  readyDraftsByPlatform,
  recentPublishedByPlatform,
  onOAuthConnect,
  onDryConnect,
  onDisconnect,
  onSyncStats,
  onRepair,
  onPublishDraft,
  onYoutubeTest,
  onYoutubeSync,
}: {
  accounts: PlatformCardAccount[]
  oauth: { twitter: OAuthSlot; linkedin: OAuthSlot; youtube?: OAuthSlot } | null
  envCheck: EnvCheck | null
  busyId: string | null
  readyDraftsByPlatform: Record<string, ReadyDraft[]>
  recentPublishedByPlatform: Record<string, RecentPublished[]>
  onOAuthConnect: (p: 'TWITTER' | 'LINKEDIN' | 'YOUTUBE') => void
  onDryConnect: (p: string) => void
  onDisconnect: (id: string) => void
  onSyncStats: () => void
  onRepair: () => void
  onPublishDraft: (id: string) => void
  onYoutubeTest?: () => void
  onYoutubeSync?: () => void
}) {
  const twitterAccount = accounts.find((a) => a.platform === 'TWITTER' && a.isActive)
  const linkedinAccount = accounts.find((a) => a.platform === 'LINKEDIN' && a.isActive)

  const linkedinWantsOrg = Boolean(oauth?.linkedin.orgPostEnabled && oauth?.linkedin.organizationId)
  const linkedinIsOnOrg =
    linkedinAccount?.organizationId === oauth?.linkedin.organizationId ||
    linkedinAccount?.linkedinAuthorUrn?.startsWith('urn:li:organization:')
  const linkedinNeedsReconnect = Boolean(
    linkedinAccount && !linkedinAccount.dryRun && linkedinWantsOrg && !linkedinIsOnOrg,
  )

  function renderPublishCard(
    platform: 'TWITTER' | 'LINKEDIN',
    label: string,
    account: PlatformCardAccount | undefined,
    oauthSlot: OAuthSlot | undefined,
  ) {
    const stats = account?.stats
    const username = account?.username || account?.accountName || '—'
    const drafts = readyDraftsByPlatform[platform] || []
    const published = recentPublishedByPlatform[platform] || []
    return (
      <article className="sm-platform-card panel" key={platform}>
        <header className="sm-platform-head">
          <div className="row">
            <PlatformIconLink
              platform={platform}
              username={account?.username || stats?.username}
              profileUrl={stats?.profileUrl}
            />
            {account?.dryRun ? <span className="badge warn">dry-run</span> : null}
            {account?.oauth ? <span className="badge ok">OAuth</span> : null}
            {account?.isActive ? <span className="badge ok">aktif</span> : <span className="badge danger">yok</span>}
          </div>
          {stats?.profileUrl ? (
            <a href={stats.profileUrl} target="_blank" rel="noopener noreferrer" className="sm-profile-link">
              Profil ↗
            </a>
          ) : null}
        </header>

        <h3 className="sm-username">
          {stats?.profileUrl || platformProfileUrl(platform, username, stats?.profileUrl) ? (
            <a
              href={platformProfileUrl(platform, username, stats?.profileUrl) || stats?.profileUrl || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="sm-username-link"
            >
              {username} ↗
            </a>
          ) : (
            username
          )}
        </h3>
        {stats?.displayName && stats.displayName !== username ? (
          <p className="muted sm-display-name">{stats.displayName}</p>
        ) : null}

        <div className="sm-stats-grid">
          <StatCell label="Takipçi" value={stats?.followers} />
          <StatCell label="Gösterim" value={stats?.impressions} />
          <StatCell label="Etkileşim" value={stats?.engagement} />
          <StatCell label="Beğeni" value={stats?.likes} />
          <StatCell label="Yorum" value={stats?.comments} />
          <StatCell label="Paylaşım" value={stats?.shares} />
          <StatCell label="Tıklama" value={stats?.clicks} />
          <StatCell label="Post sayısı" value={stats?.postsCount} />
        </div>

        {stats?.fetchedAt ? (
          <p className="muted sm-sync-time">Son senkron: {formatWhen(stats.fetchedAt)}</p>
        ) : null}
        {stats?.error ? <p className="muted sm-sync-error">{stats.error}</p> : null}

        <div className="sm-platform-actions row">
          {oauthSlot?.configured ? (
            <button type="button" className="ok" disabled={busyId === platform} onClick={() => onOAuthConnect(platform)}>
              OAuth bağla
            </button>
          ) : (
            <span className="badge warn">env eksik</span>
          )}
          {!envCheck?.ready ? (
            <button type="button" className="secondary" disabled={busyId === `dry-${platform}`} onClick={() => onDryConnect(platform)}>
              Dry-run
            </button>
          ) : null}
          {account?.isActive ? (
            <button type="button" className="secondary" disabled={busyId === account.id} onClick={() => onDisconnect(account.id)}>
              Kes
            </button>
          ) : null}
        </div>

        {platform === 'LINKEDIN' && oauth?.linkedin ? (
          <p className="muted" style={{ margin: '0.5rem 0 0', fontSize: '0.78rem' }}>
            {oauth.linkedin.organizationId ? (
              oauth.linkedin.orgPostEnabled ? (
                linkedinNeedsReconnect ? (
                  <>
                    <strong style={{ color: 'var(--warn)' }}>Yeniden bağlan gerekiyor:</strong> LINKEDIN_ORG_POST
                    sonradan açıldı — bağlı hesap hâlâ kişisel izinlerle çalışıyor. <strong>Kes</strong> sonra{' '}
                    <strong>OAuth bağla</strong> ile şirket sayfası iznini onaylayın.
                  </>
                ) : (
                  `Şirket sayfasından paylaşır — Org ID: ${oauth.linkedin.organizationId}`
                )
              ) : (
                <>
                  <strong style={{ color: 'var(--warn)' }}>Dikkat:</strong> Org ID tanımlı (
                  {oauth.linkedin.organizationId}) ama <code>LINKEDIN_ORG_POST=true</code> değil → postlar{' '}
                  <strong>kişisel profilden</strong> gider.
                </>
              )
            ) : (
              'Kişisel hesap modu — takipçi sayısı LinkedIn API ile alınamaz (izin gerektirir)'
            )}
          </p>
        ) : null}

        <ReadyDraftsList drafts={drafts} busyId={busyId} onPublish={onPublishDraft} />
        <RecentPublishedList items={published} />
      </article>
    )
  }

  return (
    <div className="sm-dashboard">
      <section className="panel sm-env-panel">
        <h2>OAuth env kontrolü</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Değerler gösterilmez — yalnızca <code>.env</code> / <code>.env.local</code> içinde tanımlı mı kontrol edilir.
          Dev sunucuyu yeniden başlatın (<code>npm run dev</code>) env değişince.
        </p>
        {envCheck ? (
          <>
            <EnvRow label="X_CLIENT_ID" ok={envCheck.X_CLIENT_ID} />
            <EnvRow label="X_CLIENT_SECRET" ok={envCheck.X_CLIENT_SECRET} />
            <EnvRow label="LINKEDIN_CLIENT_ID" ok={envCheck.LINKEDIN_CLIENT_ID} />
            <EnvRow label="LINKEDIN_CLIENT_SECRET" ok={envCheck.LINKEDIN_CLIENT_SECRET} />
            <EnvRow label="YOUTUBE_CLIENT_ID" ok={envCheck.YOUTUBE_CLIENT_ID} />
            <EnvRow label="YOUTUBE_CLIENT_SECRET" ok={envCheck.YOUTUBE_CLIENT_SECRET} />
            <p className="row" style={{ marginTop: '0.65rem' }}>
              {envCheck.ready ? (
                <span className="badge ok">OAuth env tamam — kartlardan OAuth bağla</span>
              ) : (
                <span className="badge danger">Eksik env — .env kontrol et</span>
              )}
            </p>
          </>
        ) : null}
        <div className="row" style={{ marginTop: '0.75rem' }}>
          <button type="button" className="secondary" disabled={busyId === 'sync-stats'} onClick={onSyncStats}>
            İstatistikleri yenile
          </button>
          <button type="button" className="secondary" disabled={busyId === 'repair'} onClick={onRepair}>
            {envCheck?.ready ? 'Faz 2 dry-run hesapları tamamla' : 'Eksik hesapları tamamla (dry-run)'}
          </button>
        </div>
        {envCheck?.ready ? (
          <ul className="muted" style={{ margin: '0.75rem 0 0', fontSize: '0.82rem', paddingLeft: '1.1rem' }}>
            <li>
              <strong>X:</strong> Developer Portal → kredi yükle → başarısız postlar otomatik yeniden denenecek
            </li>
            <li>
              <strong>LinkedIn şirket sayfası:</strong> Page ID → <code>LINKEDIN_ORGANIZATION_ID</code> +{' '}
              <code>LINKEDIN_ORG_POST=true</code> → Kes → OAuth yeniden bağla
            </li>
            <li>
              <strong>Worker:</strong> <code>npm run worker</code> açık olmalı (zamanlanmış yayın)
            </li>
          </ul>
        ) : null}
      </section>

      <div className="sm-platform-grid">
        {renderPublishCard('TWITTER', 'X', twitterAccount, oauth?.twitter)}
        {renderPublishCard('LINKEDIN', 'LinkedIn', linkedinAccount, oauth?.linkedin)}
        {PIPELINE_PLATFORMS.map((p) => {
          const account = accounts.find((a) => a.platform === p.id && a.isActive)
          const drafts = readyDraftsByPlatform[p.id] || []
          const published = recentPublishedByPlatform[p.id] || []
          const oauthSlot = p.oauthKey === 'youtube' ? oauth?.youtube : undefined
          return (
            <article className="sm-platform-card panel sm-pipeline-only" key={p.id}>
              <header className="sm-platform-head">
                <div className="row">
                  <PlatformIconLink platform={p.id} title={`${platformLabel(p.id)} (yeni sekme)`} />
                  {account?.oauth ? <span className="badge ok">oauth</span> : null}
                  {account?.dryRun ? <span className="badge warn">dry-run</span> : null}
                  {account?.isActive ? <span className="badge ok">aktif</span> : <span className="badge">bağlı değil</span>}
                </div>
              </header>
              <h3 className="sm-username">{account?.accountName || platformLabel(p.id)}</h3>
              <p className="muted" style={{ margin: '0.35rem 0 0.65rem' }}>{p.note}</p>
              <div className="sm-stats-grid">
                <StatCell label="Takipçi" value={null} />
                <StatCell label="Gösterim" value={null} />
                <StatCell label="Etkileşim" value={null} />
              </div>
              <div className="sm-platform-actions row">
                {oauthSlot?.configured ? (
                  <button
                    type="button"
                    className="ok"
                    disabled={busyId === p.id}
                    onClick={() => onOAuthConnect('YOUTUBE')}
                  >
                    OAuth bağla
                  </button>
                ) : null}
                {oauthSlot?.configured && account?.oauth && onYoutubeTest ? (
                  <button
                    type="button"
                    className="secondary"
                    disabled={busyId === 'youtube-test'}
                    onClick={onYoutubeTest}
                  >
                    API test
                  </button>
                ) : null}
                {oauthSlot?.configured && account?.oauth && onYoutubeSync ? (
                  <button
                    type="button"
                    className="ok"
                    disabled={busyId === 'youtube-sync'}
                    onClick={onYoutubeSync}
                  >
                    Video senkronize
                  </button>
                ) : null}
                {!oauthSlot?.configured ? (
                  <button
                    type="button"
                    className="secondary"
                    disabled={busyId === `dry-${p.id}`}
                    onClick={() => onDryConnect(p.id)}
                  >
                    {account?.isActive ? 'Dry-run yenile' : 'Dry-run bağla (altyapı testi)'}
                  </button>
                ) : null}
                {account?.isActive ? (
                  <button type="button" className="secondary" disabled={busyId === account.id} onClick={() => onDisconnect(account.id)}>
                    Kes
                  </button>
                ) : null}
              </div>
              <ReadyDraftsList drafts={drafts} busyId={busyId} onPublish={onPublishDraft} />
              <RecentPublishedList items={published} />
            </article>
          )
        })}
      </div>
    </div>
  )
}
