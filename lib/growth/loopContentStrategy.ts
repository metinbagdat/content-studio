/**
 * CS-OS-02 — Loop content strategy.
 * Each loop names the weak link (OS-04) and the content that feeds it.
 */

export const LOOP_STRATEGY_CATEGORY = 'growth-loop-strategy' as const
export const LOOP_STRATEGY_SLUG = 'cs-os-02-loops' as const

export type LoopContentStrategy = {
  loopKey: 'student_viral' | 'teacher_amplification' | 'teacher_to_institution' | 'parent_to_parent'
  labelTr: string
  labelEn: string
  weakLinkTr: string
  weakLinkEn: string
  weakLinkStep: string
  contentPillarTr: string
  contentPillarEn: string
  assetBriefTr: string
  assetBriefEn: string
  ctaHref: string
  channelHints: string[]
}

export type LoopStrategyPack = {
  version: 1
  kind: 'growth-loop-strategy'
  slug: string
  titleTr: string
  titleEn: string
  strategies: LoopContentStrategy[]
}

export const LOOP_STRATEGY_PACK: LoopStrategyPack = {
  version: 1,
  kind: 'growth-loop-strategy',
  slug: LOOP_STRATEGY_SLUG,
  titleTr: 'Döngü içerik stratejisi',
  titleEn: 'Loop content strategy',
  strategies: [
    {
      loopKey: 'student_viral',
      labelTr: 'Öğrenci viral',
      labelEn: 'Student viral',
      weakLinkTr: 'Paylaşım → link tıklama (sonuç kartı yeterince paylaşılabilir değil)',
      weakLinkEn: 'Share → link click (result card not shareable enough)',
      weakLinkStep: 'link',
      contentPillarTr: 'Paylaşılabilir sonuç kartı',
      contentPillarEn: 'Shareable result card',
      assetBriefTr:
        'S8 özet kartı: seviye + 1 “vay be” önkoşul + mastery bar + “sen de analizini yap” CTA. OG görseli TR, utm_content=viral_result.',
      assetBriefEn:
        'S8 summary card: level + one prerequisite insight + mastery bar + “run your analysis” CTA. TR OG, utm_content=viral_result.',
      ctaHref: 'https://egitim.today/analiz?utm_source=share&utm_medium=result_card',
      channelHints: ['WhatsApp', 'Instagram story', '/sonuc/[token]'],
    },
    {
      loopKey: 'teacher_amplification',
      labelTr: 'Öğretmen çarpanı',
      labelEn: 'Teacher amplification',
      weakLinkTr: 'Davet → sınıfa katılım (öğrenci join sürtünmesi)',
      weakLinkEn: 'Invite → class join (student join friction)',
      weakLinkStep: 'joined',
      contentPillarTr: 'Sınıf analizi özeti (paylaşılabilir)',
      contentPillarEn: 'Shareable class analysis summary',
      assetBriefTr:
        'CS-TCH-02 dilinde 1 sayfalık sınıf ısı haritası + “öğrenciler bu linkle katılsın” QR/metin. Meslektaş tonu, ücretsiz vurgu.',
      assetBriefEn:
        'One-pager class heat map (CS-TCH-02 voice) + join link/QR for students. Peer tone, free tool emphasis.',
      ctaHref: 'https://egitim.today/ogretmen?utm_content=class_amplify',
      channelHints: ['WhatsApp sınıf grubu', 'e-okul duyuru', 'LinkedIn kısa'],
    },
    {
      loopKey: 'teacher_to_institution',
      labelTr: 'Öğretmen → kurum',
      labelEn: 'Teacher → institution',
      weakLinkTr: 'Kurum referansı → pilot sözleşme',
      weakLinkEn: 'Institution referral → pilot contract',
      weakLinkStep: 'pilot',
      contentPillarTr: 'Kurum vakası (kanıt PDF özeti)',
      contentPillarEn: 'Institution case (proof PDF summary)',
      assetBriefTr:
        'CS-INST-02’den 1 sayfa: Logaritma %32 → üstel müdahale → +1,2 net. ROI dili, pilot 4 hafta CTA (CS-INST-01).',
      assetBriefEn:
        'One-pager from CS-INST-02: Logarithm 32% → exponential intervention → +1.2 net. ROI voice, 4-week pilot CTA.',
      ctaHref: 'https://egitim.today/kurumlar?utm_content=teacher_case',
      channelHints: ['Öğretmen→müdür e-posta', 'zümre sunumu'],
    },
    {
      loopKey: 'parent_to_parent',
      labelTr: 'Veli → veli',
      labelEn: 'Parent → parent',
      weakLinkTr: 'Referans davet → yeni veli kaydı (içerik yok / utangaç paylaşım)',
      weakLinkEn: 'Referral invite → new parent signup (missing content / shy share)',
      weakLinkStep: 'signup',
      contentPillarTr: 'Veli referans içeriği (örnek rapor kartı)',
      contentPillarEn: 'Parent referral content (sample report card)',
      assetBriefTr:
        'CS-PAR-01 Ali kartı: +3 net / %38 + “başka veliye göster” resmi ton. WhatsApp öncelikli, utm_persona=parent.',
      assetBriefEn:
        'CS-PAR-01 Ali card: +3 net / 38% + “show another parent” formal tone. WhatsApp-first, utm_persona=parent.',
      ctaHref: 'https://egitim.today/veli/rapor-ornegi?utm_persona=parent&utm_content=parent_ref',
      channelHints: ['WhatsApp', 'veli WhatsApp grupları'],
    },
  ],
}

