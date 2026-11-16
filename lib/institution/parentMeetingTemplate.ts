/**
 * CS-INST-04 — institutional parent-meeting pack.
 * Brand frame + logo · institution summary · one page per student.
 * Distinct from teacher LEARNCON-TCH-W2 (CS-TCH-02); adds school brand only.
 */

export const PARENT_MEETING_CATEGORY = 'institution-parent-meeting' as const
export const PARENT_MEETING_SLUG = 'cs-inst-04-veli-toplantisi' as const

/** Placeholder SVG mark (inline) — LearnCon may swap logoUrl. */
export const DEFAULT_INSTITUTION_LOGO_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" role="img" aria-label="Kurum logosu"><rect width="64" height="64" rx="12" fill="#0B3D2E"/><text x="32" y="40" text-anchor="middle" font-family="Noto Sans,Arial,sans-serif" font-size="22" font-weight="700" fill="#F4F7F5">ÖK</text></svg>'

export type BrandFrame = {
  institutionName: string
  campusLabel: string
  primaryColor: string
  accentColor: string
  /** Absolute URL or empty — HTML falls back to inline SVG mark */
  logoUrl: string
  footerNote: string
}

export type MeetingStudentPage = {
  studentNo: number
  displayName: string
  classLabel: string
  net: number
  band: string
  weakTopicLabel: string
  talkTrack: string
  homePractice: string[]
}

export type InstitutionParentMeetingPack = {
  version: 1
  kind: 'institution-parent-meeting'
  slug: string
  segment: 'egitimci'
  brand: BrandFrame
  /** Explicit non-collision with teacher W2 pack */
  distinctFromTeacherContract: 'LEARNCON-TCH-W2'
  meetingMeta: {
    title: string
    date: string
    exam: 'TYT'
    subject: 'Matematik'
    studentCount: number
  }
  institutionSummary: {
    headline: string
    bullets: string[]
    avgNet: number
    below8Pct: number
    priorityTopics: string[]
  }
  studentPages: MeetingStudentPage[]
}

const SAMPLE_STUDENTS: Array<Omit<MeetingStudentPage, 'talkTrack' | 'homePractice' | 'band'>> = [
  { studentNo: 1, displayName: 'Ada A.', classLabel: '11-A', net: 7.25, weakTopicLabel: 'Üslü ve Köklü' },
  { studentNo: 2, displayName: 'Berk B.', classLabel: '11-A', net: 9.5, weakTopicLabel: 'Denklemler' },
  { studentNo: 3, displayName: 'Cemre C.', classLabel: '11-B', net: 11.0, weakTopicLabel: 'Fonksiyonlar' },
  { studentNo: 4, displayName: 'Deniz D.', classLabel: '11-B', net: 6.5, weakTopicLabel: 'Rasyonel' },
  { studentNo: 5, displayName: 'Efe E.', classLabel: '11-C', net: 12.75, weakTopicLabel: 'Üçgenler' },
  { studentNo: 6, displayName: 'Fatma F.', classLabel: '11-C', net: 8.25, weakTopicLabel: 'Üslü ve Köklü' },
  { studentNo: 7, displayName: 'Gökhan G.', classLabel: '11-A', net: 10.0, weakTopicLabel: 'Denklemler' },
  { studentNo: 8, displayName: 'Hande H.', classLabel: '11-B', net: 5.75, weakTopicLabel: 'Fonksiyonlar' },
]

function netBand(net: number): string {
  if (net < 8) return 'destek (<8)'
  if (net < 11) return 'gelişim (8–10.9)'
  if (net < 14) return 'hedef (11–13.9)'
  return 'güçlü (14+)'
}

