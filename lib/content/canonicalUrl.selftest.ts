import assert from 'node:assert/strict'
import { canonicalArticleUrl, shareCtaBlock, withShareCta } from './canonicalUrl'

const wp = 'https://blog.egitim.today/egitimde-yeni-akis-yapay-zeka-etkilesim/'
assert.equal(canonicalArticleUrl([`wp-link:${wp}`, 'wp-published', 'blog:ignored-slug']), wp)
assert.equal(
  canonicalArticleUrl(['blog:zamani-zafere-donusturmek']),
  'https://www.egitim.today/blog/zamani-zafere-donusturmek',
)
assert.equal(canonicalArticleUrl(['wp-published']), undefined)
assert.equal(canonicalArticleUrl([]), undefined)

const cta = shareCtaBlock(wp)
assert.match(cta, /egitim\.today/)
assert.match(cta, /Yazı: https:\/\/blog\.egitim\.today\//)
assert.doesNotMatch(cta, /www\.egitim\.today\/blog/)

const twitter = withShareCta('x'.repeat(400), wp, 'TWITTER')
assert.ok(twitter.length <= 280)
assert.ok(twitter.includes(wp), twitter)

console.log('canonicalUrl ok')
