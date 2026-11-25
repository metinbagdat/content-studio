import { describe, expect, it } from 'vitest'
import {
  TRANSFORM_SYSTEM_PROMPT,
  TWITTER_THREAD_HOOK_MAX,
  TWITTER_TWEET_MAX,
  buildTransformMessages,
  formatTwitterThreadContent,
  twitterThreadCtaUrl,
  validateTwitterThread,
} from './transformPrompt'

describe('twitterThreadCtaUrl', () => {
  it('builds the LC article URL with UTM', () => {
    expect(twitterThreadCtaUrl('tyt-net-hesaplama')).toBe(
      'https://blog.egitim.today/yazilar/tyt-net-hesaplama?utm_source=x&utm_medium=social&utm_campaign=thread',
    )
  })

  it('rejects non kebab-case slugs', () => {
    expect(twitterThreadCtaUrl('../secret')).toBeNull()
    expect(twitterThreadCtaUrl('')).toBeNull()
  })
})

describe('validateTwitterThread', () => {
  const good = [
    'YKS’de net artırmak ezber değil, ölçmektir.',
    'Yanlış defteri tut, aynı tipi haftada bir kez yeniden çöz.',
    'Kısa oturumlar, erken deneme, sonra egitim.today’de plana bağla.',
  ]

  it('accepts 3–6 Turkish tweets with a short hook', () => {
    expect(validateTwitterThread(good)).toEqual({ ok: true, errors: [] })
  })

  it('rejects a hook longer than 270 characters', () => {
    const hook = 'A'.repeat(TWITTER_THREAD_HOOK_MAX + 1)
    const result = validateTwitterThread([hook, good[1], good[2]])
    expect(result.ok).toBe(false)
    expect(result.errors).toContain(`hook_length:${hook.length}`)
  })

  it('rejects any tweet longer than 280 characters', () => {
    const long = 'B'.repeat(TWITTER_TWEET_MAX + 1)
    const result = validateTwitterThread([good[0], long, good[2]])
    expect(result.ok).toBe(false)
    expect(result.errors).toContain(`tweet_2_length:${long.length}`)
  })

  it('rejects fewer than 3 or more than 6 tweets', () => {
    expect(validateTwitterThread(good.slice(0, 2)).errors).toContain('tweet_count:2')
    expect(validateTwitterThread([...good, 'd', 'e', 'f', 'g']).errors).toContain('tweet_count:7')
  })

  it('rejects invented exam dates, MEB sources, and fake stats', () => {
    expect(validateTwitterThread([good[0], 'YKS 2028 tarihi açıklandı sanılıyor', good[2]]).errors).toContain(
      'invented_exam_date',
    )
    expect(
      validateTwitterThread([good[0], 'MEB kaynağına göre bu kitap zorunlu', good[2]]).errors,
    ).toContain('invented_meb_source')
    expect(validateTwitterThread([good[0], 'Öğrencilerin %87’si net artırıyor', good[2]]).errors).toContain(
      'fake_stats',
    )
  })
})

describe('buildTransformMessages TWITTER_THREAD', () => {
  it('asks for a Turkish hook ≤ 270, 3–6 tweets ≤ 280, and a single LC CTA', () => {
    const built = buildTransformMessages('TWITTER_THREAD', 'TYT Net Nasıl Hesaplanır?', 'Net hesabı doğru yanlış.', {
      slug: 'tyt-net-hesaplama',
      tweetCount: 5,
    })
    expect(built.system).toBe(TRANSFORM_SYSTEM_PROMPT)
    expect(built.user).toContain('Turkish X (Twitter) thread')
    expect(built.user).toContain('Exactly 5 tweets')
    expect(built.user).toContain(String(TWITTER_THREAD_HOOK_MAX))
    expect(built.user).toContain(String(TWITTER_TWEET_MAX))
    expect(built.user).toContain(
      'https://blog.egitim.today/yazilar/tyt-net-hesaplama?utm_source=x&utm_medium=social&utm_campaign=thread',
    )
    expect(built.user).toContain('Do not invent exam dates')
    expect(built.user).toContain('Do not invent statistics')
    expect(built.user).toContain('<<<ARTICLE_START>>>')
  })
})

describe('formatTwitterThreadContent', () => {
  it('numbers tweets and appends the Yazı reply line', () => {
    const content = formatTwitterThreadContent(
      ['Hook', 'Gövde', 'Kapanış'],
      'https://blog.egitim.today/yazilar/tyt-net-hesaplama?utm_source=x&utm_medium=social&utm_campaign=thread',
    )
    expect(content).toContain('1/3 Hook')
    expect(content).toContain('3/3 Kapanış')
    expect(content).toMatch(/Yazı: https:\/\/blog\.egitim\.today\/yazilar\/tyt-net-hesaplama\?utm_source=x/)
  })
})
