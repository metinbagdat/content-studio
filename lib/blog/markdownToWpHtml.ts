/** Minimal markdown (## / paragraphs) → WP HTML. No product forms. */
export function markdownToWpHtml(md: string, productCtaUrl = 'https://egitim.today'): string {
  const blocks = md
    .trim()
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean)

  const html: string[] = []
  for (const block of blocks) {
    if (block.startsWith('## ')) {
      html.push(`<h2>${escapeHtml(block.slice(3).trim())}</h2>`)
      continue
    }
    if (block.startsWith('# ')) {
      continue
    }
    const withLinks = escapeHtml(block).replace(
      /\begitim\.today\b/g,
      `<a href="${productCtaUrl}" target="_blank" rel="noopener">egitim.today</a>`,
    )
    html.push(`<p>${withLinks.replace(/\n/g, '<br />')}</p>`)
  }
  html.push(
    `<p><strong>Kayıt ve kişiselleştirilmiş plan:</strong> <a href="${productCtaUrl}" target="_blank" rel="noopener">egitim.today</a></p>`,
  )
  return html.join('\n')
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
