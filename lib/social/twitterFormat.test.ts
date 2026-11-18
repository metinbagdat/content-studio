import { describe, expect, it } from 'vitest'
import { splitTwitterPost, splitTwitterThread } from './twitterFormat'

describe('splitTwitterPost', () => {
  it('keeps the hook and moves the article URL to the reply', () => {
    const url = 'https://blog.egitim.today/egitimde-yeni-akis/'
    const parts = splitTwitterPost(
      `Kısa kanca burada.\n\n→ egitim.today: https://egitim.today\nYazı: ${url}`,
    )
    expect(parts.body).toBe('Kısa kanca burada.')
    expect(parts.body).not.toMatch(/https?:\/\//)
    expect(parts.replyText).toBe(`Yazı: ${url}`)
  })

  it('returns no reply when the caption has no URL', () => {
    expect(splitTwitterPost('Sadece metin #egitim')).toEqual({
      body: 'Sadece metin #egitim',
      replyText: null,
    })
  })

  it('caps the main tweet at 280 characters', () => {
    const parts = splitTwitterPost(`${'a'.repeat(400)}\nYazı: https://egitim.today/yazi`)
    expect(parts.body.length).toBeLessThanOrEqual(280)
    expect(parts.body.endsWith('…')).toBe(true)
    expect(parts.replyText).toBe('Yazı: https://egitim.today/yazi')
  })
})

describe('splitTwitterThread', () => {
  it('posts each numbered tweet without a URL and keeps the article for the last reply', () => {
    const url = 'https://www.egitim.today/blog/ornek'
    const parts = splitTwitterThread(
      `1/3 Kanca\n\n2/3 Ara fikir https://egitim.today\n\n3/3 Devamı egitim.today\n\nYazı: ${url}`,
    )
    expect(parts.tweets).toEqual(['1/3 Kanca', '2/3 Ara fikir', '3/3 Devamı egitim.today'])
    expect(parts.tweets.join('\n')).not.toMatch(/https?:\/\//)
    expect(parts.replyText).toBe(`Yazı: ${url}`)
  })
})
