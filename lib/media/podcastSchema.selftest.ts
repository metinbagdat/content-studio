import assert from 'node:assert/strict'
import {
  cleanPodcastTitle,
  fallbackPodcastScript,
  parsePodcastScript,
} from './podcastSchema'
import { extractPodcastSpeechParts, isMusicCue } from './podcastText'

assert.equal(cleanPodcastTitle('PODCAST_SCRIPT: Deneme'), 'Deneme')
assert.equal(cleanPodcastTitle('Podcast: Konu'), 'Konu')

const raw = JSON.stringify({
  introMusicCue: '[5 sn jingle]',
  welcome: 'Merhaba dinleyiciler.',
  segments: [
    { title: 'Bir', script: 'İlk bölüm metni.' },
    { title: 'İki', script: 'İkinci bölüm metni.' },
  ],
  keyTakeaways: ['Özet bir', 'Özet iki'],
  cta: 'egitim.today adresini ziyaret edin.',
  outroMusicCue: '[3 sn outro jingle]',
  durationMin: 9,
})
const parsed = parsePodcastScript(raw, 'Başlık', 'özet')
assert.equal(parsed.welcome, 'Merhaba dinleyiciler.')
assert.equal(parsed.segments.length, 2)
assert.equal(parsed.keyTakeaways.length, 2)
assert.match(parsed.introMusicCue, /jingle/i)

const legacy = parsePodcastScript(
  JSON.stringify({
    intro: 'Eski alan — konuşulan giriş.',
    segments: [{ title: 'A', script: 'Metin A' }],
    outro: 'Eski CTA metni.',
  }),
  'Konu',
  'excerpt',
)
assert.ok(legacy.welcome.includes('Eski alan') || legacy.welcome.length > 0)
assert.ok(legacy.cta.length > 0)

const fb = fallbackPodcastScript('PODCAST_SCRIPT: Test', 'kısa özet')
assert.equal(fb.segments.length, 1)
assert.match(fb.welcome, /egitim\.today/i)

const spoken = extractPodcastSpeechParts(raw, 'Başlık')
assert.ok(!spoken.fullText.includes('jingle'))
assert.ok(spoken.parts.length >= 3)
assert.ok(spoken.fullText.includes('Merhaba'))

// music cues must not be spoken
assert.equal(isMusicCue('[5 sn jingle]'), true)
assert.equal(isMusicCue('Normal cümle burada.'), false)

console.log('podcastSchema ok')
