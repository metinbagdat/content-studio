/**
 * CS-INST-01 — kurumsal pilot rehberi (≈20–25 baskı bölümü, Noto Sans).
 */

export const PILOT_GUIDE_CATEGORY = 'institution-pilot-guide' as const
export const PILOT_GUIDE_SLUG = 'k3-pilot-rehberi' as const

export type PilotGuidePack = {
  version: 1
  kind: 'institution-pilot-guide'
  slug: string
  segment: 'egitimci'
  title: string
  weeklyPlan: Array<{ week: number; focus: string; deliverables: string[] }>
  dataRequirements: string[]
  successMetrics: Array<{ metric: string; howMeasured: string; target: string }>
  sampleReportSummary: string
  sections: Array<{ title: string; paragraphs: string[] }>
}

export const PILOT_GUIDE_PACK: PilotGuidePack = {
  version: 1,
  kind: 'institution-pilot-guide',
  slug: PILOT_GUIDE_SLUG,
  segment: 'egitimci',
  title: 'Kurumsal 30 günlük pilot rehberi',
  weeklyPlan: [
    {
      week: 1,
      focus: 'Kurulum ve veri',
      deliverables: [
        'İletişim kişisi + KVKK onayı',
        'TYT Matematik örnek sınıf CSV yükleme',
        'Öğretmen hesabı ve roller',
      ],
    },
    {
      week: 2,
      focus: 'İlk analiz turu',
      deliverables: [
        'Sınıf ısı haritası',
        'Önkoşul boşlukları (ör. logaritma → üstel)',
        'Veli toplantısı örnek sayfası denemesi',
      ],
    },
    {
      week: 3,
      focus: 'Öğretmen rutini',
      deliverables: [
        'Haftalık zümre 20 dk özet',
        '2 zayıf konuda müdahale planı',
        'Pilot dashboard kontrolü',
      ],
    },
    {
      week: 4,
      focus: 'Kanıt ve karar',
      deliverables: [
        'Örnek kurum raporu (anonim)',
        'Başarı metrikleri tablosu',
        'Sözleşme / genişleme toplantısı ajandası',
      ],
    },
  ],
  dataRequirements: [
    'Anonim öğrenci no veya takma ad (PII yok)',
    'Sınıf / şube, sınav türü (TYT/AYT/LGS)',
    'Ders + konu/kazanım kodu',
    'Net veya puan + oturum tarihi',
    'İsteğe bağlı: doğruluk %',
  ],
  successMetrics: [
    {
      metric: 'Veri tamamlığı',
      howMeasured: 'Yüklenen satır / beklenen öğrenci',
      target: '≥ %90',
    },
    {
      metric: 'Öğretmen kullanım',
      howMeasured: 'Haftalık dashboard oturumu',
      target: '≥ 1 / öğretmen / hafta',
    },
    {
      metric: 'Zayıf konu net delta',
      howMeasured: 'Pilot öncesi vs 4. hafta örnek net',
      target: 'Sınıf ort. ≥ +1 net veya konu % ≥ +10 puan',
    },
    {
      metric: 'Kurum kararı',
      howMeasured: 'Değerlendirme toplantısı sonucu',
      target: 'Go / no-go belgelenmiş',
    },
  ],
  sampleReportSummary:
    'Anonim 400 öğrencilik örnekte TYT Matematik Logaritma bandı %32 hazırbulunuşluk; üstel önkoşulu güçlendirilen şubelerde 2 haftada +1,2 net sınıf ortalaması görülür (CS-INST-02 rakamlarıyla uyumlu).',
  sections: [
    {
      title: '1. Kapak',
      paragraphs: [
        'Bu rehber kurumsal 30 günlük ücretsiz/pilot dönemi için operasyon kılavuzudur.',
        'Amaç: pilot ile kanıt, sonra sözleşme. Ürün UI LearnCon `/kurumlar` tarafındadır.',
      ],
    },
    {
      title: '2. Pilotin kapsamı',
      paragraphs: [
        'Tek kampüs veya 2–4 şube. Branş: önce TYT Matematik.',
        'Öğrenci ürün hunisi ayrıdır; burada kurum kanıtı üretilir.',
      ],
    },
    {
      title: '3. Roller',
      paragraphs: [
        'Kurum koordinatörü, branş öğretmeni, (isteğe bağlı) rehber öğretmen.',
        'Veli iletişimi kurum politikasına göre; ham Excel paylaşılmaz.',
      ],
    },
    {
      title: '4. Hafta 1 planı',
      paragraphs: [
        'Veri şablonu (CS-TCH-01 CSV) yüklenir. Eksik sütunlar tamamlanır.',
        'KVKK checklist imzalanır.',
      ],
    },
    {
      title: '5. Hafta 2 planı',
      paragraphs: [
        'İlk sınıf analizi ve önkoşul haritası çıkarılır.',
        'Logaritma düşükse üstel/üslü bandı müdahale listesine alınır.',
      ],
    },
    {
      title: '6. Hafta 3 planı',
      paragraphs: [
        'Öğretmen 20 dk zümre rutini: ısı haritası + 2 konu.',
        'Dashboard’da pilot sağlık göstergeleri kontrol edilir.',
      ],
    },
    {
      title: '7. Hafta 4 planı',
      paragraphs: [
        'Örnek kurum raporu PDF’i yönetimle paylaşılır.',
        'Go/no-go için başarı metrikleri tablosu doldurulur.',
      ],
    },
    {
      title: '8. Veri gereksinimleri',
      paragraphs: [
        'Anonim kimlik, sınıf, sınav, ders, kod, net/puan, tarih zorunlu çekirdektir.',
        'PII (TC, telefon, e-posta) pilot dosyasına yazılmaz.',
      ],
    },
    {
      title: '9. Veri kalitesi kontrolleri',
      paragraphs: [
        'Sınav sütunu karışmasın (TYT/AYT/LGS).',
        'Türkçe karakter için CSV BOM kullanın.',
      ],
    },
    {
      title: '10. Başarı kriterleri nasıl ölçülür?',
      paragraphs: [
        'Her metrik için kaynak (dashboard / CSV / toplantı notu) netleştirilir.',
        'Hedefler bu rehberdeki tabloda sabittir; kurum içi ek KPI eklenebilir.',
      ],
    },
    {
      title: '11. Örnek kurum raporu özeti',
      paragraphs: [
        'Anonim 400 öğrenci, TYT Matematik. Logaritma hazırbulunuşluk %32 bandı vurgulanır.',
        'Detay rakamlar CS-INST-02 paketindedir; bu bölüm yönetici özetidir.',
      ],
    },
    {
      title: '12. Öğretmen deneyimi',
      paragraphs: [
        'Meslektaş dili; ücretli satış baskısı yok.',
        'W9 kazanım analizi pilotun pedagojik kalbidir.',
      ],
    },
    {
      title: '13. Veli boyutu',
      paragraphs: [
        'İsteğe bağlı: örnek veli raporu (CS-PAR-01) dilini kurum toplantısında göstermek.',
        'Velinin test çözmesi beklenmez.',
      ],
    },
    {
      title: '14. Riskler',
      paragraphs: [
        'Eksik veri → sahte “başarısız pilot”.',
        'Tek öğretmen kahramanlığı → ölçeklenmez; zümre rutini şart.',
      ],
    },
    {
      title: '15. Güvenlik',
      paragraphs: [
        'Erişim rollerle sınırlı. Export’lar kurum hesabında kalır.',
        '3. cron yok; raporlar mevcut wave’e bağlanır (LearnCon).',
      ],
    },
    {
      title: '16. Destek kanalı',
      paragraphs: [
        'Teknik: Content Studio seed hub + LearnCon kurum paneli.',
        'İçerik: bu PDF + Excel şablonu + örnek rapor.',
      ],
    },
    {
      title: '17. Sözleşme öncesi checklist',
      paragraphs: [
        '4 haftalık plan tamamlandı mı?',
        'Başarı metrikleri doldu mu?',
        'Örnek kurum raporu paylaşıldı mı?',
      ],
    },
    {
      title: '18. Genişleme senaryosu',
      paragraphs: [
        'Pilot OK ise şube / ders genişletmesi.',
        'AYT ve LGS CSV varyantları hazırdır.',
      ],
    },
    {
      title: '19. SSS',
      paragraphs: [
        'S: Öğrenci lisansı? C: Pilot kapsamı sözleşmede yazılır; bu rehber operasyondur.',
        'S: Canlı dashboard? C: K8 LearnCon’da; Studio içerik üretir.',
      ],
    },
    {
      title: '20. Kapanış',
      paragraphs: [
        'Pilot = kanıt paketi. Sonraki adım değerlendirme toplantısı.',
        'CTA: egitim.today/kurumlar',
      ],
    },
    {
      title: '21. Ek — haftalık özet tablosu',
      paragraphs: [
        'Hafta 1 kurulum · Hafta 2 analiz · Hafta 3 rutin · Hafta 4 karar.',
        'Her haftanın teslimatı bu rehberin weeklyPlan alanındadır.',
      ],
    },
    {
      title: '22. Ek — metrik sözlüğü kısa',
      paragraphs: [
        'Net delta, konu doğruluk %, veri tamamlığı, oturum sıklığı.',
        'Growth OS metrik sözlüğü (CS-OS-01) ile hizalanır.',
      ],
    },
  ],
}

