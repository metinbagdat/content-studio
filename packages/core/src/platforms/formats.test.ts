import { describe, expect, it } from 'vitest'
import { PLATFORM_FORMATS, formatForPlatform } from './formats'

describe('formatForPlatform', () => {
  it('leaves text untouched when it fits the platform limit', () => {
    expect(formatForPlatform('Kısa bir metin.', 'TWITTER')).toBe('Kısa bir metin.')
  })

  it('trims leading/trailing whitespace even when under the limit', () => {
    expect(formatForPlatform('  boşluklu  ', 'TWITTER')).toBe('boşluklu')
  })

  it('truncates and appends an ellipsis when text exceeds the platform limit', () => {
    const max = PLATFORM_FORMATS.TWITTER.maxChars
    const long = 'a'.repeat(max + 50)
    const result = formatForPlatform(long, 'TWITTER')
    expect(result.length).toBe(max)
    expect(result.endsWith('…')).toBe(true)
  })

  it('respects each platform\'s own maxChars', () => {
    const long = 'x'.repeat(10_000)
    for (const platform of Object.keys(PLATFORM_FORMATS) as (keyof typeof PLATFORM_FORMATS)[]) {
      const result = formatForPlatform(long, platform)
      expect(result.length).toBe(PLATFORM_FORMATS[platform].maxChars)
    }
  })
})
