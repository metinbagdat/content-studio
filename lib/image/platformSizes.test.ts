import { describe, expect, it } from 'vitest'
import { PLATFORM_IMAGE_SIZES, getImageSpec, pickImageSpecKey } from './platformSizes'

describe('pickImageSpecKey', () => {
  it.each([
    ['TWITTER', 'twitterPost'],
    ['LINKEDIN', 'linkedinPost'],
    ['INSTAGRAM', 'instagramPost'],
    ['FACEBOOK', 'facebookPost'],
    ['PINTEREST', 'pinterestPin'],
  ] as const)('maps %s to %s', (platform, expected) => {
    expect(pickImageSpecKey(platform)).toBe(expected)
  })

  it('falls back to the OG default for unknown/missing platforms', () => {
    expect(pickImageSpecKey('YOUTUBE')).toBe('ogDefault')
    expect(pickImageSpecKey(undefined)).toBe('ogDefault')
    expect(pickImageSpecKey(null)).toBe('ogDefault')
    expect(pickImageSpecKey('NOT_A_PLATFORM')).toBe('ogDefault')
  })
})

describe('getImageSpec', () => {
  it('returns the exact dimensions for every declared size', () => {
    for (const key of Object.keys(PLATFORM_IMAGE_SIZES) as (keyof typeof PLATFORM_IMAGE_SIZES)[]) {
      const spec = getImageSpec(key)
      expect(spec).toEqual(PLATFORM_IMAGE_SIZES[key])
      expect(spec.width).toBeGreaterThan(0)
      expect(spec.height).toBeGreaterThan(0)
    }
  })
})
