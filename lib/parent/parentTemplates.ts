/**
 * CS-PAR-02 — Veli V1 SM + V-E1…E8 HTML templates.
 * Segment tag: veli (CS-SM-01 / #31). Tone: formal, result-focused.
 */

export const PARENT_TEMPLATES_CATEGORY = 'parent-templates' as const
export const PARENT_TEMPLATES_SLUG = 'v1-ve1-e8' as const
export const PARENT_SEGMENT = 'veli' as const

export type ParentToneGuide = {
  voice: 'formal'
  focus: 'results'
  do: string[]
  dont: string[]
  ctaDefault: string
}

export type IgCarouselSlide = {
  index: number
  headline: string
  body: string
}

export type YoutubeScript = {
  title: string
  durationMinutes: { min: number; max: number }
  outline: Array<{ section: string; minutes: string; talkingPoints: string[] }>
  cta: string
}

export type FacebookAdCopy = {
  primaryText: string
  headline: string
  description: string
  cta: string
  audienceHint: string
}

export type VeEmailTemplate = {
  id: `V-E${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}`
  trigger: string
  subject: string
  preheader: string
  html: string
}

export type ParentTemplatesPack = {
  version: 1
  kind: 'parent-templates'
  slug: string
  segment: typeof PARENT_SEGMENT
  toneGuide: ParentToneGuide
  v1: {
    igCarousel: IgCarouselSlide[]
    youtube: YoutubeScript
    facebookAd: FacebookAdCopy
  }
  emails: VeEmailTemplate[]
}

export type ParentTemplatesSourceDraft = {
  title: string
  category: typeof PARENT_TEMPLATES_CATEGORY
  tags: string[]
  content: string
}

export type LearnConParentTemplatesExport = {
  contract: 'LEARNCON-PAR-V1-VE'
  pack: ParentTemplatesPack
}

export const PARENT_TONE_GUIDE: ParentToneGuide = {
  voice: 'formal',
  focus: 'results',
  do: [
    'Somut net / yüzde / süre yazın',
    'Çocuğun emeğini takdir edin; veliye net sonraki adım verin',
    'CTA’yı tek tutun: /veli veya rapor örneği',
    'KVKK / İYS notunu e-postada koruyun',
  ],
  dont: [
    'Argo, emoji bombası, “yak! 🔥” dili',
    'Kardeş/arkadaş kıyası',
    'Suçlayıcı “neden çalışmıyor?” tonu',
    'Öğrenci slang’i (S8 “vay be” dili veliye gitmez)',
  ],
  ctaDefault: 'https://egitim.today/veli?utm_persona=parent',
}

export const V1_IG_CAROUSEL: IgCarouselSlide[] = [
  {
    index: 1,
    headline: 'Çocuğunuzun neti artıyor mu?',
    body: 'Haftalık veli raporu: nerede takıldığını, neyin işe yaradığını tek bakışta görün.',
  },
  {
    index: 2,
    headline: 'Örnek: Ali, 11. sınıf',
    body: '2 haftada TYT Matematik +3 net. Üslü/köklü doğruluk oranı %38 yükseldi.',
  },
  {
    index: 3,
    headline: 'Sadece skor değil',
    body: 'Zayıf konu + konuşma önerisi. “Ne diyeceğim?” belirsizliğini kaldırır.',
  },
  {
    index: 4,
    headline: 'Siz test çözmezsiniz',
    body: 'Analizi çocuk yapar. Siz sonucu ve sonraki adımı görürsünüz.',
  },
  {
    index: 5,
    headline: 'Güvenli ve şeffaf',
    body: 'KVKK uyumlu özet. Deneme süresi + taksit + 14 gün iade seçenekleri net.',
  },
  {
    index: 6,
    headline: 'Örnek raporu inceleyin',
    body: 'CTA: egitim.today/veli — utm_persona=parent',
  },
]