export function validatePilotGuidePack(raw: unknown): PilotGuidePack {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('pack nesne olmalı')
  }
  const row = raw as PilotGuidePack
  if (row.kind !== 'institution-pilot-guide') throw new Error('kind geçersiz')
  if (!row.weeklyPlan || row.weeklyPlan.length !== 4) throw new Error('4 haftalık plan gerekli')
  if (!row.dataRequirements?.length) throw new Error('veri gereksinimleri gerekli')
  if (!row.successMetrics?.length) throw new Error('başarı metrikleri gerekli')
  if (!row.sampleReportSummary?.trim()) throw new Error('örnek rapor özeti gerekli')
  if (!row.sections || row.sections.length < 20) throw new Error('en az 20 baskı bölümü gerekli')
  return row
}

export function buildPilotGuideSource(pack: PilotGuidePack = PILOT_GUIDE_PACK) {
  const validated = validatePilotGuidePack(pack)
  return {
    title: validated.title,
    category: PILOT_GUIDE_CATEGORY,
    tags: [`slug:${validated.slug}`, 'cs-inst-01', 'institution-pilot-guide', 'segment:egitimci'],
    content: JSON.stringify(validated, null, 2),
  }
}

export function readPilotGuidePack(content: string): PilotGuidePack {
  return validatePilotGuidePack(JSON.parse(content))
}

