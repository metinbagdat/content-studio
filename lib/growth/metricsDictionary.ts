/**
 * CS-OS-01 — Growth OS metrics dictionary (team reference; no product runtime).
 * Aligned with learncon WLAS (#2190), dailyMetrics, ROLE_ACTIVATION_DEFINITIONS, GROWTH_LOOPS.
 */

export const METRICS_DICT_CATEGORY = 'growth-metrics-dictionary' as const
export const METRICS_DICT_SLUG = 'cs-os-01-dictionary' as const

export type MetricEntry = {
  key: string
  nameTr: string
  nameEn: string
  definitionTr: string
  definitionEn: string
  formulaTr: string
  formulaEn: string
  sourceTable: string
  target: string
  group: 'north_star' | 'activation' | 'loop' | 'network'
}

export type MetricsDictionaryPack = {
  version: 1
  kind: 'growth-metrics-dictionary'
  slug: string
  titleTr: string
  titleEn: string
  metrics: MetricEntry[]
  roleActivations: Array<{
    role: 'student' | 'parent' | 'teacher' | 'institution'
    labelTr: string
    labelEn: string
    summaryTr: string
    summaryEn: string
    formulaTr: string
    formulaEn: string
    sourceTable: string
    target: string
  }>
  loops: Array<{
    key: string
    labelTr: string
    labelEn: string
    formulaTr: string
    formulaEn: string
    targetK: number
    noteTr: string
    noteEn: string
  }>
}

