/** Markdown → classic WP HTML (no Gutenberg comments — more stable on Hostinger). */

const DEFAULT_CTA = 'https://egitim.today'

export function markdownToWpHtml(md: string, productCtaUrl = DEFAULT_CTA): string {
  const blocks = md
    .replace(/\r\n/g, '\n')
    .trim()
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean)

  const html: string[] = []
  for (const block of blocks) {
    if (block.startsWith('# ') && !block.startsWith('## ')) {
      continue
    }
    if (block.startsWith('### ')) {
      html.push(`<h3>${inline(block.slice(4).trim(), productCtaUrl)}</h3>`)
      continue
    }
    if (block.startsWith('## ')) {
      html.push(`<h2>${inline(block.slice(3).trim(), productCtaUrl)}</h2>`)
      continue
    }
    const listLines = block.split('\n').filter(Boolean)
    if (listLines.length > 0 && listLines.every((l) => /^[-*]\s+/.test(l))) {
      const items = listLines
        .map((l) => `<li>${inline(l.replace(/^[-*]\s+/, ''), productCtaUrl)}</li>`)
        .join('')
      html.push(`<ul>${items}</ul>`)
      continue
    }
    html.push(`<p>${inline(block, productCtaUrl).replace(/\n/g, '<br />')}</p>`)
  }
  html.push(
    `<p><strong>Kayıt ve kişiselleştirilmiş plan:</strong> <a href="${productCtaUrl}" target="_blank" rel="noopener">egitim.today</a></p>`,
  )
  return html.join('\n')
}

function inline(text: string, productCtaUrl: string): string {
  let s = escapeHtml(text)
  s = s.replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  // Auto-link bare egitim.today only outside existing <a>…</a> (avoids nested anchors).
  s = s.replace(/(<a\b[^>]*>[\s\S]*?<\/a>)|(?<![:/\w])egitim\.today\b/g, (m, anchor) => {
    if (anchor) return anchor
    return `<a href="${productCtaUrl}" target="_blank" rel="noopener">egitim.today</a>`
  })
  return s
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
