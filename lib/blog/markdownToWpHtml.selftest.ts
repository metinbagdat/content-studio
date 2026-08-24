import assert from 'node:assert/strict'
import { markdownToWpHtml } from './markdownToWpHtml'

const html = markdownToWpHtml('## Başlık\n\nZaman ekilecek bir tarladır.\n\negitim.today üzerinde plan.')
assert.match(html, /<h2>Başlık<\/h2>/)
assert.match(html, /<p>/)
assert.match(html, /href="https:\/\/egitim\.today"/)
assert.doesNotMatch(html, /href="<a /)
assert.doesNotMatch(html, /<!-- wp:/)
assert.doesNotMatch(html, /checklist|lead magnet/i)

const crlf = markdownToWpHtml('# Başlık\r\n\r\nKarar verme birinci cümle.\r\n\r\n## Alt\r\n\r\nİkinci paragraf.')
assert.match(crlf, /Karar verme birinci cümle/)
assert.match(crlf, /<h2>Alt<\/h2>/)
assert.doesNotMatch(crlf, /# Başlık/)
console.log('markdownToWpHtml ok')
