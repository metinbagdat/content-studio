import { describe, expect, it } from 'vitest'
import {
  ALI_SAMPLE_PARENT_REPORT,
  buildParentReportSource,
  readParentReport,
  toLearnConParentReportExport,
  validateSampleParentReport,
} from './sampleParentReport'
import { renderSampleParentReportHtml } from './sampleParentReportHtml'

describe('sample parent report (CS-PAR-01)', () => {
  it('locks Ali / 11th / +3 net / +38%', () => {
    const r = ALI_SAMPLE_PARENT_REPORT
    expect(r.student.displayName).toBe('Ali')
    expect(r.student.grade).toBe(11)
    expect(r.headline.netDelta).toBe(3)
    expect(r.headline.percentImprovement).toBe(38)
    expect(r.conversationSuggestion.tone).toBe('supportive')
    expect(r.chart.series.length).toBeGreaterThan(0)
  })

  it('round-trips ContentSource draft and LearnCon export', () => {
    const draft = buildParentReportSource()
    expect(draft.category).toBe('parent-report-sample')
    const again = readParentReport(draft.content)
    const exported = toLearnConParentReportExport(again)
    expect(exported.contract).toBe('LEARNCON-PAR-V3')
    expect(exported.pdf.fontFamily).toMatch(/Noto Sans/)
  })

  it('renders HTML PDF template with Turkish content and Noto Sans', () => {
    const html = renderSampleParentReportHtml(ALI_SAMPLE_PARENT_REPORT)
    expect(html).toContain('Noto Sans')
    expect(html).toContain('Ali')
    expect(html).toContain('Üslü')
    expect(html).toContain('charset="utf-8"')
  })

  it('rejects wrong acceptance numbers', () => {
    expect(() =>
      validateSampleParentReport({
        ...ALI_SAMPLE_PARENT_REPORT,
        headline: { ...ALI_SAMPLE_PARENT_REPORT.headline, netDelta: 2 },
      }),
    ).toThrow(/\+3/)
  })
})
