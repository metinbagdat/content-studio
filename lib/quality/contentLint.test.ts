import { describe, expect, it } from 'vitest'
import {
  lintContent,
  stripHtml,
  formatContentLintFailure,
  assertContentLintPasses,
} from './contentLint'

const OK_ARTICLE_BODY = `
<p>${'TYT matematik için düzenli tekrar ve kısa problem setleri ile ilerlemek önemlidir. '.repeat(4)}</p>
<h2>Çalışma planı</h2>
<p>${'Her gün 30 dakika konu + 20 dakika soru çözümü önerilir. '.repeat(3)}</p>
`

describe('stripHtml', () => {
  it('removes tags and collapses whitespace', () => {
    expect(stripHtml('<p>Merhaba <strong>dünya</strong></p>')).toBe('Merhaba dünya')
  })
})

describe('lintContent — title / body', () => {
  it('passes a normal article', () => {
    const r = lintContent({ title: 'TYT Matematik Çalışma Rehberi', body: OK_ARTICLE_BODY, mode: 'article' })
    expect(r.ok).toBe(true)
    expect(r.issues).toEqual([])
  })

  it('rejects empty title and empty body', () => {
    const r = lintContent({ title: '  ', body: '', mode: 'article' })
    expect(r.ok).toBe(false)
    expect(r.issues.map((i) => i.code)).toEqual(expect.arrayContaining(['title_empty', 'body_empty']))
  })

  it('rejects short article body', () => {
    const r = lintContent({ title: 'Başlık', body: '<p>Kısa</p>', mode: 'article' })
    expect(r.ok).toBe(false)
    expect(r.issues.some((i) => i.code === 'body_short')).toBe(true)
  })

  it('allows short caption bodies above caption minimum', () => {
    const r = lintContent({
      title: 'X post',
      body: 'TYT için bugün 20 soru çöz!',
      mode: 'caption',
    })
    expect(r.ok).toBe(true)
  })

  it('rejects placeholder text', () => {
    const r = lintContent({
      title: 'TODO: yazılacak',
      body: OK_ARTICLE_BODY,
      mode: 'article',
    })
    expect(r.issues.some((i) => i.code === 'title_placeholder_text')).toBe(true)
  })
})

describe('lintContent — structure', () => {
  it('rejects multiple H1 tags', () => {
    const body = `<h1>Bir</h1>${OK_ARTICLE_BODY}<h1>İki</h1>`
    const r = lintContent({ title: 'Farklı Başlık', body, mode: 'html' })
    expect(r.issues.some((i) => i.code === 'h1_multiple')).toBe(true)
  })

  it('rejects H1 that duplicates the title', () => {
    const body = `<h1>TYT Matematik</h1>${OK_ARTICLE_BODY}`
    const r = lintContent({ title: 'TYT Matematik', body, mode: 'article' })
    expect(r.issues.some((i) => i.code === 'h1_duplicates_title')).toBe(true)
  })

  it('rejects empty heading tags', () => {
    const body = `<h2></h2>${OK_ARTICLE_BODY}`
    const r = lintContent({ title: 'Başlık', body, mode: 'article' })
    expect(r.issues.some((i) => i.code === 'heading_empty')).toBe(true)
  })

  it('rejects broken markdown links', () => {
    const r = lintContent({
      title: 'Başlık',
      body: `İncele [burada]()\n\n${OK_ARTICLE_BODY}`,
      mode: 'article',
    })
    expect(r.issues.some((i) => i.code === 'link_broken')).toBe(true)
  })
})

describe('lintContent — language', () => {
  it('flags common TR slips', () => {
    const r = lintContent({
      title: 'Herşey yolunda',
      body: `Bu birşey değil de ${OK_ARTICLE_BODY}`,
      mode: 'article',
    })
    const codes = r.issues.map((i) => i.code)
    expect(codes).toEqual(expect.arrayContaining(['tr_hersey', 'tr_birsey']))
  })
})

describe('format / assert helpers', () => {
  it('formats failure summary', () => {
    const r = lintContent({ title: '', body: '', mode: 'caption' })
    const msg = formatContentLintFailure(r)
    expect(msg.startsWith('İçerik linter:')).toBe(true)
  })

  it('assertContentLintPasses throws on failure', () => {
    expect(() => assertContentLintPasses({ title: '', body: '', mode: 'caption' })).toThrow(
      /İçerik linter/,
    )
  })

  it('assertContentLintPasses returns result when ok', () => {
    const r = assertContentLintPasses({
      title: 'X post',
      body: 'Kısa ama yeterli caption metni',
      mode: 'caption',
    })
    expect(r.ok).toBe(true)
  })
})
