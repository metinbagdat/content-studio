import { describe, expect, it } from 'vitest'
import {
  buildClassReportSource,
  buildSampleClassReport,
  readSampleClassReport,
  renderClassReportHtml,
  toLearnConClassReportExport,
} from './sampleClassReport'

describe('sample class report (CS-TCH-02)', () => {
  it('builds 30 TYT Math students with charts and meeting page', () => {
    const r = buildSampleClassReport()
    expect(r.students).toHaveLength(30)
    expect(r.classMeta.exam).toBe('TYT')
    expect(r.charts.length).toBeGreaterThanOrEqual(2)
    expect(r.parentMeetingPage.title).toMatch(/Veli toplantısı/i)
  })

  it('round-trips and exports', () => {
    const draft = buildClassReportSource()
    const again = readSampleClassReport(draft.content)
    expect(toLearnConClassReportExport(again).contract).toBe('LEARNCON-TCH-W2')
    const html = renderClassReportHtml(again)
    expect(html).toContain('Noto Sans')
    expect(html).toContain('Veli toplantısı')
  })
})
