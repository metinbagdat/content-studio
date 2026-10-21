import { describe, expect, it } from 'vitest'
import { slugifyTr, stripContentTypePrefix, wpSlugFor } from './slug'

describe('stripContentTypePrefix', () => {
  it('removes the internal BLOG_POST label that leaked into WP titles', () => {
    expect(stripContentTypePrefix('BLOG_POST: YKS çalışma düzeni: günde ne kadar yeter?')).toBe(
      'YKS çalışma düzeni: günde ne kadar yeter?',
    )
  })

  it('handles other content-type labels, lowercase and repeats', () => {
    expect(stripContentTypePrefix('video_script: Başlık')).toBe('Başlık')
    expect(stripContentTypePrefix('BLOG_POST: BLOG_POST: Başlık')).toBe('Başlık')
  })

  it('keeps normal titles with colons intact', () => {
    expect(stripContentTypePrefix('TYT Matematik 90 Net: Strateji')).toBe('TYT Matematik 90 Net: Strateji')
  })
})

describe('slugifyTr', () => {
  it('transliterates Turkish letters like WordPress sanitize_title', () => {
    expect(slugifyTr('AYT Türk Dili ve Edebiyatı Çalışma Rehberi')).toBe(
      'ayt-turk-dili-ve-edebiyati-calisma-rehberi',
    )
    expect(slugifyTr('İlk Ödev: Şimdi Güçlü Ol!')).toBe('ilk-odev-simdi-guclu-ol')
  })

  it('truncates on a word boundary', () => {
    const slug = slugifyTr('a'.repeat(30) + ' ' + 'b'.repeat(30) + ' ' + 'c'.repeat(30), 80)
    expect(slug).toBe('a'.repeat(30) + '-' + 'b'.repeat(30))
  })
})

describe('wpSlugFor', () => {
  it('never produces a blog_post- slug from a prefixed title', () => {
    expect(wpSlugFor('BLOG_POST: TYT Matematik 7 Günlük Tekrar Planı')).toBe(
      'tyt-matematik-7-gunluk-tekrar-plani',
    )
  })

  it('prefers a clean SEO slug and strips a leaked prefix from it', () => {
    expect(wpSlugFor('BLOG_POST: X', 'yks-calisma-duzeni')).toBe('yks-calisma-duzeni')
    expect(wpSlugFor('BLOG_POST: X', 'blog_post-yks-calisma-duzeni')).toBe('yks-calisma-duzeni')
  })

  it('falls back to the title when the SEO slug is empty or not a string', () => {
    expect(wpSlugFor('Pomodoro ile Çalışma', '')).toBe('pomodoro-ile-calisma')
    expect(wpSlugFor('Pomodoro ile Çalışma', 42)).toBe('pomodoro-ile-calisma')
  })
})
