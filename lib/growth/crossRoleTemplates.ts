/**
 * CS-OS-03 — Cross-role content templates.
 * Invite / share / referral / institution tones; TR+EN; WhatsApp-first where noted.
 */

export const CROSS_ROLE_CATEGORY = 'growth-cross-role' as const
export const CROSS_ROLE_SLUG = 'cs-os-03-templates' as const

export type CrossRoleTone =
  | 'invite_peer'
  | 'share_result'
  | 'referral_parent'
  | 'institution_formal'

export type CrossRoleTemplate = {
  id: string
  tone: CrossRoleTone
  roleFrom: 'student' | 'teacher' | 'parent' | 'institution'
  roleTo: 'student' | 'teacher' | 'parent' | 'institution' | 'peer'
  channel: 'whatsapp' | 'email' | 'linkedin' | 'sms'
  subjectTr?: string
  subjectEn?: string
  bodyTr: string
  bodyEn: string
  ctaHref: string
  notesTr: string
}

export type CrossRolePack = {
  version: 1
  kind: 'growth-cross-role'
  slug: string
  titleTr: string
  titleEn: string
  templates: CrossRoleTemplate[]
}

export const CROSS_ROLE_PACK: CrossRolePack = {
  version: 1,
  kind: 'growth-cross-role',
  slug: CROSS_ROLE_SLUG,
  titleTr: 'Çapraz rol şablonları',
  titleEn: 'Cross-role templates',
  templates: [
    {
      id: 'cr-invite-teacher-student',
      tone: 'invite_peer',
      roleFrom: 'teacher',
      roleTo: 'student',
      channel: 'whatsapp',
      bodyTr:
        'Sınıf — 8 soruluk önkoşul analizi linki: {{cta}} (ücretsiz, ~2 dk). Sonuçları sınıfta konuşacağız.',
      bodyEn:
        'Class — prerequisite analysis link (8Q): {{cta}} (free, ~2 min). We’ll discuss results in class.',
      ctaHref: 'https://egitim.today/analiz?utm_content=teacher_invite_student',
      notesTr: 'Öğretmen→öğrenci davet; meslektaş/sınıf tonu, ücret yok.',
    },
    {
      id: 'cr-share-student-parent',
      tone: 'share_result',
      roleFrom: 'student',
      roleTo: 'parent',
      channel: 'whatsapp',
      bodyTr:
        'Analizim: {{level}} · asıl takıldığım {{gap}}. Özet kart: {{cta}}',
      bodyEn:
        'My analysis: {{level}} · real gap {{gap}}. Summary card: {{cta}}',
      ctaHref: 'https://egitim.today/sonuc?utm_source=share&utm_medium=wa&utm_content=student_to_parent',
      notesTr: 'Öğrenci→veli paylaşım; samimi öğrenci tonu.',
    },
    {
      id: 'cr-referral-parent',
      tone: 'referral_parent',
      roleFrom: 'parent',
      roleTo: 'parent',
      channel: 'whatsapp',
      bodyTr:
        'Merhaba, çocuğumuzun TYT analizinde net +3 ve süre %38 iyileşti. Örnek rapor: {{cta}} — istersen sen de bak.',
      bodyEn:
        'Hi — our child’s TYT analysis showed +3 net and 38% time gain. Sample report: {{cta}} if useful.',
      ctaHref: 'https://egitim.today/veli/rapor-ornegi?utm_persona=parent&utm_content=parent_ref',
      notesTr: 'Veli→veli referans; CS-PAR-01 resmi ton.',
    },
    {
      id: 'cr-institution-to-parent',
      tone: 'institution_formal',
      roleFrom: 'institution',
      roleTo: 'parent',
      channel: 'email',
      subjectTr: 'Kurum bilgilendirme: önkoşul haritası özeti',
      subjectEn: 'Institution notice: prerequisite map summary',
      bodyTr:
        'Sayın Veli,\n\n{{schoolName}} olarak bu dönem önkoşul haritası pilotunda sınıf bazlı ilerlemeyi paylaşıyoruz (kişisel not değil). Özet: {{cta}}\n\nSaygılarımızla,\n{{schoolName}}',
      bodyEn:
        'Dear Parent,\n\n{{schoolName}} is sharing class-level prerequisite progress from this term’s pilot (not personal grades). Summary: {{cta}}\n\nBest regards,\n{{schoolName}}',
      ctaHref: 'https://egitim.today/kurumlar/veli-ozet?utm_content=inst_to_parent',
      notesTr: 'Kurum→veli bilgilendirme; ROI/kurumsal ton, gizlilik notu.',
    },
    {
      id: 'cr-invite-teacher-peer',
      tone: 'invite_peer',
      roleFrom: 'teacher',
      roleTo: 'peer',
      channel: 'whatsapp',
      bodyTr:
        'Merhaba — sınıfta önkoşul haritasını ücretsiz denedim, net etkisi net görünüyor. Sen de bak: {{cta}} (2 dk, kayıt yok).',
      bodyEn:
        'Hi — tried the free prerequisite map with my class; impact is clear. Try it: {{cta}} (2 min, no signup).',
      ctaHref: 'https://egitim.today/ogretmen?utm_content=peer_invite',
      notesTr: 'Meslektaş ek davet; ücret/“AI” yok.',
    },
    {
      id: 'cr-share-student-peer',
      tone: 'share_result',
      roleFrom: 'student',
      roleTo: 'peer',
      channel: 'whatsapp',
      bodyTr:
        'Analizim: {{level}} · asıl takıldığım {{gap}}. Sen de 8 soruda bak: {{cta}}',
      bodyEn:
        'My analysis: {{level}} · my real gap {{gap}}. Do yours in 8Q: {{cta}}',
      ctaHref: 'https://egitim.today/analiz?utm_source=share&utm_medium=wa&utm_content=viral_result',
      notesTr: 'Viral öğrenci→akran; OG kartıyla.',
    },
  ],
}

