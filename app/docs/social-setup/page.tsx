import Link from 'next/link'
import { EnvStatusCheck } from '@/components/EnvStatusCheck'

export default function SocialSetupDocPage() {
  return (
    <div>
      <h1>Sosyal medya hesapları</h1>
      <p className="lead">egitim.today — gerçek OAuth kurulumu (X + LinkedIn).</p>

      <section className="panel">
        <h2>1. .env doldur (örnek şablon)</h2>
        <p className="muted" style={{ marginTop: 0, fontSize: '0.85rem' }}>
          Aşağıdaki blok <strong>sabit metin</strong> — sizin gerçek <code>.env</code> dosyanızı okumuyor.
          Gerçek durumu görmek için bu sayfanın altındaki &quot;Gerçek .env durumu&quot; bölümüne bakın.
        </p>
        <pre className="pre">
          {`X_CLIENT_ID="..."
X_CLIENT_SECRET="..."
X_CALLBACK_URL=http://localhost:3100/api/social/callback/twitter

LINKEDIN_CLIENT_ID="..."
LINKEDIN_CLIENT_SECRET="..."
LINKEDIN_CALLBACK_URL=http://localhost:3100/api/social/callback/linkedin
LINKEDIN_ORGANIZATION_ID=""   # şirket sayfası Page ID (opsiyonel)`}
        </pre>
        <p className="muted">Kaynak: <code>.env.example</code> · Sonra <code>npm run dev</code> restart</p>
      </section>

      <EnvStatusCheck />

      <section className="panel" style={{ marginTop: '1rem' }}>
        <h2>2. Developer portalları</h2>
        <ol className="muted" style={{ lineHeight: 1.8 }}>
          <li>
            <strong>LinkedIn</strong> —{' '}
            <a href="https://www.linkedin.com/developers/apps" target="_blank" rel="noreferrer">
              Create app
            </a>
            {' '}· Products: Share on LinkedIn · Redirect = callback URL
          </li>
          <li>
            <strong>X</strong> —{' '}
            <a href="https://developer.x.com/en/portal/dashboard" target="_blank" rel="noreferrer">
              Developer Portal
            </a>
            {' '}· OAuth 2.0 · scopes: tweet.read/write, users.read, offline.access
          </li>
        </ol>
      </section>

      <section className="panel" style={{ marginTop: '1rem' }}>
        <h2>3. Admin&apos;de bağla</h2>
        <p className="muted">
          <Link href="/admin/social">/admin/social</Link> → <strong>OAuth ile X bağla</strong> /{' '}
          <strong>OAuth ile LinkedIn bağla</strong> → onaylı caption → şimdi yayınla.
        </p>
        <p className="muted">Env yoksa: Dry-run butonları mock publish yapar.</p>
      </section>

      <p className="muted" style={{ marginTop: '1rem' }}>
        Tam rehber: repo <code>docs/SOCIAL_ACCOUNTS_SETUP.md</code>
      </p>
    </div>
  )
}
