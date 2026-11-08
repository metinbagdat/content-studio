import type { ExamVariant, RosterColumn, RosterTemplatePack } from './rosterTemplate'

/**
 * CS-TCH-01 — 16-section printable guide (≈15–20 pages with print CSS).
 * Noto Sans for Turkish glyphs.
 */
const SECTIONS: Array<{ title: string; paragraphs: string[] }> = [
  {
    title: '1. Kapak — Sınıf net şablonu rehberi',
    paragraphs: [
      'Bu rehber, egitim.today öğretmen hunisi (W3/W8) için sınıf listesini Excel’e (CSV) nasıl aktaracağınızı anlatır.',
      'Ton: meslektaş dili, ücretsiz araç. Amaç: kazanım analizi öncesi temiz veri.',
    ],
  },
  {
    title: '2. Amaç',
    paragraphs: [
      'Şablon; öğrenci kimliği, sınav türü, konu/kazanım kodu ve net/puanı tek satırda toplar.',
      'Çıktı LearnCon sınıf analizine ve veli toplantısı özetine taşınabilir.',
    ],
  },
  {
    title: '3. Kimler için?',
    paragraphs: [
      'Branş öğretmenleri, rehber öğretmenler, zümre başkanları.',
      'Öğrenci veya veli bu şablonu doldurmaz; öğretmen doldurur.',
    ],
  },
  {
    title: '4. Ortak sütunlar',
    paragraphs: [
      'Öğrenci No, Ad Soyad, Sınıf her varyantta zorunludur.',
      'Ad Soyad’da yalnızca baş harf + soyad da kabul edilir (ör. Ayşe K.).',
    ],
  },
  {
    title: '5. TYT varyantı',
    paragraphs: [
      'Sınav=TYT. Ders genelde Matematik / Türkçe / Fen / Sosyal.',
      'Konu Kodu LearnCon topics.code ile hizalıdır (ör. tyt_mat_uslu_koklu). Net alanı ondalıklı olabilir.',
    ],
  },
  {
    title: '6. AYT varyantı',
    paragraphs: [
      'Sınav=AYT. Kazanım Kodu curriculum_tree learning_outcome_code olabilir (ör. 12.1.2.1.).',
      'Üstel → logaritma gibi önkoşul okuması için kod alanı kritiktir.',
    ],
  },
  {
    title: '7. LGS varyantı',
    paragraphs: [
      'Sınav=LGS. Net yerine Puan kullanılır.',
      'Kazanım örneği: İTA.8.1.1. (İnkılap). Türkçe karakterler CSV BOM ile korunur.',
    ],
  },
  {
    title: '8. Veri girişi adımları',
    paragraphs: [
      '1) Boş CSV’yi indirin. 2) Excel’de açın (UTF-8). 3) Satır ekleyin. 4) Örnek CSV ile biçimi karşılaştırın.',
      '5) Kaydedip LearnCon’a yükleyin veya Content Studio öğretmen admininden export alın.',
    ],
  },
  {
    title: '9. Örnek satır nasıl okunur?',
    paragraphs: [
      'Deniz A. · TYT Matematik · tyt_mat_uslu_koklu · 7,75 net · %44 doğruluk: sınıf ortasının altında; önkoşul tekrarı önerilir.',
      'Cemre Y. · 14 net · %81: akran desteği / zenginleştirme adayı.',
    ],
  },
  {
    title: '10. Kazanım eşlemesi',
    paragraphs: [
      'Konu kodunu boş bırakabilirsiniz; analiz kalitesi düşer.',
      'Content Studio önkoşul grafiği (CS-STU-02) ile aynı kod dilini kullanın.',
    ],
  },
  {
    title: '11. Sık hatalar',
    paragraphs: [
      'Sınav sütununu karıştırmak (TYT satırına AYT yazmak).',
      'Virgül ondalığı + CSV ayırıcı çakışması: Excel’de sütunları metin olarak yapıştırın veya nokta kullanın (12.25).',
      'BOM’suz kayıt → Türkçe bozulması: şablonu Studio’dan yeniden indirin.',
    ],
  },
  {
    title: '12. Gizlilik ve KVKK',
    paragraphs: [
      'Dosyayı genel sohbet kanallarına atmayın. Okul içi güvenli depolama kullanın.',
      'Veliye aktarımda yalnızca özet / anonimleştirilmiş grafik paylaşın.',
    ],
  },
  {
    title: '13. Sınıf analizi çıktısı (W9 öncesi)',
    paragraphs: [
      'Temiz şablon, kazanım dağılımı ve zayıf konu ısı haritası üretir.',
      'CS-TCH-02 örnek sınıf raporu aynı sütun dilini kullanır.',
    ],
  },
  {
    title: '14. Veli toplantısına taşıma',
    paragraphs: [
      'Toplantı sayfasında öğrenci satırı + konuşma önerisi yeterlidir; ham Excel’i velinin önüne koymayın.',
      '“Net düşük” yerine “şu kodda %X — şu önkoşul” deyin.',
    ],
  },
  {
    title: '15. LearnCon aktarımı',
    paragraphs: [
      'Export sözleşmesi: LEARNCON-TCH-W3. Segment etiketi: egitimci.',
      'API: /api/teacher-roster?format=learncon veya CSV indirme.',
    ],
  },
  {
    title: '16. SSS ve CTA',
    paragraphs: [
      'S: Google Sheets? C: CSV olarak dışa aktarın, sütun başlıklarını değiştirmeyin.',
      'S: 30 öğrenci? C: Satır eklemeniz yeterli; örnek 5 satırlıdır.',
      'CTA: egitim.today öğretmen paneli — sınıf analizi denemesi ücretsizdir.',
    ],
  },
]

