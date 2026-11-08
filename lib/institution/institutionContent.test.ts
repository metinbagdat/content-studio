import { describe, expect, it } from 'vitest'
import {
  PILOT_GUIDE_PACK,
  buildPilotGuideSource,
  renderPilotGuideHtml,
  toLearnConPilotGuideExport,
  validatePilotGuidePack,
} from './pilotGuideHtml'
import {
  buildInstitutionReportSource,
  buildSampleInstitutionReport,
  renderInstitutionReportHtml,
  toLearnConInstitutionReportExport,
} from './sampleInstitutionReport'

describe('institution content (CS-INST-01/02)', () => {
  it('pilot guide has 4-week plan, metrics, ≥20 sections', () => {
    const pack = validatePilotGuidePack(PILOT_GUIDE_PACK)
    expect(pack.weeklyPlan).toHaveLength(4)
    expect(pack.sections.length).toBeGreaterThanOrEqual(20)
    expect(buildPilotGuideSource().tags).toContain('cs-inst-01')
    expect(toLearnConPilotGuideExport().contract).toBe('LEARNCON-INST-K3')
    expect(renderPilotGuideHtml(pack)).toContain('Noto Sans')
  })

  it('institution report locks 400 students and Logaritma 32%', () => {
    const report = buildSampleInstitutionReport()
    expect(report.meta.studentCount).toBe(400)
    expect(report.highlight.readinessPct).toBe(32)
    expect(buildInstitutionReportSource().category).toBe('institution-sample-report')
    expect(toLearnConInstitutionReportExport().contract).toBe('LEARNCON-INST-K2')
    expect(renderInstitutionReportHtml(report)).toContain('Logaritma')
  })
})
