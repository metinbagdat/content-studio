import { describe, expect, it } from 'vitest'
import {
  YKS_STUDY_PLAN_KEYWORD,
  buildKeywordSource,
  planSocialDerivative,
  readKeywordRecord,
} from './keywordRecord'

describe('keyword research record', () => {
  it('stores the YKS study-plan keyword as unverified on the existing source shape', () => {
    const draft = buildKeywordSource(YKS_STUDY_PLAN_KEYWORD)
    expect(draft.category).toBe('seo-keyword')
    expect(draft.title).toBe('YKS çalışma programı')
    expect(draft.tags).toContain('volume:unverified')
    const record = readKeywordRecord(draft.content)
    expect(record.verified).toBe(false)
    expect(record.targetUrl).toBe('https://blog.egitim.today/yazilar/yks-calisma-programi')
    expect(record.claimedVolume ?? null).toBeNull()
  })

  it('refuses to call an Ahrefs figure verified', () => {
    const draft = buildKeywordSource({
      keyword: 'tyt konuları',
      group: 'tyt-konu',
      volumeSource: 'ahrefs-third-party',
      intent: 'informational',
      targetUrl: 'https://blog.egitim.today/yazilar/tyt-matematik-konulari',
      claimedVolume: 20000,
    })
    const record = readKeywordRecord(draft.content)
    expect(record.volumeSource).toBe('ahrefs-third-party')
    expect(record.verified).toBe(false)
    expect(() =>
      readKeywordRecord(JSON.stringify({ ...record, verified: true })),
    ).toThrow(/doğrulanmış/i)
  })

  it('does not attach a volume number to an unverified row', () => {
    expect(() =>
      buildKeywordSource({ ...YKS_STUDY_PLAN_KEYWORD, claimedVolume: 20000 }),
    ).toThrow(/hacim/)
  })

  it('keeps social output in review and blocks quality under 90', () => {
    expect(planSocialDerivative({ humanApproved: false, quality: 95 })).toMatchObject({
      create: false,
      autoPublish: false,
    })
    expect(planSocialDerivative({ humanApproved: true, quality: 89 })).toMatchObject({
      create: false,
      reason: 'quality_below_90',
      autoPublish: false,
    })
    expect(planSocialDerivative({ humanApproved: true, quality: 90 })).toEqual({
      create: true,
      status: 'IN_REVIEW',
      autoPublish: false,
      contentType: 'SOCIAL_CAPTION',
    })
  })
})
