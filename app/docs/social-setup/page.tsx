import Link from 'next/link'

export default function SocialSetupDocPage() {
  return (
    <div>
      <h1>Sosyal medya hesapları</h1>
      <p className="lead">egitim.today tanıtımı — hesap açma sırası ve OAuth.</p>

      <section className="panel">
        <h2>Öncelik</h2>
        <ol className="muted" style={{ lineHeight: 1.8 }}>
          <li>
            <strong>LinkedIn</strong> — Şirket sayfası +{' '}
            <a href="https://www.linkedin.com/developers/apps" target="_blank" rel="noreferrer">
              Developer app
            </a>
          </li>
          <li>
            <strong>X</strong> —{' '}
            <a href="https://developer.x.com/en/portal/dashboard" target="_blank" rel="noreferrer">
              Developer Portal
            </a>{' '}
            OAuth 2.0
          </li>
          <li>YouTube / TikTok — Faz 2 (video)</li>
          <li>Facebook / Instagram — Faz 3 (Meta Business)</li>
        </ol>
      </section>

      <section className="panel" style={{ marginTop: '1rem' }}>
        <h2>OAuth callback (local)</h2>
        <pre className="pre">
          {`LINKEDIN_CALLBACK_URL=http://localhost:3100/api/social/callback/linkedin
X_CALLBACK_URL=http://localhost:3100/api/social/callback/twitter`}
        </pre>
        <p className="muted">
          Client ID/Secret → <code>.env</code> · Sonra{' '}
          <Link href="/admin/social">/admin/social</Link>
        </p>
      </section>

      <section className="panel" style={{ marginTop: '1rem' }}>
        <h2>Hesap yokken test</h2>
        <p className="muted">
          <Link href="/admin/social">/admin/social</Link> → Dry-run X / LinkedIn → onaylanmış caption →
          mock publish (gerçek SM’de görünmez).
        </p>
      </section>

      <p className="muted" style={{ marginTop: '1rem' }}>
        Tam rehber: repo <code>docs/SOCIAL_ACCOUNTS_SETUP.md</code>
      </p>
    </div>
  )
}
