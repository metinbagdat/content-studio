/**
 * CS-PAR-01 — static sample parent report (V3). No AI.
 * LearnCon `/veli/rapor-ornegi` consumes the export contract.
 */

export const PARENT_REPORT_CATEGORY = 'parent-report-sample' as const
export const PARENT_REPORT_SLUG = 'ali-11-ornek' as const

export type ChartSeriesPoint = {
  label: string
  before: number
  after: number
}

export type SampleParentReport = {
  version: 1
  kind: 'parent-report-sample'
  slug: string
  locale: 'tr-TR'
  student: {
    displayName: string
    grade: number
    gradeLabel: string
    examTrack: 'TYT'
  }
  period: {
    label: string
    startDate: string
    endDate: string
  }
  headline: {
    netDelta: number
    percentImprovement: number
    summary: string
  }
  nets: {
    before: number
    after: number
    unit: 'TYT Matematik net'
  }
  /** Chart JSON for LearnCon /veli/rapor-ornegi graphs. */
  chart: {
    type: 'grouped-bar'
    title: string
    yLabel: string
    series: ChartSeriesPoint[]
  }
  weakTopics: Array<{
    code: string
    label: string
    beforePct: number
    afterPct: number
  }>
  conversationSuggestion: {
    title: string
    tone: 'supportive'
    script: string
    avoid: string[]
  }
  cta: {
    label: string
    href: string
  }
}

export type ParentReportSourceDraft = {
  title: string
  category: typeof PARENT_REPORT_CATEGORY
  tags: string[]
  content: string
}

export type LearnConParentReportExport = {
  contract: 'LEARNCON-PAR-V3'
  report: SampleParentReport
  pdf: {
    template: 'sample-parent-report-v1'
    fontFamily: string
    htmlPathHint: '/api/parent-report?format=html'
  }
}

export const ALI_SAMPLE_PARENT_REPORT: SampleParentReport = {
  version: 1,
  kind: 'parent-report-sample',
  slug: PARENT_REPORT_SLUG,
  locale: 'tr-TR',
  student: {
    displayName: 'Ali',
    grade: 11,
    gradeLabel: '11. sınıf',
    examTrack: 'TYT',
  },
  period: {
    label: 'Son 2 hafta',
    startDate: '2026-10-13',
    endDate: '2026-10-26',
  },
  headline: {
    netDelta: 3,
    percentImprovement: 38,
    summary:
      'Ali’nin TYT Matematik neti 2 haftada 8,0’dan 11,0’a çıktı (+3 net). Zayıf üslü/köklü konusunda doğruluk oranı %38 arttı.',
  },
  nets: {
    before: 8,
    after: 11,
    unit: 'TYT Matematik net',
  },
  chart: {
    type: 'grouped-bar',
    title: 'Haftalık TYT Matematik neti',
    yLabel: 'Net',
    series: [
      { label: 'Hafta 1', before: 7.5, after: 8.0 },
      { label: 'Hafta 2', before: 8.0, after: 9.5 },
      { label: 'Hafta 3', before: 8.5, after: 11.0 },
    ],
  },
  weakTopics: [
    {
      code: 'tyt_mat_uslu_koklu',
      label: 'Üslü ve Köklü Sayılar',
      beforePct: 42,
      afterPct: 80,
    },
    {
      code: 'tyt_mat_denklemler',
      label: 'Denklemler',
      beforePct: 55,
      afterPct: 68,
    },
    {
      code: 'tyt_mat_fonksiyonlar',
      label: 'Fonksiyonlar',
      beforePct: 48,
      afterPct: 55,
    },
  ],
  conversationSuggestion: {
    title: 'Bu hafta Ali ile konuşma önerisi',
    tone: 'supportive',
    script:
      '“Üslü sayılarda netlerin yükselmiş; özellikle son iki haftadaki düzenli tekrar işe yaramış. Bu hafta denklemlerde takıldığın 2–3 tipi birlikte bakalım; süre baskısı olmadan, doğru adımları netleştirelim.”',
    avoid: [
      'Kardeş/arkadaşla kıyas',
      '“Neden hâlâ düşük?” suçlayıcı soru',
      'Tek seferde tüm zayıf konuları yüklemek',
    ],
  },
  cta: {
    label: 'Kendi çocuğunuz için analiz başlatın',
    href: '/veli/analiz?utm_persona=parent&utm_content=rapor_ornegi',
  },
}

export function validateSampleParentReport(raw: unknown): SampleParentReport {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('rapor nesne olmalı')
  }
  const row = raw as Record<string, unknown>
  if (row.kind !== 'parent-report-sample') throw new Error('kind geçersiz')
  const student = row.student as SampleParentReport['student'] | undefined
  const headline = row.headline as SampleParentReport['headline'] | undefined
  const nets = row.nets as SampleParentReport['nets'] | undefined
  const chart = row.chart as SampleParentReport['chart'] | undefined
  const conversation = row.conversationSuggestion as
    | SampleParentReport['conversationSuggestion']
    | undefined

  if (!student?.displayName?.trim()) throw new Error('student.displayName gerekli')
  if (student.grade !== 11) throw new Error('örnek rapor 11. sınıf olmalı (CS-PAR-01)')
  if (headline?.netDelta !== 3) throw new Error('netDelta +3 olmalı (CS-PAR-01)')
  if (headline?.percentImprovement !== 38) {
    throw new Error('percentImprovement +38 olmalı (CS-PAR-01)')
  }
  if (typeof nets?.before !== 'number' || typeof nets?.after !== 'number') {
    throw new Error('nets.before/after gerekli')
  }
  if (!chart?.series?.length) throw new Error('chart.series gerekli')
  if (!conversation?.script?.trim()) throw new Error('conversationSuggestion.script gerekli')
  if (conversation.tone !== 'supportive') throw new Error('tone supportive olmalı')

  return row as SampleParentReport
}

export function buildParentReportSource(
  report: SampleParentReport = ALI_SAMPLE_PARENT_REPORT,
): ParentReportSourceDraft {
  const validated = validateSampleParentReport(report)
  return {
    title: `Örnek veli raporu — ${validated.student.displayName} (${validated.student.gradeLabel})`,
    category: PARENT_REPORT_CATEGORY,
    tags: [
      `slug:${validated.slug}`,
      'cs-par-01',
      'parent-report-sample',
      `grade:${validated.student.grade}`,
    ],
    content: JSON.stringify(validated, null, 2),
  }
}

export function readParentReport(content: string): SampleParentReport {
  let raw: unknown
  try {
    raw = JSON.parse(content)
  } catch {
    throw new Error('parent report JSON değil')
  }
  return validateSampleParentReport(raw)
}

export function toLearnConParentReportExport(
  report: SampleParentReport = ALI_SAMPLE_PARENT_REPORT,
): LearnConParentReportExport {
  const validated = validateSampleParentReport(report)
  return {
    contract: 'LEARNCON-PAR-V3',
    report: validated,
    pdf: {
      template: 'sample-parent-report-v1',
      fontFamily: '"Noto Sans", "DejaVu Sans", Arial, sans-serif',
      htmlPathHint: '/api/parent-report?format=html',
    },
  }
}