export const V1_YOUTUBE: YoutubeScript = {
  title: 'Veli için haftalık net raporu nasıl okunur? (örnek: Ali)',
  durationMinutes: { min: 5, max: 8 },
  outline: [
    {
      section: 'Açılış',
      minutes: '0:00–0:45',
      talkingPoints: [
        'Veliye hitap: resmi, sonuç odaklı',
        'Bugün: örnek raporda +3 net / %38 ne anlama geliyor',
      ],
    },
    {
      section: 'Raporu okuma',
      minutes: '0:45–3:00',
      talkingPoints: [
        'Net delta vs konu yüzdesi',
        'Üslü/köklü örneği: tekrar düzeni işe yaramış',
        'Grafikte haftalık eğilim',
      ],
    },
    {
      section: 'Konuşma önerisi',
      minutes: '3:00–5:00',
      talkingPoints: [
        'Destekleyici cümle örneği',
        'Kaçınılacaklar: kıyas, suçlama',
      ],
    },
    {
      section: 'Sonraki adım + CTA',
      minutes: '5:00–7:30',
      talkingPoints: [
        'Çocuk analizi çözer; veli sonucu görür',
        'CTA: /veli ve örnek rapor',
      ],
    },
  ],
  cta: 'https://egitim.today/veli/rapor-ornegi?utm_persona=parent&utm_content=yt_v1',
}

export const V1_FACEBOOK_AD: FacebookAdCopy = {
  primaryText:
    '11. sınıf velileri: çocuğunuzun TYT Matematik netindeki değişimi haftalık raporda görün. Örnekte Ali 2 haftada +3 net, zayıf konuda %38 ilerleme. Siz test çözmezsiniz — sonucu ve konuşma önerisini alırsınız.',
  headline: 'Haftalık veli raporu — somut net artışı',
  description: 'Örnek raporu inceleyin. Deneme + taksit seçenekleri.',
  cta: 'Daha fazla bilgi',
  audienceHint: 'Ebeveyn 35–55 · Türkiye · eğitim ilgisi',
}

