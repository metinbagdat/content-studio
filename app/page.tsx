import Link from 'next/link'

export default function HomePage() {
  return (
    <div>
      <h1>Content Studio</h1>
      <p className="lead">
        egitim.today için içerik üretim → onay → sosyal dağıtım. LearnCon ürün kodundan ayrı
        çalışır.
      </p>
      <div className="panel">
        <p className="muted">Faz 1: makale → AI metin türevleri → onay → X / LinkedIn (dry-run veya OAuth).</p>
        <div className="row" style={{ marginTop: '1rem' }}>
          <Link className="btn" href="/admin">
            Pipeline aç
          </Link>
          <a className="btn secondary" href="/api/health">
            Health
          </a>
        </div>
      </div>
    </div>
  )
}
