import assert from 'node:assert/strict'
import { markdownToWpHtml } from './markdownToWpHtml'

const html = markdownToWpHtml('## Başlık\n\nZaman ekilecek bir tarladır.\n\negitim.today üzerinde plan.')
assert.match(html, /<h2>Başlık<\/h2>/)
assert.match(html, /<p>/)
assert.match(html, /href="https:\/\/egitim\.today"/)
assert.doesNotMatch(html, /checklist|lead magnet/i)
console.log('markdownToWpHtml ok')