function columnsTable(exam: ExamVariant, columns: RosterColumn[]): string {
  const rows = columns
    .map(
      (c) =>
        `<tr><td>${escapeHtml(c.header)}</td><td>${c.required ? 'Evet' : 'Hayır'}</td><td>${escapeHtml(c.note || c.key)}</td></tr>`,
    )
    .join('')
  return `<h3>${exam} sütunları</h3>
<table><thead><tr><th>Başlık</th><th>Zorunlu</th><th>Not</th></tr></thead><tbody>${rows}</tbody></table>`
}

export function renderRosterGuideHtml(pack: RosterTemplatePack): string {
  const sectionHtml = SECTIONS.map(
    (s) => `<section class="page">
  <h2>${escapeHtml(s.title)}</h2>
  ${s.paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join('')}
</section>`,
  ).join('\n')

  const colPages = (['TYT', 'AYT', 'LGS'] as ExamVariant[])
    .map(
      (exam) => `<section class="page">
  <h2>Ek — ${exam} sütun tablosu</h2>
  ${columnsTable(exam, pack.columnsByExam[exam])}
</section>`,
    )
    .join('\n')

  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <title>Öğretmen sınıf şablonu rehberi</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;600;700&display=swap" rel="stylesheet" />
  <style>
    body { font-family: "Noto Sans", "DejaVu Sans", Arial, sans-serif; margin: 0; color: #111; line-height: 1.5; }
    .page { padding: 18mm 16mm; min-height: 240mm; box-sizing: border-box; page-break-after: always; }
    .page:last-child { page-break-after: auto; }
    h1 { font-size: 22px; margin: 0 0 12px; }
    h2 { font-size: 16px; margin: 0 0 10px; }
    h3 { font-size: 14px; }
    p { font-size: 13px; margin: 0 0 10px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border-bottom: 1px solid #ddd; text-align: left; padding: 6px 4px; }
    .meta { color: #555; font-size: 12px; }
    @media print { .page { padding: 12mm; } }
  </style>
</head>
<body>
  <section class="page">
    <h1>Sınıf net şablonu — öğretmen rehberi</h1>
    <p class="meta">CS-TCH-01 · Segment egitimci · Türkçe font: Noto Sans · ${SECTIONS.length + 3} baskı bölümü</p>
    <p>Boş ve örnek CSV’ler TYT / AYT / LGS için ayrıdır. Bu PDF şablonu yazdırılabilir HTML’dir.</p>
  </section>
  ${sectionHtml}
  ${colPages}
</body>
</html>`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