export function validateCrossRolePack(raw: unknown): CrossRolePack {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('pack nesne olmalı')
  }
  const row = raw as CrossRolePack
  if (row.kind !== 'growth-cross-role') throw new Error('kind geçersiz')
  if (!row.templates?.length) throw new Error('şablon yok')
  const tones = new Set(row.templates.map((t) => t.tone))
  for (const t of [
    'invite_peer',
    'share_result',
    'referral_parent',
    'institution_formal',
  ] as const) {
    if (!tones.has(t)) throw new Error(`ton eksik: ${t}`)
  }
  for (const t of row.templates) {
    if (!t.bodyTr || !t.bodyEn || !t.ctaHref) {
      throw new Error(`şablon eksik: ${t.id}`)
    }
    if (!t.bodyTr.includes('{{cta}}') || !t.bodyEn.includes('{{cta}}')) {
      throw new Error(`{{cta}} placeholder gerekli: ${t.id}`)
    }
  }
  return row
}

export function buildCrossRoleSource(pack: CrossRolePack = CROSS_ROLE_PACK) {
  const validated = validateCrossRolePack(pack)
  return {
    title: validated.titleTr,
    category: CROSS_ROLE_CATEGORY,
    tags: [`slug:${validated.slug}`, 'cs-os-03', 'growth-cross-role'],
    content: JSON.stringify(validated, null, 2),
  }
}

export function readCrossRolePack(content: string): CrossRolePack {
  return validateCrossRolePack(JSON.parse(content))
}

export function fillCrossRoleTemplate(
  template: CrossRoleTemplate,
  vars: Record<string, string>,
): { subject?: string; bodyTr: string; bodyEn: string } {
  const withCta = { ...vars, cta: vars.cta ?? template.ctaHref }
  const merge = (text: string) =>
    text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => withCta[key] ?? `{{${key}}}`)
  return {
    subject: template.subjectTr ? merge(template.subjectTr) : undefined,
    bodyTr: merge(template.bodyTr),
    bodyEn: merge(template.bodyEn),
  }
}

export function toLearnConCrossRoleExport(pack: CrossRolePack = CROSS_ROLE_PACK) {
  return { contract: 'LEARNCON-OS-CS-OS-03' as const, pack: validateCrossRolePack(pack) }
}

export function renderCrossRoleHtml(pack: CrossRolePack): string {
  const cards = pack.templates
    .map(
      (t) => `<section class="card">
  <h2>${escapeHtml(t.id)} <span class="tone">${escapeHtml(t.tone)}</span></h2>
  <p class="meta">${escapeHtml(t.roleFrom)} → ${escapeHtml(t.roleTo)} · ${escapeHtml(t.channel)}</p>
  ${t.subjectTr ? `<p><strong>Konu:</strong> ${escapeHtml(t.subjectTr)}</p>` : ''}
  <pre>${escapeHtml(t.bodyTr)}</pre>
  <pre class="en">${escapeHtml(t.bodyEn)}</pre>
  <p>${escapeHtml(t.notesTr)}</p>
</section>`,
    )
    .join('\n')

  return `<!DOCTYPE html>
<html lang="tr"><head><meta charset="utf-8"/>
<title>${escapeHtml(pack.titleTr)}</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;600;700&display=swap" rel="stylesheet"/>
<style>
body{font-family:"Noto Sans",Arial,sans-serif;margin:0;padding:24px;max-width:820px;color:#111;line-height:1.45}
.card{border:1px solid #ddd;border-radius:8px;padding:14px;margin:12px 0}
.tone{font-size:12px;color:#066;font-weight:600}.meta{color:#555;font-size:13px}
pre{white-space:pre-wrap;background:#f7f7f7;padding:10px;border-radius:6px;font-size:13px}
.en{color:#444}h1{font-size:22px}h2{font-size:15px;margin:0 0 6px}
</style></head><body>
<h1>${escapeHtml(pack.titleTr)}</h1>
<p class="en">${escapeHtml(pack.titleEn)} · CS-OS-03 · invite / share / referral / institution</p>
${cards}
</body></html>`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