export function buildParentMeetingPack(): InstitutionParentMeetingPack {
  const studentPages: MeetingStudentPage[] = SAMPLE_STUDENTS.map((s) => ({
    ...s,
    band: netBand(s.net),
    talkTrack: `“${s.displayName} şu an ${s.net} net bandında; öncelik ${s.weakTopicLabel}. Suçlamadan, bu hafta iki tip soruyu birlikte çözelim.”`,
    homePractice: [
      `${s.weakTopicLabel}: 2 kısa set (15 dk)`,
      'Yanlışları işaretleyip bir sonraki derse getirmek',
    ],
  }))

  const avgNet =
    Math.round(
      (studentPages.reduce((a, s) => a + s.net, 0) / studentPages.length) * 100,
    ) / 100
  const below8Pct = Math.round(
    (studentPages.filter((s) => s.net < 8).length / studentPages.length) * 100,
  )

  return {
    version: 1,
    kind: 'institution-parent-meeting',
    slug: PARENT_MEETING_SLUG,
    segment: 'egitimci',
    brand: {
      institutionName: 'Örnek Koleji',
      campusLabel: 'Merkez Kampüs',
      primaryColor: '#0B3D2E',
      accentColor: '#C4A35A',
      logoUrl: '',
      footerNote: 'Kurum markalı veli toplantısı paketi — öğretmen W2 sınıf özetinden ayrıdır.',
    },
    distinctFromTeacherContract: 'LEARNCON-TCH-W2',
    meetingMeta: {
      title: 'Veli toplantısı — kurumsal paket',
      date: '2026-11-15',
      exam: 'TYT',
      subject: 'Matematik',
      studentCount: studentPages.length,
    },
    institutionSummary: {
      headline: `Örnek Koleji TYT Matematik veli özeti: ortalama ${avgNet} net; öğrencilerin %${below8Pct}'i destek bandında.`,
      bullets: [
        'Kurum çerçevesi: logo + kampüs + tarih (öğretmen W2’de yok)',
        'Her öğrenci için ayrı baskı sayfası',
        'Öncelik konular: üslü/köklü, denklemler, fonksiyonlar',
        'Ham Excel paylaşılmaz; bu paket veliye gösterilir',
      ],
      avgNet,
      below8Pct,
      priorityTopics: ['Üslü ve Köklü', 'Denklemler', 'Fonksiyonlar'],
    },
    studentPages,
  }
}

export function validateParentMeetingPack(raw: unknown): InstitutionParentMeetingPack {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('pack nesne olmalı')
  }
  const row = raw as InstitutionParentMeetingPack
  if (row.kind !== 'institution-parent-meeting') throw new Error('kind geçersiz')
  if (row.distinctFromTeacherContract !== 'LEARNCON-TCH-W2') {
    throw new Error('öğretmen W2 ayrımı gerekli')
  }
  if (!row.brand?.institutionName || !row.brand.primaryColor) {
    throw new Error('kurum markası (logo çerçevesi) gerekli')
  }
  if (!row.institutionSummary?.headline) throw new Error('kurum özeti gerekli')
  if (!row.studentPages?.length) throw new Error('öğrenci sayfaları gerekli')
  if (row.meetingMeta.studentCount !== row.studentPages.length) {
    throw new Error('öğrenci sayısı sayfa sayısıyla uyuşmalı')
  }
  for (const s of row.studentPages) {
    if (!s.displayName || !s.talkTrack || !s.homePractice?.length) {
      throw new Error(`öğrenci sayfası eksik: ${s.studentNo}`)
    }
  }
  return row
}

export function buildParentMeetingSource(pack: InstitutionParentMeetingPack = buildParentMeetingPack()) {
  const validated = validateParentMeetingPack(pack)
  return {
    title: `${validated.brand.institutionName} — veli toplantısı`,
    category: PARENT_MEETING_CATEGORY,
    tags: [
      `slug:${validated.slug}`,
      'cs-inst-04',
      'institution-parent-meeting',
      'segment:egitimci',
    ],
    content: JSON.stringify(validated, null, 2),
  }
}

export function readParentMeetingPack(content: string): InstitutionParentMeetingPack {
  return validateParentMeetingPack(JSON.parse(content))
}

export function toLearnConParentMeetingExport(
  pack: InstitutionParentMeetingPack = buildParentMeetingPack(),
) {
  return {
    contract: 'LEARNCON-INST-04' as const,
    pack: validateParentMeetingPack(pack),
  }
}

