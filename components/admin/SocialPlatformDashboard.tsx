'use client'

import { PlatformIconLink } from '@/components/admin/PlatformIconLink'
import { platformProfileUrl } from '@/lib/social/platformLinks'

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
}

type OAuthSlot = {
  configured: boolean
  clientIdSet?: boolean
  clientSecretSet?: boolean
  callbackUrl: string
  organizationId?: string | null
}

type EnvCheck = {
  X_CLIENT_ID: boolean
  X_CLIENT_SECRET: boolean
  LINKEDIN_CLIENT_ID: boolean
  LINKEDIN_CLIENT_SECRET: boolean
  ready: boolean
}

type PipelineOnlyPlatform = {
  id: string
  label: string
  short: string
  note: string
}

const PIPELINE_PLATFORMS: PipelineOnlyPlatform[] = [
  { id: 'YOUTUBE', label: 'YouTube', short: 'YT', note: 'Pipeline video script — yayın API yakında' },
  { id: 'INSTAGRAM', label: 'Instagram', short: 'IG', note: 'Pipeline caption — yayın API yakında' },
  { id: 'TIKTOK', label: 'TikTok', short: 'TT', note: 'Pipeline kısa video script — yayın API yakında' },
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

export function SocialPlatformDashboard({
  accounts,
  oauth,
  envCheck,
  busyId,
  onOAuthConnect,
  onDryConnect,
  onDisconnect,
  onSyncStats,
  onRepair,
}: {
  accounts: PlatformCardAccount[]
  oauth: { twitter: OAuthSlot; linkedin: OAuthSlot } | null
  envCheck: EnvCheck | null
  busyId: string | null
  onOAuthConnect: (p: 'TWITTER' | 'LINKEDIN') => void
  onDryConnect: (p: 'TWITTER' | 'LINKEDIN') => void
  onDisconnect: (id: string) => void
  onSyncStats: () => void
  onRepair: () => void
}) {
  const twitterAccount = accounts.find((a) => a.platform === 'TWITTER' && a.isActive)
  const linkedinAccount = accounts.find((a) => a.platform === 'LINKEDIN' && a.isActive)

  function renderPublishCard(
    platform: 'TWITTER' | 'LINKEDIN',
    label: string,
    account: PlatformCardAccount | undefined,
    oauthSlot: OAuthSlot | undefined,
  ) {
    const stats = account?.stats
    const username = account?.username || account?.accountName || '—'
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
            <a
              href={stats.profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="sm-profile-link"
            >
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
          <p className="muted sm-sync-time">
            Son senkron: {new Date(stats.fetchedAt).toLocaleString('tr-TR')}
          </p>
        ) : null}
        {stats?.error ? <p className="muted sm-sync-error">{stats.error}</p> : null}

        <div className="sm-platform-actions row">
          {oauthSlot?.configured ? (
            <button
              type="button"
              className="ok"
              disabled={busyId === platform}
              onClick={() => onOAuthConnect(platform)}
            >
              OAuth bağla
            </button>
          ) : (
            <span className="badge warn">env eksik</span>
          )}
          <button type="button" className="secondary" onClick={() => onDryConnect(platform)}>
            Dry-run
          </button>
          {account?.isActive ? (
            <button
              type="button"
              className="secondary"
              disabled={busyId === account.id}
              onClick={() => onDisconnect(account.id)}
            >
              Kes
            </button>
          ) : null}
        </div>

        {platform === 'LINKEDIN' && oauth?.linkedin ? (
          <p className="muted" style={{ margin: '0.5rem 0 0', fontSize: '0.78rem' }}>
            {oauth.linkedin.organizationId
              ? `Org ID: ${oauth.linkedin.organizationId}`
              : 'Kişisel hesap modu'}
          </p>
        ) : null}
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
            <p className="row" style={{ marginTop: '0.65rem' }}>
              {envCheck.ready ? (
                <span className="badge ok">OAuth env tamam — bağlanabilir</span>
              ) : (
                <span className="badge danger">Eksik env — OAuth çalışmaz (dry-run kullan)</span>
              )}
            </p>
          </>
        ) : null}
        <div className="row" style={{ marginTop: '0.75rem' }}>
          <button type="button" className="secondary" disabled={busyId === 'sync-stats'} onClick={onSyncStats}>
            İstatistikleri yenile
          </button>
          <button type="button" className="secondary" disabled={busyId === 'repair'} onClick={onRepair}>
            Eksik hesapları tamamla
          </button>
        </div>
      </section>

      <div className="sm-platform-grid">
        {renderPublishCard('TWITTER', 'X', twitterAccount, oauth?.twitter)}
        {renderPublishCard('LINKEDIN', 'LinkedIn', linkedinAccount, oauth?.linkedin)}
        {PIPELINE_PLATFORMS.map((p) => (
          <article className="sm-platform-card panel sm-pipeline-only" key={p.id}>
            <PlatformIconLink platform={p.id} title={`${p.label} (yeni sekme)`} />
            <h3 className="sm-username">{p.short}</h3>
            <p className="muted" style={{ margin: '0.35rem 0 0' }}>{p.note}</p>
            <div className="sm-stats-grid">
              <StatCell label="Takipçi" value={null} />
              <StatCell label="Gösterim" value={null} />
              <StatCell label="Etkileşim" value={null} />
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
