import assert from 'node:assert/strict'
import { isDurableMediaUrl, publicMediaVideoUrl } from './videoStorage'

assert.equal(isDurableMediaUrl('https://xyz.public.blob.vercel-storage.com/videos/abc.mp4'), true)
assert.equal(isDurableMediaUrl('https://studio.egitim.today/api/media/abc/video'), false)
assert.equal(isDurableMediaUrl(publicMediaVideoUrl('abc')), false)
assert.equal(isDurableMediaUrl(''), false)
assert.equal(isDurableMediaUrl(null), false)

console.log('videoStorage durable-url ok')
