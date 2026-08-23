import Link from 'next/link'

export default function HomePage() {
  return (
    <div>
      <section className="hero-panel">
        <h1>Content Studio</h1>
        <p className="lead" style={{ marginBottom: '1rem' }}>
          egitim.today için makaleden X, YouTube ve diğer SM kanallarına atomize içerik üretimi —
          onaylı, güvenli dağıtım.
        </p>
        <div className="row">
          <span className="badge plat-TWITTER">X</span>
          <span className="badge plat-YOUTUBE">YouTube</span>
          <span className="badge">LinkedIn</span>
          <span className="badge">Instagram</span>
          <span className="badge">TikTok</span>
        </div>
        <div className="row" style={{ marginTop: '1.15rem' }}>
          <Link className="btn" href="/admin">
            Pipeline aç
          </Link>
          <Link className="btn secondary" href="/admin/discovery">
            Discovery
          </Link>
          <a className="btn secondary" href="/api/health">
            Health
          </a>
        </div>
      </section>

      <div className="grid two">
        <section className="panel">
          <h2>Akış</h2>
          <p className="muted">
            1) Kaynak ekle veya sitemap tara → 2) Platform seç (X + YouTube öncelikli) → 3) Onay
            kuyruğu → 4) Takvim / yayın.
          </p>
        </section>
        <section className="panel">
          <h2>Güvenlik</h2>
          <p className="muted">
            Auto-publish kapalı. Admin API key gerekir. LearnCon ürün kodundan ayrı çalışır.
          </p>
        </section>
      </div>

      <section className="panel" style={{ marginTop: '1rem' }}>
        <h2>About · egitim.today Content Studio</h2>
        <p className="muted">
          Internal publishing tool for{' '}
          <a href="https://www.egitim.today" rel="noopener noreferrer">
            egitim.today
          </a>
          . Administrators connect owned social accounts (Facebook, Instagram, LinkedIn, TikTok,
          X, YouTube) and publish pre-approved educational content. We do not access third-party
          user accounts.
        </p>
        <p className="muted" style={{ marginTop: '0.75rem' }}>
          <Link href="/legal/privacy">Privacy Policy</Link>
          {' · '}
          <Link href="/legal/terms">Terms of Service</Link>
          {' · '}
          <a href="https://www.egitim.today/privacy#sosyal-medya" rel="noopener noreferrer">
            egitim.today privacy (social integration)
          </a>
        </p>
      </section>
    </div>
  )
}