function brandHeader(pack: InstitutionParentMeetingPack): string {
  const logo =
    pack.brand.logoUrl.trim().length > 0
      ? `<img class="logo" src="${escapeHtml(pack.brand.logoUrl)}" alt="${escapeHtml(pack.brand.institutionName)} logosu"/>`
      : `<div class="logo-fallback">${DEFAULT_INSTITUTION_LOGO_SVG}</div>`
  return `<header class="brand" style="border-color:${escapeHtml(pack.brand.accentColor)}">
  ${logo}
  <div>
    <div class="inst" style="color:${escapeHtml(pack.brand.primaryColor)}">${escapeHtml(pack.brand.institutionName)}</div>
    <div class="meta">${escapeHtml(pack.brand.campusLabel)} · ${escapeHtml(pack.meetingMeta.date)}</div>
  </div>
</header>`
}

export function renderParentMeetingHtml(pack: InstitutionParentMeetingPack): string {
  const summaryBullets = pack.institutionSummary.bullets
    .map((b) => `<li>${escapeHtml(b)}</li>`)
    .join('')
  const studentSections = pack.studentPages
    .map(
      (s) => `<section class="page student">
  ${brandHeader(pack)}
  <h1>Öğrenci sayfası — ${escapeHtml(s.displayName)}</h1>
  <p class="meta">${escapeHtml(s.classLabel)} · ${pack.meetingMeta.exam} ${escapeHtml(pack.meetingMeta.subject)} · No ${s.studentNo}</p>
  <div class="hero" style="border-color:${escapeHtml(pack.brand.primaryColor)}">
    <p><strong>Net:</strong> ${s.net} · <strong>Band:</strong> ${escapeHtml(s.band)}</p>
    <p><strong>Öncelik konu:</strong> ${escapeHtml(s.weakTopicLabel)}</p>
  </div>
  <h2>Görüşme cümlesi</h2>
  <p><em>${escapeHtml(s.talkTrack)}</em></p>
  <h2>Ev çalışması</h2>
  <ul>${s.homePractice.map((x) => `<li>${escapeHtml(x)}</li>`).join('')}</ul>
  <footer>${escapeHtml(pack.brand.footerNote)}</footer>
</section>`,
    )
    .join('\n')

  return `<!DOCTYPE html>
<html lang="tr"><head><meta charset="utf-8"/>
<title>${escapeHtml(pack.meetingMeta.title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;600;700&display=swap" rel="stylesheet"/>
<style>
body{font-family:"Noto Sans",Arial,sans-serif;margin:0;padding:0;color:#111;line-height:1.45}
.page{max-width:820px;margin:0 auto;padding:24px;page-break-after:always}
.page:last-child{page-break-after:auto}
.brand{display:flex;gap:14px;align-items:center;border-bottom:3px solid;padding-bottom:12px;margin-bottom:16px}
.logo,.logo-fallback svg{width:56px;height:56px;display:block}
.inst{font-size:20px;font-weight:700}
.meta{color:#555;font-size:13px}
.hero{border:1px solid;border-radius:8px;padding:12px;background:#fafafa;margin:12px 0}
h1{font-size:20px;margin:0 0 6px}h2{font-size:15px;margin:18px 0 6px}
footer{margin-top:24px;font-size:11px;color:#666;border-top:1px solid #ddd;padding-top:8px}
@media print{body{padding:0}.page{padding:12mm}}
</style></head><body>
<section class="page summary">
  ${brandHeader(pack)}
  <h1>${escapeHtml(pack.meetingMeta.title)}</h1>
  <p class="meta">Kurum özeti · ${pack.meetingMeta.studentCount} öğrenci sayfası · CS-INST-04 (≠ LEARNCON-TCH-W2)</p>
  <div class="hero" style="border-color:${escapeHtml(pack.brand.primaryColor)}">
    <strong>${escapeHtml(pack.institutionSummary.headline)}</strong>
    <p>Ort. net ${pack.institutionSummary.avgNet} · Destek bandı %${pack.institutionSummary.below8Pct}</p>
  </div>
  <h2>Kurum mesajları</h2>
  <ul>${summaryBullets}</ul>
  <h2>Öncelik konular</h2>
  <p>${escapeHtml(pack.institutionSummary.priorityTopics.join(' · '))}</p>
  <footer>${escapeHtml(pack.brand.footerNote)}</footer>
</section>
${studentSections}
</body></html>`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
