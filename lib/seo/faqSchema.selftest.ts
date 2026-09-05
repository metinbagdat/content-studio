import assert from 'node:assert/strict'
import {
  extractFaqPairs,
  shouldAttachFaqSchema,
  withFaqSchemaHtml,
  htmlHasFaqPageJsonLd,
  titleSuggestsFaq,
} from './faqSchema'

const qaHtml = `
<p>Giriş metni.</p>
<h2>YKS'ye kaç ay kaldı?</h2>
<p>Takvime göre kalan süre değişir; net tarih ÖSYM duyurusuna bakın ve geriye doğru plan yapın.</p>
<h2>Ne yapmalı?</h2>
<p>Önce zayıf konuları listeleyin, haftalık deneme rutini kurun ve uyku düzenini koruyun.</p>
<h3>Hangi kaynaklar işe yarar?</h3>
<p>Resmi müfredata uygun kaynaklar ve kısa tekrar notları en verimli seçeneklerdir.</p>
`

assert.equal(shouldAttachFaqSchema('YKS hazırlık', qaHtml), true)
const pairs = extractFaqPairs(qaHtml)
assert.ok(pairs.length >= 2, `expected >=2 pairs, got ${pairs.length}`)
assert.match(pairs[0].question, /kaç ay/i)

const { html, pairs: attached } = withFaqSchemaHtml(qaHtml, "YKS'ye kaç ay kaldı, ne yapmalı?")
assert.ok(attached.length >= 2)
assert.ok(htmlHasFaqPageJsonLd(html))
assert.match(html, /application\/ld\+json/)
assert.match(html, /FAQPage/)

const noQa = '<p>Bu yazı düz anlatım; soru başlığı yok.</p><h2>Planlama adımları</h2><p>Birinci adım hedef seçmek.</p>'
assert.equal(shouldAttachFaqSchema('Planlama rehberi', noQa), false)
assert.equal(withFaqSchemaHtml(noQa, 'Planlama rehberi').pairs.length, 0)

const md = `## YKS'ye kaç ay kaldı?\n\nTakvim ve ÖSYM duyurusuna göre hesaplayın.\n\n## Ne yapmalı?\n\nHaftalık deneme ve konu tekrarı rutini kurun.`
assert.ok(extractFaqPairs(md).length >= 2)

// Raw markdown → wrapped HTML still attaches via sourceText
const wrapped = `<p>${md.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br/>')}</p>`
const fromSource = withFaqSchemaHtml(wrapped, "YKS'ye kaç ay kaldı?", md)
assert.ok(fromSource.pairs.length >= 2)
assert.ok(htmlHasFaqPageJsonLd(fromSource.html))

assert.equal(titleSuggestsFaq("YKS'ye kaç ay kaldı, ne yapmalı?"), true)
assert.equal(titleSuggestsFaq('Karar verme döngüsü'), false)

// Idempotent
const twice = withFaqSchemaHtml(html, 'x')
assert.equal(twice.pairs.length, 0)
assert.ok(htmlHasFaqPageJsonLd(twice.html))

console.log('faqSchema ok')
