import { describe, expect, it } from 'vitest'
import {
  buildParentMeetingPack,
  buildParentMeetingSource,
  renderParentMeetingHtml,
  toLearnConParentMeetingExport,
  validateParentMeetingPack,
} from './parentMeetingTemplate'

describe('Institution parent meeting (CS-INST-04)', () => {
  it('has brand frame, institution summary, and one page per student', () => {
    const pack = validateParentMeetingPack(buildParentMeetingPack())
    expect(pack.brand.institutionName).toBeTruthy()
    expect(pack.brand.primaryColor).toMatch(/^#/)
    expect(pack.institutionSummary.headline.length).toBeGreaterThan(20)
    expect(pack.studentPages.length).toBe(pack.meetingMeta.studentCount)
    expect(pack.studentPages.length).toBeGreaterThanOrEqual(8)
    expect(pack.distinctFromTeacherContract).toBe('LEARNCON-TCH-W2')
  })

  it('exports LearnCon contract and branded HTML with per-student pages', () => {
    expect(buildParentMeetingSource().tags).toContain('cs-inst-04')
    expect(toLearnConParentMeetingExport().contract).toBe('LEARNCON-INST-04')
    const html = renderParentMeetingHtml(buildParentMeetingPack())
    expect(html).toContain('Noto Sans')
    expect(html).toContain('Örnek Koleji')
    expect(html).toContain('Öğrenci sayfası')
    expect(html).toContain('Kurum özeti')
    expect(html).toContain('LEARNCON-TCH-W2')
  })
})