export const METRICS_DICTIONARY_PACK: MetricsDictionaryPack = {
  version: 1,
  kind: 'growth-metrics-dictionary',
  slug: METRICS_DICT_SLUG,
  titleTr: 'Growth OS metrik sözlüğü',
  titleEn: 'Growth OS metrics dictionary',
  metrics: [
    {
      key: 'wlas',
      nameTr: 'WLAS',
      nameEn: 'WLAS (Weekly Learning Active Student)',
      definitionTr:
        'UTC haftasında ≥2 çalışma oturumu + ≥1 pratik/deneme + ≥1 koç etkileşimi yapan farklı öğrenci sayısı.',
      definitionEn:
        'Distinct students in a UTC week with ≥2 study sessions, ≥1 practice/exam, and ≥1 coach interaction.',
      formulaTr: 'count distinct user_id meeting WLAS gates in 7-day window',
      formulaEn: 'count distinct user_id meeting WLAS gates in 7-day window',
      sourceTable: 'growth_daily_metrics.wlas ← study_sessions, test_results, coach_messages',
      target: 'North star — trend up week over week (see /admin/growth/overview)',
      group: 'north_star',
    },
    {
      key: 'family_wau',
      nameTr: 'Aile WAU',
      nameEn: 'Family WAU',
      definitionTr:
        'Haftalık aktif öğrenciye bağlı en az bir veli ilişkisi olan aile birimi sayısı (parent↔child link).',
      definitionEn:
        'Count of family units with a parent↔child link where the student is weekly-active.',
      formulaTr: 'countFamilyWau(links, weeklyActiveUserIds)',
      formulaEn: 'countFamilyWau(links, weeklyActiveUserIds)',
      sourceTable: 'growth_daily_metrics.family_wau ← relationships + weekly-active users',
      target: 'Rising with parent.child.linked activation',
      group: 'network',
    },
    {
      key: 'active_class',
      nameTr: 'Aktif sınıf',
      nameEn: 'Active Class',
      definitionTr:
        'Haftada en az 3 haftalık-aktif öğrencisi olan sınıf sayısı (öğretmen çarpanı göstergesi).',
      definitionEn:
        'Classes with ≥3 weekly-active students in the window (teacher amplification signal).',
      formulaTr: 'countActiveClass(members, weeklyActiveUserIds, minActiveStudents=3)',
      formulaEn: 'countActiveClass(members, weeklyActiveUserIds, minActiveStudents=3)',
      sourceTable: 'growth_daily_metrics.active_class ← class membership + weekly-active users',
      target: 'Grow with teacher.student.joined',
      group: 'network',
    },
    {
      key: 'k_factor',
      nameTr: 'K-faktör (döngü)',
      nameEn: 'K-factor (loop)',
      definitionTr:
        'Döngü başına viral katsayı: tamamlanan çıktı / aktif girdi. Döngüye göre formül değişir (GROWTH_LOOPS).',
      definitionEn:
        'Per-loop viral coefficient: completed outputs / active inputs. Formula varies by GROWTH_LOOPS.',
      formulaTr: 'actualK = numerator / denominator (loop-specific; null if no data)',
      formulaEn: 'actualK = numerator / denominator (loop-specific; null if no data)',
      sourceTable: 'growth_daily_metrics.breakdown (eventCounts) via loopDetection',
      target: 'student_viral≥1.0 · teacher_amplification≥3.0 · teacher_to_institution≥0.2 · parent_to_parent≥1.2',
      group: 'loop',
    },
  ],
  roleActivations: [
    {
      role: 'student',
      labelTr: 'Öğrenci aktivasyonu',
      labelEn: 'Student activation',
      summaryTr: 'Görev tamam + ilerleme gösterildi',
      summaryEn: 'Task completed + progress shown',
      formulaTr: 'aktive / kayıt (öğrenci)',
      formulaEn: 'activated / signup (student)',
      sourceTable: 'growth_events (task_completed ∧ student.progress.shown)',
      target: 'Health OS-09; watch if activationRate < 25%',
    },
    {
      role: 'parent',
      labelTr: 'Veli aktivasyonu',
      labelEn: 'Parent activation',
      summaryTr: 'İlk rapor + çocuk bağlantısı',
      summaryEn: 'First report + child linked',
      formulaTr: 'aktive / kayıt (veli)',
      formulaEn: 'activated / signup (parent)',
      sourceTable: 'growth_events (parent.report.first_viewed ∧ parent.child.linked)',
      target: 'Health OS-09',
    },
    {
      role: 'teacher',
      labelTr: 'Öğretmen aktivasyonu',
      labelEn: 'Teacher activation',
      summaryTr: 'Sınıf + deneme yükleme + analiz görüntüleme',
      summaryEn: 'Class + exam upload + analysis viewed',
      formulaTr: 'aktive / kayıt (öğretmen)',
      formulaEn: 'activated / signup (teacher)',
      sourceTable:
        'growth_events (teacher.class.created ∧ teacher.exam.uploaded ∧ teacher.analysis.viewed)',
      target: 'Health OS-09',
    },
    {
      role: 'institution',
      labelTr: 'Kurum aktivasyonu',
      labelEn: 'Institution activation',
      summaryTr: 'Pilot sınıf onboard + kurum raporu',
      summaryEn: 'Pilot class onboard + institution report',
      formulaTr: 'aktive / kayıt (kurum)',
      formulaEn: 'activated / signup (institution)',
      sourceTable: 'growth_events (institution.student.onboarded ∧ institution report viewed)',
      target: 'Health OS-09; pilot go/no-go',
    },
  ],
  loops: [
    {
      key: 'student_viral',
      labelTr: 'Öğrenci viral',
      labelEn: 'Student viral',
      formulaTr: 'K = referral.signup.completed / aktif öğrenci (yoksa WLAS)',
      formulaEn: 'K = referral.signup.completed / active students (else WLAS)',
      targetK: 1.0,
      noteTr: 'Öğrenci → öğrenci referral',
      noteEn: 'Student → student referral',
    },
    {
      key: 'teacher_amplification',
      labelTr: 'Öğretmen çarpanı',
      labelEn: 'Teacher amplification',
      formulaTr: 'K = teacher.student.joined / aktif öğretmen',
      formulaEn: 'K = teacher.student.joined / active teachers',
      targetK: 3.0,
      noteTr: 'En güçlü döngü',
      noteEn: 'Strongest loop',
    },
    {
      key: 'teacher_to_institution',
      labelTr: 'Öğretmen → kurum',
      labelEn: 'Teacher → institution',
      formulaTr: 'K = institution.pilot.contracted / teacher.institution.referred',
      formulaEn: 'K = institution.pilot.contracted / teacher.institution.referred',
      targetK: 0.2,
      noteTr: 'B2B Trojan',
      noteEn: 'B2B Trojan',
    },
    {
      key: 'parent_to_parent',
      labelTr: 'Veli → veli',
      labelEn: 'Parent → parent',
      formulaTr: 'K = yeni veli kayıt (veli referral) / aktif veli',
      formulaEn: 'K = new parent signups via parent referral / active parents',
      targetK: 1.2,
      noteTr: 'En yüksek potansiyel',
      noteEn: 'Highest potential',
    },
  ],
}

export function validateMetricsDictionary(raw: unknown): MetricsDictionaryPack {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('pack nesne olmalı')
  }
  const row = raw as MetricsDictionaryPack
  if (row.kind !== 'growth-metrics-dictionary') throw new Error('kind geçersiz')
  const keys = new Set(row.metrics?.map((m) => m.key))
  for (const required of ['wlas', 'family_wau', 'active_class', 'k_factor']) {
    if (!keys.has(required)) throw new Error(`metrik eksik: ${required}`)
  }
  for (const m of row.metrics) {
    if (!m.definitionTr || !m.definitionEn || !m.formulaTr || !m.formulaEn) {
      throw new Error(`TR+EN eksik: ${m.key}`)
    }
    if (!m.sourceTable || !m.target) throw new Error(`kaynak/hedef eksik: ${m.key}`)
  }
  if (row.roleActivations?.length !== 4) throw new Error('4 rol aktivasyonu gerekli')
  if (row.loops?.length !== 4) throw new Error('4 döngü gerekli')
  return row
}

