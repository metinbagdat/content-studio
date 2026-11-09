import { describe, expect, it } from 'vitest'
import {
  LOOP_STRATEGY_PACK,
  buildLoopStrategySource,
  renderLoopStrategyHtml,
  toLearnConLoopStrategyExport,
  validateLoopStrategyPack,
} from './loopContentStrategy'

describe('Loop content strategy (CS-OS-02)', () => {
  it('covers four loops each with a weak link and asset brief', () => {
    const pack = validateLoopStrategyPack(LOOP_STRATEGY_PACK)
    expect(pack.strategies).toHaveLength(4)
    expect(pack.strategies.map((s) => s.loopKey)).toEqual([
      'student_viral',
      'teacher_amplification',
      'teacher_to_institution',
      'parent_to_parent',
    ])
    for (const s of pack.strategies) {
      expect(s.weakLinkTr.length).toBeGreaterThan(10)
      expect(s.weakLinkEn.length).toBeGreaterThan(10)
      expect(s.assetBriefTr.length).toBeGreaterThan(20)
      expect(s.contentPillarTr).toBeTruthy()
    }
  })

  it('exports LearnCon contract and HTML', () => {
    expect(buildLoopStrategySource().tags).toContain('cs-os-02')
    expect(toLearnConLoopStrategyExport().contract).toBe('LEARNCON-OS-CS-OS-02')
    const html = renderLoopStrategyHtml(LOOP_STRATEGY_PACK)
    expect(html).toContain('Paylaşılabilir sonuç')
    expect(html).toContain('Noto Sans')
    expect(html).toContain('Öğrenci viral')
  })
})

