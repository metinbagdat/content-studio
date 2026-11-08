/**
 * CS-TCH-02 — sample class analysis (30 TYT Math students).
 * Chart JSON + PDF HTML + parent-meeting sample page.
 */

export const CLASS_REPORT_CATEGORY = 'teacher-class-report' as const
export const CLASS_REPORT_SLUG = 'ornek-sinif-tyt-mat-30' as const

export type ClassStudent = {
  studentNo: number
  displayName: string
  net: number
  correctPct: number
  weakTopicCode: string
  weakTopicLabel: string
}

export type ClassChart = {
  type: 'histogram' | 'topic-bars'
  title: string
  bins?: Array<{ label: string; count: number }>
  topics?: Array<{ label: string; avgPct: number }>
}

export type SampleClassReport = {
  version: 1
  kind: 'teacher-class-report'
  slug: string
  segment: 'egitimci'
  classMeta: {
    label: string
    grade: number
    exam: 'TYT'
    subject: 'Matematik'
    studentCount: number
    sessionDate: string
  }
  summary: {
    avgNet: number
    medianNet: number
    below8Count: number
    headline: string
  }
  students: ClassStudent[]
  charts: ClassChart[]
  parentMeetingPage: {
    title: string
    opening: string
    bullets: string[]
    sampleTalkTrack: string
  }
}

