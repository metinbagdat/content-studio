/**
 * Self-test: platformsForSegment order survives normalizePlatforms;
 * infographic markdown parses to 5 points.
 *
 *   npx tsx lib/platforms/targets.selftest.ts
 *   npx tsx lib/media/generateInfographicImage.selftest.ts
 */
import assert from 'node:assert/strict'
import { normalizePlatforms, DEFAULT_PIPELINE_PLATFORMS } from '@content-studio/core/platforms/targets'
import { platformsForSegment } from '../audience/segments'

const tyt = platformsForSegment('tyt')
assert.equal(tyt[0], 'TWITTER')
assert.equal(tyt[1], 'TIKTOK')
assert.deepEqual(normalizePlatforms(tyt), tyt)

const lgs = platformsForSegment('lgs')
assert.equal(lgs[0], 'TIKTOK')
assert.deepEqual(normalizePlatforms(lgs), lgs)

assert.deepEqual(normalizePlatforms([]), [...DEFAULT_PIPELINE_PLATFORMS])
assert.deepEqual(normalizePlatforms(undefined), [...DEFAULT_PIPELINE_PLATFORMS])

console.log('targets.selftest: ok')
