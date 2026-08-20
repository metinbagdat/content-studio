import assert from 'node:assert/strict'
import { parseInfographicFromMarkdown, resolveInfographicDesign } from './generateInfographicImage'

const md = `# TYT 7 Gün Planı
Kısa ve net tekrar
1. Gün 1 — Temel
   Konu özeti
2. Gün 2 — Problem
   20 soru
3. Gün 3 — Deneme
4. Gün 4 — Analiz
5. Gün 5 — Pekiştir
Kaynak: egitim.today`

const parsed = parseInfographicFromMarkdown(md)
assert.equal(parsed.headline, 'TYT 7 Gün Planı')
assert.equal(parsed.subhead, 'Kısa ve net tekrar')
assert.equal(parsed.points.length, 5)
assert.equal(parsed.points[0].label, 'Gün 1')
assert.equal(parsed.points[0].stat, 'Temel')
assert.equal(parsed.points[0].detail, 'Konu özeti')
assert.equal(parsed.source, 'egitim.today')

const design = resolveInfographicDesign(
  {
    headline: 'Özel başlık',
    points: [
      { label: 'A', stat: '10%', detail: 'd1' },
      { label: 'B', stat: '', detail: 'd2' },
      { label: 'C', stat: '3', detail: '' },
      { label: 'D', stat: '', detail: '' },
      { label: 'E', stat: '', detail: '' },
    ],
  },
  '',
)
assert.equal(design.headline, 'Özel başlık')
assert.equal(design.points.length, 5)
assert.match(design.accent, /^#[0-9A-Fa-f]{6}$/)

console.log('generateInfographicImage.selftest: ok')