function mulberry32(seed: number) {
  return function next() {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const WEAK_TOPICS = [
  { code: 'tyt_mat_uslu_koklu', label: 'Üslü ve Köklü' },
  { code: 'tyt_mat_denklemler', label: 'Denklemler' },
  { code: 'tyt_mat_fonksiyonlar', label: 'Fonksiyonlar' },
  { code: 'tyt_mat_rasyonel', label: 'Rasyonel' },
  { code: 'tyt_mat_ucgenler', label: 'Üçgenler' },
] as const

const FIRST = [
  'Ada',
  'Ali',
  'Ayşe',
  'Berk',
  'Can',
  'Cemre',
  'Deniz',
  'Efe',
  'Elif',
  'Emre',
  'Fatma',
  'Gökhan',
  'Hande',
  'İrem',
  'Kaan',
  'Leyla',
  'Mert',
  'Naz',
  'Ozan',
  'Pınar',
  'Rüzgar',
  'Selin',
  'Tolga',
  'Umut',
  'Yağmur',
  'Zeynep',
  'Baran',
  'Ceren',
  'Doruk',
  'Eylül',
]

export function buildSampleClassReport(): SampleClassReport {
  const rnd = mulberry32(20261108)
  const students: ClassStudent[] = []
  for (let i = 0; i < 30; i++) {
    const net = Math.round((5 + rnd() * 12) * 4) / 4 // 5–17 step 0.25
    const correctPct = Math.min(95, Math.max(30, Math.round(35 + net * 3.2 + rnd() * 8)))
    const topic = WEAK_TOPICS[Math.floor(rnd() * WEAK_TOPICS.length)]
    students.push({
      studentNo: i + 1,
      displayName: `${FIRST[i]} ${String.fromCharCode(65 + (i % 26))}.`,
      net,
      correctPct,
      weakTopicCode: topic.code,
      weakTopicLabel: topic.label,
    })
  }

  const nets = students.map((s) => s.net).sort((a, b) => a - b)
  const avgNet = Math.round((nets.reduce((a, b) => a + b, 0) / nets.length) * 100) / 100
  const medianNet = nets[Math.floor(nets.length / 2)]
  const below8Count = students.filter((s) => s.net < 8).length

  const bins = [
    { label: '0–7.9', count: students.filter((s) => s.net < 8).length },
    { label: '8–10.9', count: students.filter((s) => s.net >= 8 && s.net < 11).length },
    { label: '11–13.9', count: students.filter((s) => s.net >= 11 && s.net < 14).length },
    { label: '14+', count: students.filter((s) => s.net >= 14).length },
  ]

  const topics = WEAK_TOPICS.map((t) => {
    const rows = students.filter((s) => s.weakTopicCode === t.code)
    const avgPct =
      rows.length === 0
        ? 0
        : Math.round(rows.reduce((a, s) => a + s.correctPct, 0) / rows.length)
    return { label: t.label, avgPct }
  })

  return {
    version: 1,
    kind: 'teacher-class-report',
    slug: CLASS_REPORT_SLUG,
    segment: 'egitimci',
    classMeta: {
      label: '11-A TYT Matematik',
      grade: 11,
      exam: 'TYT',
      subject: 'Matematik',
      studentCount: 30,
      sessionDate: '2026-10-20',
    },
    summary: {
      avgNet,
      medianNet,
      below8Count,
      headline: `30 öğrencide ortalama ${avgNet} net; ${below8Count} öğrenci 8 netin altında. Öncelik üslü/denklem bandı.`,
    },
    students,
    charts: [
      { type: 'histogram', title: 'Net dağılımı', bins },
      { type: 'topic-bars', title: 'Zayıf konu ortalama doğruluk %', topics },
    ],
    parentMeetingPage: {
      title: 'Veli toplantısı — örnek sınıf özeti (11-A)',
      opening:
        'Bu sayfa velilere gösterilecek kısa özettir; ham Excel paylaşılmaz. Sınıf ortalaması ve çocuğun bandı konuşulur.',
      bullets: [
        `Sınıf ortalaması ≈ ${avgNet} TYT Matematik net`,
        `${below8Count} öğrenci destek bandında (<8 net)`,
        'En sık zayıf konular: üslü/köklü, denklemler, fonksiyonlar',
        'Öneri: 2 haftalık önkoşul tekrarı + tek konuşma cümlesi',
      ],
      sampleTalkTrack:
        '“Sınıfta üslü konuda yoğunlaşma var; çocuğunuzun neti X bandında. Bu hafta evde suçlamadan, şu 2 tip soruyu birlikte çözelim.”',
    },
  }
}

export type ClassReportSourceDraft = {
  title: string
  category: typeof CLASS_REPORT_CATEGORY
  tags: string[]
  content: string
}

export function validateSampleClassReport(raw: unknown): SampleClassReport {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('rapor nesne olmalı')
  }
  const row = raw as SampleClassReport
  if (row.kind !== 'teacher-class-report') throw new Error('kind geçersiz')
  if (row.classMeta?.studentCount !== 30 || row.students?.length !== 30) {
    throw new Error('30 öğrenci gerekli (CS-TCH-02)')
  }
  if (row.classMeta.exam !== 'TYT' || row.classMeta.subject !== 'Matematik') {
    throw new Error('TYT Matematik olmalı')
  }
  if (!row.charts?.length) throw new Error('grafik JSON gerekli')
  if (!row.parentMeetingPage?.sampleTalkTrack) throw new Error('veli toplantısı sayfası gerekli')
  return row
}

export function buildClassReportSource(
  report: SampleClassReport = buildSampleClassReport(),
): ClassReportSourceDraft {
  const validated = validateSampleClassReport(report)
  return {
    title: `Örnek sınıf analizi — ${validated.classMeta.label}`,
    category: CLASS_REPORT_CATEGORY,
    tags: [
      `slug:${validated.slug}`,
      'cs-tch-02',
      'teacher-class-report',
      'segment:egitimci',
      'egitimci',
    ],
    content: JSON.stringify(validated, null, 2),
  }
}

export function readSampleClassReport(content: string): SampleClassReport {
  let raw: unknown
  try {
    raw = JSON.parse(content)
  } catch {
    throw new Error('class report JSON değil')
  }
  return validateSampleClassReport(raw)
}

export function toLearnConClassReportExport(report: SampleClassReport = buildSampleClassReport()) {
  return {
    contract: 'LEARNCON-TCH-W2' as const,
    report: validateSampleClassReport(report),
  }
}

export function renderClassReportHtml(report: SampleClassReport): string {
  const studentRows = report.students
    .map(
      (s) =>
        `<tr><td>${s.studentNo}</td><td>${escapeHtml(s.displayName)}</td><td>${s.net}</td><td>${s.correctPct}%</td><td>${escapeHtml(s.weakTopicLabel)}</td></tr>`,
    )
    .join('')
  const bins = report.charts
    .find((c) => c.type === 'histogram')
    ?.bins?.map((b) => `<li>${escapeHtml(b.label)}: ${b.count}</li>`)
    .join('')
  const meetingBullets = report.parentMeetingPage.bullets
    .map((b) => `<li>${escapeHtml(b)}</li>`)
    .join('')

  return `<!DOCTYPE html>
<html lang="tr"><head><meta charset="utf-8"/>
<title>${escapeHtml(report.classMeta.label)} — sınıf analizi</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;600;700&display=swap" rel="stylesheet"/>
<style>
body{font-family:"Noto Sans",Arial,sans-serif;margin:0;padding:24px;color:#111;line-height:1.45;max-width:900px}
h1{font-size:22px;margin:0 0 8px}h2{font-size:15px;margin:22px 0 8px}
table{width:100%;border-collapse:collapse;font-size:12px}th,td{border-bottom:1px solid #e5e5e5;padding:6px 4px;text-align:left}
.page{page-break-after:always;padding-bottom:24px}.page:last-child{page-break-after:auto}
.hero{padding:12px;border:1px solid #ddd;border-radius:8px;background:#fafafa}
@media print{body{padding:12mm}}
</style></head><body>
<section class="page">
  <h1>Örnek sınıf analizi — ${escapeHtml(report.classMeta.label)}</h1>
  <p>${report.classMeta.exam} ${escapeHtml(report.classMeta.subject)} · ${report.classMeta.studentCount} öğrenci · ${escapeHtml(report.classMeta.sessionDate)}</p>
  <div class="hero"><strong>${escapeHtml(report.summary.headline)}</strong>
  <p>Ort. net ${report.summary.avgNet} · Medyan ${report.summary.medianNet} · &lt;8 net: ${report.summary.below8Count}</p></div>
  <h2>Net dağılımı (grafik JSON)</h2>
  <ul>${bins || ''}</ul>
  <!-- chart JSON: ${escapeHtml(JSON.stringify(report.charts))} -->
</section>
<section class="page">
  <h2>Öğrenci listesi</h2>
  <table><thead><tr><th>No</th><th>Ad</th><th>Net</th><th>Doğruluk</th><th>Zayıf konu</th></tr></thead>
  <tbody>${studentRows}</tbody></table>
</section>
<section class="page">
  <h2>${escapeHtml(report.parentMeetingPage.title)}</h2>
  <p>${escapeHtml(report.parentMeetingPage.opening)}</p>
  <ul>${meetingBullets}</ul>
  <p><em>${escapeHtml(report.parentMeetingPage.sampleTalkTrack)}</em></p>
</section>
</body></html>`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
