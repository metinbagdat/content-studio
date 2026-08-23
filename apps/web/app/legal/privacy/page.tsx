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
      <p className="muted">Son güncelleme: 23 Ağustos 2026 · egitim.today / LEARNCONNECT.NET</p>

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

      <h2 id="sosyal-medya">3. Sosyal Medya Entegrasyonu (Content Studio)</h2>
      <p>
        egitim.today, blog.egitim.today üzerinde yayınlanan eğitim içeriklerini kendi resmi Instagram, Facebook ve
        TikTok hesaplarında paylaşmak amacıyla Meta Graph API ve TikTok Content Posting API&apos;lerini kullanan bir iç
        otomasyon aracı (Content Studio) işletmektedir.
      </p>
      <p>
        <strong>Erişim kapsamı.</strong> Bu entegrasyon yalnızca egitim.today&apos;in kendi sahip olduğu ve yönettiği
        işletme hesaplarına (Instagram Professional hesabı, bağlı Facebook Sayfası, TikTok işletme hesabı) erişir.
        Üçüncü taraf kullanıcıların hesaplarına erişim talep edilmez, yönetilmez veya bu hesaplar adına işlem
        yapılmaz.
      </p>
      <p>
        <strong>Erişilen veri ve kullanım amacı.</strong> Entegrasyon, ilgili platformların API&apos;leri aracılığıyla
        yalnızca aşağıdaki işlemleri gerçekleştirir:
      </p>
      <ul>
        <li>
          Önceden hazırlanmış ve insan onayından geçmiş içeriklerin (metin, görsel, video) bağlı hesaplara
          paylaşılması,
        </li>
        <li>
          Paylaşılan içeriklerin performans metriklerinin (gösterim, etkileşim, beğeni sayısı gibi toplu/agregat
          istatistikler) okunması, içerik ve yayın zamanlaması optimizasyonu amacıyla.
        </li>
      </ul>
      <p>
        Bu kapsamda son kullanıcılara ait kişisel veri (mesajlar, takipçi listeleri, kişisel profil bilgileri vb.)
        toplanmaz, işlenmez veya üçüncü taraflarla paylaşılmaz.
      </p>
      <p>
        <strong>Veri saklama ve güvenlik.</strong> Platform erişim ve yenileme token&apos;ları (access/refresh token)
        uçtan uca şifrelenmiş olarak saklanır, yalnızca yukarıda tanımlanan yayın ve istatistik okuma işlemleri için
        kullanılır. Bir hesabın bağlantısı kesildiğinde, ilgili token&apos;lar geçersiz kılınır ve yeniden
        kullanılmaz.
      </p>
      <p>
        <strong>Veri paylaşımı.</strong> Bu entegrasyon kapsamında elde edilen hiçbir veri, reklam, pazarlama
        analitiği veya başka herhangi bir amaçla üçüncü taraflara satılmaz, kiralanmaz veya paylaşılmaz.
      </p>

      <h2>4. TikTok</h2>
      <p>
        TikTok OAuth ile <code>user.info.basic</code> ve video yükleme izinleri (
        <code>video.upload</code> veya onaylı uygulamalarda <code>video.publish</code>) kullanılır.
        Profil bilgisi ve yüklediğiniz videolar TikTok API üzerinden işlenir; TikTok&apos;un kendi
        gizlilik politikası geçerlidir.
      </p>

      <h2>5. Saklama ve güvenlik</h2>
      <p>
        Veriler güvenli bulut veritabanında (Supabase/PostgreSQL) saklanır. OAuth token&apos;ları
        şifrelenir. Yalnızca yetkili yöneticiler admin arayüzüne erişebilir.
      </p>

      <h2>6. Üçüncü taraflar</h2>
      <p>
        Hizmet; TikTok, Meta, LinkedIn, Google (YouTube), X API&apos;leri ve barındırma sağlayıcısı
        (Vercel) ile çalışır. Veriler yalnızca hizmetin sunulması için paylaşılır.
      </p>

      <h2 id="veri-silme">7. Haklarınız ve veri silme</h2>
      <p>
        OAuth bağlantısını Sosyal ekranından («Kes») kesebilirsiniz. Token ve yayın kayıtlarının
        silinmesi için <a href="mailto:metinbagdat@gmail.com">metinbagdat@gmail.com</a> adresine
        yazın; talep 30 gün içinde işlenir. Bu sayfa Meta «User data deletion instructions» URL&apos;si
        olarak kullanılır.
      </p>

      <h2>8. İletişim</h2>
      <p>
        <a href="https://www.egitim.today/privacy#sosyal-medya" target="_blank" rel="noopener noreferrer">
          www.egitim.today/privacy
        </a>
        {' · '}
        <a href="https://www.egitim.today/iletisim" target="_blank" rel="noopener noreferrer">
          iletişim
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