export function validateLoopStrategyPack(raw: unknown): LoopStrategyPack {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('pack nesne olmalı')
  }
  const row = raw as LoopStrategyPack
  if (row.kind !== 'growth-loop-strategy') throw new Error('kind geçersiz')
  if (row.strategies?.length !== 4) throw new Error('4 döngü stratejisi gerekli')
  const keys = row.strategies.map((s) => s.loopKey)
  for (const k of [
    'student_viral',
    'teacher_amplification',
    'teacher_to_institution',
    'parent_to_parent',
  ] as const) {
    if (!keys.includes(k)) throw new Error(`döngü eksik: ${k}`)
  }
  for (const s of row.strategies) {
    if (!s.weakLinkTr || !s.weakLinkEn || !s.assetBriefTr || !s.assetBriefEn) {
      throw new Error(`zayıf halka/brief eksik: ${s.loopKey}`)
    }
  }
  return row
}

export function buildLoopStrategySource(pack: LoopStrategyPack = LOOP_STRATEGY_PACK) {
  const validated = validateLoopStrategyPack(pack)
  return {
    title: validated.titleTr,
    category: LOOP_STRATEGY_CATEGORY,
    tags: [`slug:${validated.slug}`, 'cs-os-02', 'growth-loop-strategy'],
    content: JSON.stringify(validated, null, 2),
  }
}

export function readLoopStrategyPack(content: string): LoopStrategyPack {
  return validateLoopStrategyPack(JSON.parse(content))
}

export function toLearnConLoopStrategyExport(pack: LoopStrategyPack = LOOP_STRATEGY_PACK) {
  return { contract: 'LEARNCON-OS-CS-OS-02' as const, pack: validateLoopStrategyPack(pack) }
}

export function renderLoopStrategyHtml(pack: LoopStrategyPack): string {
  const cards = pack.strategies
    .map(
      (s) => `<section class="card">
  <h2>${escapeHtml(s.labelTr)} <span class="en">/ ${escapeHtml(s.labelEn)}</span></h2>
  <p><strong>Zayıf halka:</strong> ${escapeHtml(s.weakLinkTr)}<br/><span class="en">${escapeHtml(s.weakLinkEn)}</span></p>
  <p><strong>İçerik direği:</strong> ${escapeHtml(s.contentPillarTr)} <span class="en">(${escapeHtml(s.contentPillarEn)})</span></p>
  <p>${escapeHtml(s.assetBriefTr)}<br/><span class="en">${escapeHtml(s.assetBriefEn)}</span></p>
  <p>CTA: <a href="${escapeHtml(s.ctaHref)}">${escapeHtml(s.ctaHref)}</a><br/>Kanallar: ${escapeHtml(s.channelHints.join(' · '))}</p>
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
.en{color:#555;font-size:12px}h1{font-size:22px}h2{font-size:16px;margin:0 0 8px}
</style></head><body>
<h1>${escapeHtml(pack.titleTr)}</h1>
<p class="en">${escapeHtml(pack.titleEn)} · CS-OS-02 · her döngü OS-04 zayıf halkayı besler</p>
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
