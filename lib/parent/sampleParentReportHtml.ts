import type { SampleParentReport } from './sampleParentReport'

/**
 * Printable HTML PDF template (CS-PAR-01).
 * Turkish glyphs via Noto Sans; LearnCon can print/PDF this page.
 */
export function renderSampleParentReportHtml(report: SampleParentReport): string {
  const chartRows = report.chart.series
    .map(
      (p) =>
        `<tr><td>${escapeHtml(p.label)}</td><td>${p.before}</td><td>${p.after}</td></tr>`,
    )
    .join('')
  const topics = report.weakTopics
    .map(
      (t) =>
        `<tr><td>${escapeHtml(t.label)}</td><td>${t.beforePct}%</td><td>${t.afterPct}%</td></tr>`,
    )
    .join('')
  const avoid = report.conversationSuggestion.avoid
    .map((a) => `<li>${escapeHtml(a)}</li>`)
    .join('')

  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <title>Örnek veli raporu — ${escapeHtml(report.student.displayName)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;600;700&display=swap" rel="stylesheet" />
  <style>
    :root { color-scheme: light; }
    body {
      font-family: "Noto Sans", "DejaVu Sans", Arial, sans-serif;
      margin: 0;
      padding: 32px;
      color: #111;
      line-height: 1.45;
      max-width: 720px;
    }
    h1 { font-size: 22px; margin: 0 0 8px; }
    h2 { font-size: 15px; margin: 24px 0 8px; }
    .meta { color: #555; font-size: 13px; }
    .hero {
      margin-top: 16px;
      padding: 16px;
      border: 1px solid #ddd;
      border-radius: 8px;
      background: #fafafa;
    }
    .delta { font-size: 28px; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { border-bottom: 1px solid #e5e5e5; text-align: left; padding: 8px 6px; }
    th { color: #555; font-weight: 600; }
    .script {
      white-space: pre-wrap;
      padding: 12px;
      background: #f3f7f4;
      border-radius: 8px;
      font-size: 14px;
    }
    .avoid { color: #666; font-size: 13px; }
    .cta { margin-top: 28px; font-size: 14px; }
    @media print {
      body { padding: 12mm; }
      a { color: inherit; text-decoration: none; }
    }
  </style>
</head>
<body>
  <h1>Örnek veli raporu</h1>
  <p class="meta">${escapeHtml(report.student.displayName)} · ${escapeHtml(report.student.gradeLabel)} · ${escapeHtml(report.period.label)} (${escapeHtml(report.period.startDate)} – ${escapeHtml(report.period.endDate)})</p>

  <div class="hero">
    <div class="delta">+${report.headline.netDelta} net · %${report.headline.percentImprovement}</div>
    <p>${escapeHtml(report.headline.summary)}</p>
    <p class="meta">${escapeHtml(report.nets.unit)}: ${report.nets.before} → ${report.nets.after}</p>
  </div>

  <h2>${escapeHtml(report.chart.title)}</h2>
  <table>
    <thead><tr><th>Dönem</th><th>Önce</th><th>Sonra</th></tr></thead>
    <tbody>${chartRows}</tbody>
  </table>
  <!-- chart JSON for LearnCon clients: ${escapeHtml(JSON.stringify(report.chart))} -->

  <h2>Konu bazlı gelişim</h2>
  <table>
    <thead><tr><th>Konu</th><th>Önce</th><th>Sonra</th></tr></thead>
    <tbody>${topics}</tbody>
  </table>

  <h2>${escapeHtml(report.conversationSuggestion.title)}</h2>
  <div class="script">${escapeHtml(report.conversationSuggestion.script)}</div>
  <p class="avoid">Kaçının:</p>
  <ul class="avoid">${avoid}</ul>

  <p class="cta"><a href="${escapeHtml(report.cta.href)}">${escapeHtml(report.cta.label)}</a></p>
</body>
</html>`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
