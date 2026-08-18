import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Gizlilik Politikası · egitim.today Content Studio',
  description: 'egitim.today Content Studio gizlilik politikası',
}

export default function PrivacyPage() {
  return (
    <article className="panel" style={{ maxWidth: 720, margin: '0 auto' }}>
      <h1>Gizlilik Politikası</h1>
      <p className="muted">Son güncelleme: 9 Ağustos 2026 · egitim.today / LEARNCONNECT.NET</p>

      <h2>1. Veri sorumlusu</h2>
      <p>
        egitim.today Content Studio (<strong>studio.egitim.today</strong>) eğitim içerik yönetimi
        hizmeti sunar. Bu politika hangi verilerin toplandığını ve nasıl kullanıldığını açıklar.
      </p>

      <h2>2. Toplanan veriler</h2>
      <ul>
        <li>OAuth erişim ve yenileme token&apos;ları (şifreli saklanır)</li>
        <li>Bağlı sosyal medya hesap adı ve platform kimliği</li>
        <li>Onaylanan içerik metinleri, medya dosyaları ve yayın kayıtları</li>
        <li>Yayın istatistikleri (platform API&apos;lerinden)</li>
      </ul>

      <h2>3. TikTok</h2>
      <p>
        TikTok OAuth ile <code>user.info.basic</code> ve video yükleme izinleri (
        <code>video.upload</code> veya onaylı uygulamalarda <code>video.publish</code>) kullanılır.
        Profil bilgisi ve yüklediğiniz videolar TikTok API üzerinden işlenir; TikTok&apos;un kendi
        gizlilik politikası geçerlidir.
      </p>

      <h2>4. Saklama ve güvenlik</h2>
      <p>
        Veriler güvenli bulut veritabanında (Supabase/PostgreSQL) saklanır. OAuth token&apos;ları
        şifrelenir. Yalnızca yetkili yöneticiler admin arayüzüne erişebilir.
      </p>

      <h2>5. Üçüncü taraflar</h2>
      <p>
        Hizmet; TikTok, Meta, LinkedIn, Google (YouTube), X API&apos;leri ve barındırma sağlayıcısı
        (Vercel) ile çalışır. Veriler yalnızca hizmetin sunulması için paylaşılır.
      </p>

      <h2 id="veri-silme">6. Haklarınız ve veri silme</h2>
      <p>
        OAuth bağlantısını Sosyal ekranından («Kes») kesebilirsiniz. Token ve yayın kayıtlarının
        silinmesi için <a href="mailto:metinbagdat@gmail.com">metinbagdat@gmail.com</a> adresine
        yazın; talep 30 gün içinde işlenir. Bu sayfa Meta «User data deletion instructions» URL&apos;si
        olarak kullanılır.
      </p>

      <h2>7. İletişim</h2>
      <p>
        <a href="https://www.egitim.today" target="_blank" rel="noopener noreferrer">
          www.egitim.today
        </a>
      </p>

      <p style={{ marginTop: '2rem' }}>
        <Link href="/">← Ana sayfa</Link>
        {' · '}
        <Link href="/legal/terms">Kullanım Koşulları</Link>
      </p>
    </article>
  )
}