export function buildMetricsDictionarySource(pack: MetricsDictionaryPack = METRICS_DICTIONARY_PACK) {
  const validated = validateMetricsDictionary(pack)
  return {
    title: validated.titleTr,
    category: METRICS_DICT_CATEGORY,
    tags: [`slug:${validated.slug}`, 'cs-os-01', 'growth-metrics-dictionary'],
    content: JSON.stringify(validated, null, 2),
  }
}

export function readMetricsDictionary(content: string): MetricsDictionaryPack {
  return validateMetricsDictionary(JSON.parse(content))
}

export function toLearnConMetricsDictionaryExport(
  pack: MetricsDictionaryPack = METRICS_DICTIONARY_PACK,
) {
  return {
    contract: 'LEARNCON-OS-CS-OS-01' as const,
    pack: validateMetricsDictionary(pack),
  }
}

export function renderMetricsDictionaryHtml(pack: MetricsDictionaryPack): string {
  const metricRows = pack.metrics
    .map(
      (m) => `<tr>
  <td><code>${escapeHtml(m.key)}</code><br/><strong>${escapeHtml(m.nameTr)}</strong><br/><span class="en">${escapeHtml(m.nameEn)}</span></td>
  <td>${escapeHtml(m.definitionTr)}<br/><span class="en">${escapeHtml(m.definitionEn)}</span></td>
  <td>${escapeHtml(m.formulaTr)}<br/><span class="en">${escapeHtml(m.formulaEn)}</span></td>
  <td><code>${escapeHtml(m.sourceTable)}</code></td>
  <td>${escapeHtml(m.target)}</td>
</tr>`,
    )
    .join('')

  const roles = pack.roleActivations
    .map(
      (r) => `<tr>
  <td>${escapeHtml(r.labelTr)}<br/><span class="en">${escapeHtml(r.labelEn)}</span></td>
  <td>${escapeHtml(r.summaryTr)}<br/><span class="en">${escapeHtml(r.summaryEn)}</span></td>
  <td>${escapeHtml(r.formulaTr)}<br/><span class="en">${escapeHtml(r.formulaEn)}</span></td>
  <td><code>${escapeHtml(r.sourceTable)}</code></td>
  <td>${escapeHtml(r.target)}</td>
</tr>`,
    )
    .join('')

  const loops = pack.loops
    .map(
      (l) => `<tr>
  <td><code>${escapeHtml(l.key)}</code><br/>${escapeHtml(l.labelTr)}<br/><span class="en">${escapeHtml(l.labelEn)}</span></td>
  <td>${escapeHtml(l.formulaTr)}<br/><span class="en">${escapeHtml(l.formulaEn)}</span></td>
  <td>K ≥ ${l.targetK}</td>
  <td>${escapeHtml(l.noteTr)}<br/><span class="en">${escapeHtml(l.noteEn)}</span></td>
</tr>`,
    )
    .join('')

  return `<!DOCTYPE html>
<html lang="tr"><head><meta charset="utf-8"/>
<title>${escapeHtml(pack.titleTr)}</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;600;700&display=swap" rel="stylesheet"/>
<style>
body{font-family:"Noto Sans",Arial,sans-serif;margin:0;padding:24px;color:#111;line-height:1.4;max-width:1100px}
h1{font-size:22px}h2{font-size:16px;margin-top:28px}
table{width:100%;border-collapse:collapse;font-size:12px;margin-top:8px}
th,td{border:1px solid #ddd;padding:8px;vertical-align:top;text-align:left}
th{background:#f5f5f5}
.en{color:#555;font-size:11px}
code{font-size:11px}
@media print{body{padding:10mm} table{font-size:10px}}
</style></head><body>
  <h1>${escapeHtml(pack.titleTr)}</h1>
  <p class="en">${escapeHtml(pack.titleEn)} · CS-OS-01 · LearnCon /admin/growth ile hizalı</p>

  <h2>Kuzey yıldızı ve ağ metrikleri / North-star &amp; network</h2>
  <table>
    <thead><tr><th>Metrik</th><th>Tanım</th><th>Formül</th><th>Kaynak</th><th>Hedef</th></tr></thead>
    <tbody>${metricRows}</tbody>
  </table>

  <h2>4 rol aktivasyonu / Role activation</h2>
  <table>
    <thead><tr><th>Rol</th><th>Özet</th><th>Formül</th><th>Kaynak</th><th>Hedef</th></tr></thead>
    <tbody>${roles}</tbody>
  </table>

  <h2>4 döngü / Loops (K-factor)</h2>
  <table>
    <thead><tr><th>Döngü</th><th>Formül</th><th>Hedef K</th><th>Not</th></tr></thead>
    <tbody>${loops}</tbody>
  </table>
</body></html>`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
