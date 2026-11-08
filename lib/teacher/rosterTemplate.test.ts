import { describe, expect, it } from 'vitest'
import {
  COLUMNS_BY_EXAM,
  buildRosterTemplatePack,
  buildRosterTemplateSource,
  readRosterTemplatePack,
  toLearnConRosterExport,
} from './rosterTemplate'
import { renderRosterGuideHtml } from './rosterGuideHtml'

describe('teacher roster template (CS-TCH-01)', () => {
  it('has TYT/AYT/LGS columns, blank+sample CSV, egitimci segment', () => {
    const pack = buildRosterTemplatePack()
    expect(pack.segment).toBe('egitimci')
    expect(COLUMNS_BY_EXAM.TYT.some((c) => c.key === 'net')).toBe(true)
    expect(COLUMNS_BY_EXAM.LGS.some((c) => c.key === 'score')).toBe(true)
    expect(pack.blankCsvByExam.TYT.startsWith('\uFEFF')).toBe(true)
    expect(pack.sampleCsvByExam.TYT).toContain('Ayşe K.')
    expect(pack.sampleMeta.studentCount).toBeGreaterThanOrEqual(5)
  })

  it('round-trips source and LearnCon export', () => {
    const draft = buildRosterTemplateSource()
    expect(draft.tags).toContain('segment:egitimci')
    const again = readRosterTemplatePack(draft.content)
    expect(toLearnConRosterExport(again).contract).toBe('LEARNCON-TCH-W3')
  })

  it('renders multi-page Noto Sans guide', () => {
    const html = renderRosterGuideHtml(buildRosterTemplatePack())
    expect(html).toContain('Noto Sans')
    expect(html).toContain('page-break-after')
    expect(html).toContain('TYT sütunları')
    expect(html).toMatch(/16\. SSS/)
  })
})
