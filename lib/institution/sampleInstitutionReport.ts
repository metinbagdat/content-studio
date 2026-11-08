/**
 * CS-INST-02 — anonim 400 öğrenci örnek kurum raporu (TYT Matematik).
 */

export const INSTITUTION_REPORT_CATEGORY = 'institution-sample-report' as const
export const INSTITUTION_REPORT_SLUG = 'k2-ornek-kurum-400' as const

export type InstitutionChart = {
  type: 'topic-readiness' | 'net-bands' | 'campus-compare'
  title: string
  series: Array<{ label: string; value: number; unit?: string }>
}

export type SampleInstitutionReport = {
  version: 1
  kind: 'institution-sample-report'
  slug: string
  segment: 'egitimci'
  meta: {
    label: string
    anonymized: true
    studentCount: number
    exam: 'TYT'
    subject: 'Matematik'
    campuses: number
  }
  headline: string
  /** Package-aligned figure from acceptance: Logaritma %32 */
  highlight: {
    topic: string
    readinessPct: number
    note: string
  }
  aggregates: {
    avgNet: number
    medianNet: number
    below8Pct: number
    usluBoostNetDelta: number
  }
  charts: InstitutionChart[]
}

export function buildSampleInstitutionReport(): SampleInstitutionReport {
  return {
    version: 1,
    kind: 'institution-sample-report',
    slug: INSTITUTION_REPORT_SLUG,
    segment: 'egitimci',
    meta: {
      label: 'Anonim örnek kurum — 400 öğrenci',
      anonymized: true,
      studentCount: 400,
      exam: 'TYT',
      subject: 'Matematik',
      campuses: 2,
    },
    headline:
      '400 anonim TYT Matematik kaydında Logaritma hazırbulunuşluğu %32. Üstel/üslü önkoşulu güçlendirilen şubelerde 2 haftada sınıf ortalaması +1,2 net.',
    highlight: {
      topic: 'Logaritma',
      readinessPct: 32,
      note: 'Paket rakamı (CS-INST-02 acceptance) — üstel önkoşul boşluğu ile uyumlu.',
    },
    aggregates: {
      avgNet: 9.4,
      medianNet: 9.0,
      below8Pct: 28,
      usluBoostNetDelta: 1.2,
    },
    charts: [
      {
        type: 'topic-readiness',
        title: 'Konu hazırbulunuşluk %',
        series: [
          { label: 'Rasyonel', value: 61, unit: '%' },
          { label: 'Üslü / Köklü', value: 48, unit: '%' },
          { label: 'Üstel', value: 41, unit: '%' },
          { label: 'Logaritma', value: 32, unit: '%' },
          { label: 'Denklemler', value: 55, unit: '%' },
        ],
      },
      {
        type: 'net-bands',
        title: 'Net bandı dağılımı (öğrenci %)',
        series: [
          { label: '0–7.9', value: 28, unit: '%' },
          { label: '8–10.9', value: 36, unit: '%' },
          { label: '11–13.9', value: 24, unit: '%' },
          { label: '14+', value: 12, unit: '%' },
        ],
      },
      {
        type: 'campus-compare',
        title: 'Kampüs ortalama net',
        series: [
          { label: 'Kampüs A', value: 9.1 },
          { label: 'Kampüs B', value: 9.7 },
        ],
      },
    ],
  }
}

export function validateSampleInstitutionReport(raw: unknown): SampleInstitutionReport {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('rapor nesne olmalı')
  }
  const row = raw as SampleInstitutionReport
  if (row.kind !== 'institution-sample-report') throw new Error('kind geçersiz')
  if (row.meta?.studentCount !== 400) throw new Error('400 öğrenci gerekli')
  if (row.meta?.anonymized !== true) throw new Error('anonim olmalı')
  if (row.highlight?.readinessPct !== 32 || !/logaritma/i.test(row.highlight.topic)) {
    throw new Error('Logaritma %32 highlight gerekli')
  }
  if (!row.charts?.length) throw new Error('grafik JSON gerekli')
  return row
}

export function buildInstitutionReportSource(
  report: SampleInstitutionReport = buildSampleInstitutionReport(),
) {
  const validated = validateSampleInstitutionReport(report)
  return {
    title: validated.meta.label,
    category: INSTITUTION_REPORT_CATEGORY,
    tags: [
      `slug:${validated.slug}`,
      'cs-inst-02',
      'institution-sample-report',
      'segment:egitimci',
    ],
    content: JSON.stringify(validated, null, 2),
  }
}

export function readSampleInstitutionReport(content: string): SampleInstitutionReport {
  return validateSampleInstitutionReport(JSON.parse(content))
}

export function toLearnConInstitutionReportExport(
  report: SampleInstitutionReport = buildSampleInstitutionReport(),
) {
  return {
    contract: 'LEARNCON-INST-K2' as const,
    report: validateSampleInstitutionReport(report),
  }
}

export function renderInstitutionReportHtml(report: SampleInstitutionReport): string {
  const charts = report.charts
    .map((c) => {
      const items = c.series
        .map((s) => `<li>${escapeHtml(s.label)}: ${s.value}${s.unit ? escapeHtml(s.unit) : ''}</li>`)
        .join('')
      return `<h2>${escapeHtml(c.title)}</h2><ul>${items}</ul>`
    })
    .join('')

  return `<!DOCTYPE html>
<html lang="tr"><head><meta charset="utf-8"/>
<title>${escapeHtml(report.meta.label)}</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;600;700&display=swap" rel="stylesheet"/>
<style>
body{font-family:"Noto Sans",Arial,sans-serif;margin:0;padding:24px;max-width:800px;color:#111;line-height:1.45}
.hero{padding:14px;border:1px solid #ddd;border-radius:8px;background:#fafafa;margin:12px 0}
h1{font-size:22px}h2{font-size:15px;margin-top:20px}
@media print{body{padding:12mm}}
</style></head><body>
  <h1>${escapeHtml(report.meta.label)}</h1>
  <p>${report.meta.studentCount} anonim öğrenci · ${report.meta.exam} ${escapeHtml(report.meta.subject)} · ${report.meta.campuses} kampüs</p>
  <div class="hero"><strong>${escapeHtml(report.headline)}</strong>
  <p>Logaritma hazırbulunuşluk: <strong>%${report.highlight.readinessPct}</strong> — ${escapeHtml(report.highlight.note)}</p>
  <p>Ort. net ${report.aggregates.avgNet} · medyan ${report.aggregates.medianNet} · &lt;8 net %{report.aggregates.below8Pct} · üslü güçlendirme delta +${report.aggregates.usluBoostNetDelta}</p>
  </div>
  ${charts}
  <!-- chart JSON: ${escapeHtml(JSON.stringify(report.charts))} -->
</body></html>`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
