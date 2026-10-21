import { describe, expect, it } from 'vitest'
import { hashContent, isLikelyHubPage, normalizeTitle } from './articleFingerprint'

describe('normalizeTitle', () => {
  it('lowercases and strips the egitim.today suffix', () => {
    expect(normalizeTitle('TYT Matematik Rehberi | egitim.today')).toBe('tyt matematik rehberi')
  })

  it('strips punctuation but keeps Turkish letters', () => {
    expect(normalizeTitle('Sınavı Kazanmak İçin 5 İpucu!')).toBe('sınavı kazanmak i çin 5 i pucu')
  })

  it('collapses repeated whitespace', () => {
    expect(normalizeTitle('  Çok   Boşluklu   Başlık  ')).toBe('çok boşluklu başlık')
  })
})

describe('hashContent', () => {
  it('is stable for identical content', () => {
    const content = 'Bu bir egitim.today makalesidir.'
    expect(hashContent(content)).toBe(hashContent(content))
  })

  it('ignores whitespace differences', () => {
    expect(hashContent('Merhaba   Dünya')).toBe(hashContent('Merhaba Dünya'))
    expect(hashContent('  Merhaba Dünya  ')).toBe(hashContent('Merhaba Dünya'))
  })

  it('differs for different content', () => {
    expect(hashContent('Birinci makale')).not.toBe(hashContent('İkinci makale'))
  })
})

describe('isLikelyHubPage', () => {
  it('flags nested slugs as hub/category pages regardless of content length', () => {
    expect(isLikelyHubPage('konu/tyt', 'TYT Konu Anlatımı', 'x'.repeat(5000))).toBe(true)
  })

  it('flags short content as a non-article', () => {
    expect(isLikelyHubPage('kisa-yazi', 'Kısa Yazı', 'x'.repeat(100))).toBe(true)
  })

  it('flags "*-rehberleri" slugs with short content', () => {
    expect(isLikelyHubPage('tyt-hazirlik-rehberleri', 'TYT Hazırlık Rehberleri', 'x'.repeat(200))).toBe(
      true,
    )
  })

  it('flags the known TYT/AYT/LGS hazirlik rehberleri hub title regardless of slug', () => {
    expect(
      isLikelyHubPage('genel-sayfa', 'TYT Hazırlık Rehberleri', 'x'.repeat(5000)),
    ).toBe(true)
  })

  it('does not flag a normal flat-slug article with real content', () => {
    const article = 'Bu makalede TYT matematik konularını detaylıca ele alıyoruz. '.repeat(30)
    expect(isLikelyHubPage('tyt-matematik-turev-konusu', 'TYT Türev Konusu', article)).toBe(false)
  })
})
