import assert from 'node:assert/strict'
import { suggestedPodcastEpisodeCount, splitArticleForEpisodes } from './podcastEpisodes'

assert.equal(suggestedPodcastEpisodeCount('kısa '.repeat(10)), 1)
assert.equal(suggestedPodcastEpisodeCount('x'.repeat(4500)), 2)
assert.equal(suggestedPodcastEpisodeCount('x'.repeat(9000)), 3)
assert.equal(suggestedPodcastEpisodeCount('x'.repeat(1000), 3), 3)
assert.equal(suggestedPodcastEpisodeCount('x'.repeat(10000), 1), 3)

const short = splitArticleForEpisodes('Tek parça makale.', 1)
assert.equal(short.length, 1)
assert.equal(short[0].total, 1)

const longArticle = [
  '## Giriş\n\n',
  'a'.repeat(800),
  '\n\n## Gelişme\n\n',
  'b'.repeat(800),
  '\n\n## Sonuç\n\n',
  'c'.repeat(800),
].join('')
const eps = splitArticleForEpisodes(longArticle, 2)
assert.ok(eps.length >= 2)
assert.equal(eps[0].index, 1)
assert.equal(eps[0].total, eps.length)
assert.ok(eps.every((e) => e.body.trim().length > 0))

console.log('podcastEpisodes ok')
