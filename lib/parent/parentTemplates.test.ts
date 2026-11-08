import { describe, expect, it } from 'vitest'
import {
  PARENT_TEMPLATES_PACK,
  buildParentTemplatesSource,
  readParentTemplatesPack,
  toLearnConParentTemplatesExport,
  validateParentTemplatesPack,
} from './parentTemplates'

describe('parent templates (CS-PAR-02)', () => {
  it('ships V1 IG×6, YT 5–8, FB ad, V-E1…E8, veli segment', () => {
    const p = PARENT_TEMPLATES_PACK
    expect(p.segment).toBe('veli')
    expect(p.toneGuide.voice).toBe('formal')
    expect(p.v1.igCarousel).toHaveLength(6)
    expect(p.v1.youtube.durationMinutes.min).toBe(5)
    expect(p.v1.youtube.durationMinutes.max).toBe(8)
    expect(p.v1.facebookAd.audienceHint).toMatch(/35–55/)
    expect(p.emails).toHaveLength(8)
    expect(p.emails.every((e) => e.html.includes('KVKK'))).toBe(true)
  })

  it('round-trips ContentSource and LearnCon export', () => {
    const draft = buildParentTemplatesSource()
    expect(draft.tags).toContain('segment:veli')
    expect(draft.tags).toContain('veli')
    const again = readParentTemplatesPack(draft.content)
    expect(toLearnConParentTemplatesExport(again).contract).toBe('LEARNCON-PAR-V1-VE')
  })

  it('rejects incomplete email set', () => {
    expect(() =>
      validateParentTemplatesPack({
        ...PARENT_TEMPLATES_PACK,
        emails: PARENT_TEMPLATES_PACK.emails.slice(0, 7),
      }),
    ).toThrow(/8 şablon/)
  })
})
