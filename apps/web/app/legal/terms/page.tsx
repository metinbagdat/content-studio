import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Kullanım Koşulları · egitim.today Content Studio',
  description: 'egitim.today Content Studio kullanım koşulları',
}

export default function TermsPage() {
  return (
    <article className="panel" style={{ maxWidth: 720, margin: '0 auto' }}>
      <h1>Kullanım Koşulları</h1>
      <p className="muted">Son güncelleme: 9 Ağustos 2026 · egitim.today / LEARNCONNECT.NET</p>

      <h2>1. Hizmet</h2>
      <p>
        Content Studio (<strong>studio.egitim.today</strong>), egitim.today markası altında eğitim
        içeriklerinin üretilmesi, onaylanması ve bağlı sosyal medya hesaplarına (TikTok dahil)
        yayınlanması için sunulan bir yönetim aracıdır.
      </p>

      <h2>2. Hesap ve OAuth</h2>
      <p>
        Sosyal medya hesaplarınızı OAuth ile bağladığınızda, yalnızca sizin onayladığınız
        içeriklerin yayınlanması hedeflenir. Bağlantıyı istediğiniz zaman Sosyal ekranından
        kesebilirsiniz.
      </p>

      <h2>3. TikTok entegrasyonu</h2>
      <p>
        TikTok bağlantısı ile kısa eğitim videoları hesabınıza yüklenebilir. Uygulama onay
        sürecinde videolar TikTok gelen kutusuna düşebilir; son onay TikTok uygulamasında
        kullanıcıya aittir.
      </p>

      <h2>4. İçerik sorumluluğu</h2>
      <p>
        Yayınlanan tüm içeriklerin doğruluğu, telif uyumu ve platform kurallarına uygunluğu
        içerik sahibinin sorumluluğundadır.
      </p>

      <h2>5. Hizmet durumu</h2>
      <p>
        Hizmet &quot;olduğu gibi&quot; sunulur. Kesinti, veri kaybı veya üçüncü taraf API
        değişikliklerinden doğan zararlardan sorumluluk kabul edilmez.
      </p>

      <h2>6. İletişim</h2>
      <p>
        Sorularınız için:{' '}
        <a href="https://www.egitim.today" target="_blank" rel="noopener noreferrer">
          www.egitim.today
        </a>
      </p>

      <p style={{ marginTop: '2rem' }}>
        <Link href="/">← Ana sayfa</Link>
        {' · '}
        <Link href="/legal/privacy">Gizlilik Politikası</Link>
      </p>
    </article>
  )
}