function emailHtml(opts: {
  greeting: string
  paragraphs: string[]
  ctaLabel: string
  ctaHref: string
}): string {
  const paras = opts.paragraphs.map((p) => `<p style="margin:0 0 12px;line-height:1.5">${escapeHtml(p)}</p>`).join('')
  return `<!DOCTYPE html>
<html lang="tr"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/></head>
<body style="margin:0;padding:24px;font-family:'Noto Sans',Arial,sans-serif;color:#111;background:#fff">
  <div style="max-width:560px;margin:0 auto">
    <p style="margin:0 0 16px;font-size:15px">${escapeHtml(opts.greeting)}</p>
    ${paras}
    <p style="margin:24px 0"><a href="${escapeHtml(opts.ctaHref)}" style="display:inline-block;padding:12px 18px;background:#111;color:#fff;text-decoration:none;border-radius:6px;font-size:14px">${escapeHtml(opts.ctaLabel)}</a></p>
    <p style="margin:24px 0 0;font-size:12px;color:#666">Bu ileti eğitim bilgilendirmesi içindir. İzin verdiğiniz kanaldan gönderilir (KVKK / İYS). 18 yaş altı için veli onayı geçerlidir.</p>
  </div>
</body></html>`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export const VE_EMAIL_TEMPLATES: VeEmailTemplate[] = [
  {
    id: 'V-E1',
    trigger: 'D0',
    subject: 'İşte örnek veli raporu',
    preheader: 'Ali örneğinde +3 net / %38 — çocuğunuz için nasıl görünür?',
    html: emailHtml({
      greeting: 'Sayın Veli,',
      paragraphs: [
        'Örnek raporda Ali’nin (11. sınıf) TYT Matematik neti 2 haftada 8’den 11’e çıktı. Zayıf üslü/köklü konusunda doğruluk oranı %38 arttı.',
        'Raporda grafik, konu kırılımı ve destekleyici konuşma önerisi bir arada.',
      ],
      ctaLabel: 'Örnek raporu açın',
      ctaHref: 'https://egitim.today/veli/rapor-ornegi?utm_persona=parent&utm_content=ve1',
    }),
  },
  {
    id: 'V-E2',
    trigger: 'D1',
    subject: 'Netler neden artmıyor?',
    preheader: 'Çalışıyor ama sonuç yoksa genelde önkoşul boşluğu vardır.',
    html: emailHtml({
      greeting: 'Sayın Veli,',
      paragraphs: [
        'Çocuk düzenli çalışıyor görünür ama net yerinde sayıyorsa, çoğu zaman zayıf konunun önkoşulu eksik kalmıştır.',
        'Örnek raporda “logaritma → üstel/üslü” gibi zincirleri net görürsünüz; konuşmayı suçlamadan yönlendirebilirsiniz.',
      ],
      ctaLabel: 'Önkoşul örneğine bakın',
      ctaHref: 'https://egitim.today/veli/rapor-ornegi?utm_persona=parent&utm_content=ve2',
    }),
  },
  {
    id: 'V-E3',
    trigger: 'D3',
    subject: 'Çocuğunuzun nerede takıldığını görün',
    preheader: 'Konu bazlı özet — hangi 2–3 tipte destek gerekir?',
    html: emailHtml({
      greeting: 'Sayın Veli,',
      paragraphs: [
        'Genel “çalış” uyarısı yerine konu bazlı özet, hangi 2–3 soru tipinde destek gerektiğini gösterir.',
        'Ali örneğinde üslü yükselmiş; sonraki odak denklem tipleri.',
      ],
      ctaLabel: 'Konu kırılımını görün',
      ctaHref: 'https://egitim.today/veli?utm_persona=parent&utm_content=ve3',
    }),
  },
  {
    id: 'V-E4',
    trigger: 'D7',
    subject: 'Haftalık rapor böyle görünecek',
    preheader: 'Pazartesi özeti + deneme süresi seçeneği.',
    html: emailHtml({
      greeting: 'Sayın Veli,',
      paragraphs: [
        'Haftalık veli e-postası net delta, konu yüzdeleri ve tek konuşma önerisi içerir.',
        'Hazırsanız 7 günlük deneme ile kendi çocuğunuzun özetini açabilirsiniz.',
      ],
      ctaLabel: 'Denemeyi inceleyin',
      ctaHref: 'https://egitim.today/veli?utm_persona=parent&utm_content=ve4',
    }),
  },
  {
    id: 'V-E5',
    trigger: 'D14',
    subject: 'Diğer veliler ne görüyor?',
    preheader: 'Sosyal kanıt: somut net değişimi örnekleri.',
    html: emailHtml({
      greeting: 'Sayın Veli,',
      paragraphs: [
        'Veliler en çok “somut rakam” istediği için örnek raporu paylaşıyoruz: +3 net, %38 konu ilerlemesi.',
        'Kendi çocuğunuz için aynı formatı deneme ile deneyebilirsiniz.',
      ],
      ctaLabel: 'Örneği tekrar açın',
      ctaHref: 'https://egitim.today/veli/rapor-ornegi?utm_persona=parent&utm_content=ve5',
    }),
  },
  {
    id: 'V-E6',
    trigger: 'D21',
    subject: 'Plan: ₺99 / 3 taksit',
    preheader: 'Taksit varsayılan; 14 gün iade ile risk azaltıldı.',
    html: emailHtml({
      greeting: 'Sayın Veli,',
      paragraphs: [
        'Ücretlendirme şeffaf: aylık plan ₺99, varsayılan 3 taksit. 14 gün iade seçeneği öğrenci planından daha net vurgulanır.',
        'Ödeme sonrası ilk haftalık rapor bir sonraki Pazartesi özetine düşer.',
      ],
      ctaLabel: 'Planı inceleyin',
      ctaHref: 'https://egitim.today/veli?utm_persona=parent&utm_content=ve6',
    }),
  },
  {
    id: 'V-E7',
    trigger: 'D30',
    subject: '1 aylık gelişim özeti',
    preheader: 'Aylık net ve konu trendi — veli dilinde.',
    html: emailHtml({
      greeting: 'Sayın Veli,',
      paragraphs: [
        'Bir aylık özette net trendi, güçlenen / hâlâ zayıf konular ve tek önerilen konuşma metni yer alır.',
        'PDF indirilebilir özet LearnCon veli panelinden gelir.',
      ],
      ctaLabel: 'Veli paneline gidin',
      ctaHref: 'https://egitim.today/veli?utm_persona=parent&utm_content=ve7',
    }),
  },
  {
    id: 'V-E8',
    trigger: '48s',
    subject: 'Test hâlâ bekliyor',
    preheader: 'Analizi çocuk çözer — hatırlatmayı nazikçe iletin.',
    html: emailHtml({
      greeting: 'Sayın Veli,',
      paragraphs: [
        'Paylaştığınız analiz linki henüz tamamlanmadı. Testi siz çözmezsiniz; çocuğunuzun tamamlaması gerekir.',
        'WhatsApp’tan kısa hatırlatma çoğu zaman yeterlidir. Linki yeniden gönderebilirsiniz.',
      ],
      ctaLabel: 'Linki yeniden gönderin',
      ctaHref: 'https://egitim.today/veli/analiz?utm_persona=parent&utm_content=ve8',
    }),
  },
]

export const PARENT_TEMPLATES_PACK: ParentTemplatesPack = {
  version: 1,
  kind: 'parent-templates',
  slug: PARENT_TEMPLATES_SLUG,
  segment: PARENT_SEGMENT,
  toneGuide: PARENT_TONE_GUIDE,
  v1: {
    igCarousel: V1_IG_CAROUSEL,
    youtube: V1_YOUTUBE,
    facebookAd: V1_FACEBOOK_AD,
  },
  emails: VE_EMAIL_TEMPLATES,
}

export function validateParentTemplatesPack(raw: unknown): ParentTemplatesPack {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('pack nesne olmalı')
  }
  const row = raw as ParentTemplatesPack
  if (row.kind !== 'parent-templates') throw new Error('kind geçersiz')
  if (row.segment !== 'veli') throw new Error('segment veli olmalı')
  if (row.toneGuide?.voice !== 'formal' || row.toneGuide?.focus !== 'results') {
    throw new Error('ton kılavuzu resmi + sonuç odaklı olmalı')
  }
  if (!Array.isArray(row.v1?.igCarousel) || row.v1.igCarousel.length !== 6) {
    throw new Error('IG carousel 6 slayt olmalı')
  }
  const mins = row.v1.youtube?.durationMinutes
  if (!mins || mins.min < 5 || mins.max > 8) {
    throw new Error('YouTube süresi 5–8 dk olmalı')
  }
  if (!row.v1.facebookAd?.primaryText?.trim()) throw new Error('Facebook ad copy gerekli')
  if (!Array.isArray(row.emails) || row.emails.length !== 8) {
    throw new Error('V-E1…E8 tam 8 şablon olmalı')
  }
  const ids = row.emails.map((e) => e.id)
  for (let i = 1; i <= 8; i++) {
    if (!ids.includes(`V-E${i}` as VeEmailTemplate['id'])) {
      throw new Error(`V-E${i} eksik`)
    }
  }
  return row
}

export function buildParentTemplatesSource(
  pack: ParentTemplatesPack = PARENT_TEMPLATES_PACK,
): ParentTemplatesSourceDraft {
  const validated = validateParentTemplatesPack(pack)
  return {
    title: 'Veli şablonları — V1 + V-E1…E8',
    category: PARENT_TEMPLATES_CATEGORY,
    tags: [
      `slug:${validated.slug}`,
      'cs-par-02',
      'parent-templates',
      `segment:${validated.segment}`,
      'veli',
    ],
    content: JSON.stringify(validated, null, 2),
  }
}

export function readParentTemplatesPack(content: string): ParentTemplatesPack {
  let raw: unknown
  try {
    raw = JSON.parse(content)
  } catch {
    throw new Error('parent templates JSON değil')
  }
  return validateParentTemplatesPack(raw)
}

export function toLearnConParentTemplatesExport(
  pack: ParentTemplatesPack = PARENT_TEMPLATES_PACK,
): LearnConParentTemplatesExport {
  return {
    contract: 'LEARNCON-PAR-V1-VE',
    pack: validateParentTemplatesPack(pack),
  }
}