export function toLearnConPilotGuideExport(pack: PilotGuidePack = PILOT_GUIDE_PACK) {
  return { contract: 'LEARNCON-INST-K3' as const, pack: validatePilotGuidePack(pack) }
}

export function renderPilotGuideHtml(pack: PilotGuidePack): string {
  const weeks = pack.weeklyPlan
    .map(
      (w) =>
        `<li><strong>Hafta ${w.week} — ${escapeHtml(w.focus)}</strong><ul>${w.deliverables
          .map((d) => `<li>${escapeHtml(d)}</li>`)
          .join('')}</ul></li>`,
    )
    .join('')
  const data = pack.dataRequirements.map((d) => `<li>${escapeHtml(d)}</li>`).join('')
  const metrics = pack.successMetrics
    .map(
      (m) =>
        `<tr><td>${escapeHtml(m.metric)}</td><td>${escapeHtml(m.howMeasured)}</td><td>${escapeHtml(m.target)}</td></tr>`,
    )
    .join('')
  const sections = pack.sections
    .map(
      (s) => `<section class="page"><h2>${escapeHtml(s.title)}</h2>${s.paragraphs
        .map((p) => `<p>${escapeHtml(p)}</p>`)
        .join('')}</section>`,
    )
    .join('\n')

  return `<!DOCTYPE html>
<html lang="tr"><head><meta charset="utf-8"/>
<title>${escapeHtml(pack.title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;600;700&display=swap" rel="stylesheet"/>
<style>
body{font-family:"Noto Sans",Arial,sans-serif;margin:0;color:#111;line-height:1.5}
.page{padding:16mm;min-height:240mm;page-break-after:always;box-sizing:border-box}
.page:last-child{page-break-after:auto}
h1{font-size:22px}h2{font-size:16px}p,li,td{font-size:13px}
table{width:100%;border-collapse:collapse}th,td{border-bottom:1px solid #ddd;text-align:left;padding:6px 4px}
@media print{.page{padding:12mm}}
</style></head><body>
<section class="page">
  <h1>${escapeHtml(pack.title)}</h1>
  <p>CS-INST-01 · ${pack.sections.length} baskı bölümü · Noto Sans</p>
  <h2>4 haftalık plan</h2><ol>${weeks}</ol>
  <h2>Veri gereksinimleri</h2><ul>${data}</ul>
  <h2>Başarı kriterleri</h2>
  <table><thead><tr><th>Metrik</th><th>Ölçüm</th><th>Hedef</th></tr></thead><tbody>${metrics}</tbody></table>
  <h2>Örnek kurum raporu özeti</h2>
  <p>${escapeHtml(pack.sampleReportSummary)}</p>
</section>
${sections}
</body></html>`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
