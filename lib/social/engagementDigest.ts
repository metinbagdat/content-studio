import type { SocialPlatform } from '@prisma/client'
import { prisma } from '../prisma'
import { socialPostPublicUrl } from './postUrl'
import { getValidAccessToken } from './tokenRefresh'
import { readPostAnalytics, syncAllPublishedPostAnalytics } from './platformStats'

export type DigestComment = {
  text: string
  author?: string | null
  createdAt?: string | null
  source: 'linkedin' | 'twitter' | 'stored'
}

export type DigestSuggestion = {
  kind: 'content' | 'format' | 'timing' | 'platform' | 'cta'
  text: string
}

export type DigestPost = {
  id: string
  platform: SocialPlatform
  preview: string
  publishedAt: string | null
  publicUrl: string | null
  comments: number
  likes: number | null
  shares: number | null
  impressions: number | null
  engagement: number
  commentSamples: DigestComment[]
  commentFetchNote: string | null
  suggestions: DigestSuggestion[]
}

export type DigestTheme = {
  id: string
  label: string
  signal: string
  evidenceCount: number
  changeHint: string
}

/** Single consolidated brief for the admin «Yorumlar» section — read-only. */
export type DigestTopicSummary = {
  title: string
  headline: string
  body: string
  stats: {
    postsScanned: number
    withComments: number
    totalComments: number
    totalEngagement: number
    topPlatform: string | null
  }
  themes: DigestTheme[]
  changeChecklist: string[]
  sampleQuotes: string[]
}

export type EngagementDigest = {
  mode: 'read_only'
  note: string
  synced: number
  syncErrors: string[]
  posts: DigestPost[]
  globalSuggestions: DigestSuggestion[]
  /** Konsolide özet konusu — admin Yorumlar bölümünün ana çıktısı */
  topic: DigestTopicSummary
  fetchedAt: string
}

const THEME_RULES: Array<{
  id: string
  label: string
  pattern: RegExp
  changeHint: string
}> = [
  {
    id: 'timing_ask',
    label: 'Zamanlama / ne zaman',
    pattern: /ne zaman|hangi gün|tarih|deadline|son başvuru|kayıt/,
    changeHint: 'Takvim veya “bu hafta şunu yap” checklist’i ekle.',
  },
  {
    id: 'how_to',
    label: 'Nasıl yapılır',
    pattern: /nasıl|adım|rehber|anlatır mısın|öğretir/,
    changeHint: 'Adım adım rehber veya kısa video/script üret.',
  },
  {
    id: 'source_ask',
    label: 'Kaynak / link talebi',
    pattern: /link|kaynak|nereden|pdf|belge|site/,
    changeHint: 'Caption’da tek güvenilir kaynak + egitim.today derin linki koy.',
  },
  {
    id: 'advice',
    label: 'Öneri / tavsiye',
    pattern: /öner|tavsiye|ne yapmalı|hangisi daha|seçim/,
    changeHint: 'Karşılaştırmalı “A vs B” formatı veya net öneri cümlesi yaz.',
  },
  {
    id: 'list_format',
    label: 'Özet / liste talebi',
    pattern: /kısa|özet|liste|checklist|madde|carousel/,
    changeHint: '5 maddelik carousel veya checklist caption dene.',
  },
  {
    id: 'exam_career',
    label: 'Sınav / meslek',
    pattern: /sınav|yks|ales|kpss|meslek|kariyer|üniversite|bölüm/,
    changeHint: 'Sınav/meslek etiketini güçlendir; hedef kitleyi caption başında netleştir.',
  },
  {
    id: 'parent_student',
    label: 'Veli / öğrenci',
    pattern: /veli|öğrenci|çocuğ|lise|okul/,
    changeHint: 'Aynı temayı veli ve öğrenci açılarıyla iki ayrı postta üret.',
  },
]

function buildTopicSummary(
  posts: DigestPost[],
  globalSuggestions: DigestSuggestion[],
): DigestTopicSummary {
  const withComments = posts.filter((p) => p.comments > 0)
  const totalComments = posts.reduce((s, p) => s + p.comments, 0)
  const totalEngagement = posts.reduce((s, p) => s + p.engagement, 0)

  const byPlat = new Map<string, number>()
  for (const p of posts) {
    byPlat.set(p.platform, (byPlat.get(p.platform) || 0) + p.comments)
  }
  const topPlatform =
    [...byPlat.entries()].sort((a, b) => b[1] - a[1]).find(([, n]) => n > 0)?.[0] ?? null

  const corpus = [
    ...posts.flatMap((p) => p.commentSamples.map((c) => c.text)),
    ...posts.map((p) => p.preview),
  ]
    .join('\n')
    .toLowerCase()

  const themes: DigestTheme[] = []
  for (const rule of THEME_RULES) {
    const hits = corpus.match(new RegExp(rule.pattern.source, 'gi'))
    const evidenceCount = hits?.length ?? 0
    if (evidenceCount > 0) {
      themes.push({
        id: rule.id,
        label: rule.label,
        signal: `${evidenceCount} eşleşme`,
        evidenceCount,
        changeHint: rule.changeHint,
      })
    }
  }
  themes.sort((a, b) => b.evidenceCount - a.evidenceCount)

  // Heuristic themes from metrics when comment text is sparse
  if (!themes.length && withComments.length >= 2) {
    themes.push({
      id: 'comment_volume',
      label: 'Yorum yoğun gönderiler',
      signal: `${withComments.length} post`,
      evidenceCount: withComments.length,
      changeHint: 'En çok yorum alan 2–3 konuyu seri haline getir; CTA’yı soru ile kapat.',
    })
  }
  if (posts.some((p) => p.comments === 0 && (p.likes ?? 0) >= 5)) {
    themes.push({
      id: 'likes_no_replies',
      label: 'Beğeni var, yorum yok',
      signal: 'CTA zayıf',
      evidenceCount: 1,
      changeHint: 'Caption sonuna tek net soru ekle (“sizin deneyiminiz?”).',
    })
  }

  const sampleQuotes = posts
    .flatMap((p) => p.commentSamples.map((c) => c.text.trim()))
    .filter(Boolean)
    .slice(0, 6)

  const changeChecklist = [
    ...themes.slice(0, 4).map((t) => t.changeHint),
    ...globalSuggestions.slice(0, 3).map((s) => s.text),
    ...posts.flatMap((p) => p.suggestions.map((s) => s.text)).slice(0, 4),
  ]
    .filter((t, i, arr) => arr.indexOf(t) === i)
    .slice(0, 6)

  const weekLabel = new Date().toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const title =
    themes[0] != null
      ? `Özet konusu: ${themes[0].label}`
      : withComments.length
        ? 'Özet konusu: Yorum sinyali (metin sınırlı)'
        : 'Özet konusu: Henüz yorum sinyali yok'

  const headline =
    totalComments > 0
      ? `${totalComments} yorum · ${withComments.length} gönderi · ${topPlatform || 'çoklu platform'}`
      : 'Yorum metrikli gönderi yok — yayın + metrik senkronu sonrası dolacak'

  const bodyParts: string[] = []
  bodyParts.push(
    `Bu derleme salt okumadır (DM/yanıt yok). ${weekLabel} itibarıyla ${posts.length} etkileşimli yayın tarandı.`,
  )
  if (themes.length) {
    bodyParts.push(
      `Öne çıkan temalar: ${themes
        .slice(0, 3)
        .map((t) => t.label)
        .join(', ')}. Bunları Onay kuyruğundaki yeni caption’lara taşı.`,
    )
  } else if (withComments.length) {
    bodyParts.push(
      'Yorum sayısı var ama API metin izni sınırlı — aşağıdaki gönderi listesi ve kontrol listesiyle içerik değişikliğini planla.',
    )
  } else {
    bodyParts.push(
      'Sistematik kontrol: «Derlemeyi yenile» → metrik senkron → yorumlu postlar buraya düşer. Caption sonuna soru ekleyerek sinyali artır.',
    )
  }
  if (topPlatform) {
    bodyParts.push(`Yorum yoğunluğu en yüksek platform: ${topPlatform}.`)
  }

  return {
    title,
    headline,
    body: bodyParts.join(' '),
    stats: {
      postsScanned: posts.length,
      withComments: withComments.length,
      totalComments,
      totalEngagement,
      topPlatform,
    },
    themes: themes.slice(0, 6),
    changeChecklist,
    sampleQuotes,
  }
}

function snippet(text: string, n = 100): string {
  const t = text.replace(/\s+/g, ' ').trim()
  return t.length > n ? `${t.slice(0, n)}…` : t
}

function suggestionsForPost(input: {
  platform: string
  preview: string
  comments: number
  likes: number | null
  shares: number | null
  impressions: number | null
  engagement: number
  commentSamples: DigestComment[]
}): DigestSuggestion[] {
  const out: DigestSuggestion[] = []
  const likes = input.likes ?? 0
  const comments = input.comments
  const impressions = input.impressions ?? 0

  if (comments >= 3) {
    out.push({
      kind: 'content',
      text: 'Yorum yoğun — bu konuyu seri / follow-up caption yap; soru formatını koru.',
    })
  }
  if (comments === 0 && likes >= 5) {
    out.push({
      kind: 'cta',
      text: 'Beğeni var, yorum yok — sonda tek net soru veya “sizin deneyiminiz?” ekle.',
    })
  }
  if (impressions > 0 && input.engagement / impressions < 0.01 && impressions >= 200) {
    out.push({
      kind: 'format',
      text: 'Gösterim yüksek, etkileşim düşük — daha kısa giriş + daha güçlü görsel/CTA dene.',
    })
  }
  if (impressions > 0 && impressions < 80 && input.engagement > 0) {
    out.push({
      kind: 'timing',
      text: 'Etkileşim var ama erişim düşük — aynı içeriği farklı saatte / platformda tekrar dene.',
    })
  }
  if (input.platform === 'LINKEDIN' && comments >= 1) {
    out.push({
      kind: 'platform',
      text: 'LinkedIn yorumu geliyor — bir sonraki postta meslek/sınav hedefi etiketini güçlendir.',
    })
  }
  if (input.platform === 'TWITTER' && comments >= 2) {
    out.push({
      kind: 'format',
      text: 'X’te yanıt var — thread’in ilk tweet’ini daha keskin yap; devamı yanıtlayanlara hitap etsin.',
    })
  }

  const sampleText = input.commentSamples.map((c) => c.text.toLowerCase()).join(' ')
  if (/ne zaman|hangi|nasıl|öner|tavsiye|link|kaynak/.test(sampleText)) {
    out.push({
      kind: 'content',
      text: 'Yorumlarda soru / kaynak talebi var — bir sonraki içerikte net kaynak veya “rehber” parçası ekle.',
    })
  }
  if (/kısa|özet|pdf|checklist|liste/.test(sampleText)) {
    out.push({
      kind: 'format',
      text: 'Özet/liste talebi görülüyor — checklist veya 5 maddelik carousel dene.',
    })
  }

  if (!out.length && input.engagement > 0) {
    out.push({
      kind: 'content',
      text: 'Orta düzey etkileşim — aynı temayı farklı açıdan (veli / öğrenci) yeniden üret.',
    })
  }
  return out.slice(0, 3)
}

async function fetchLinkedInCommentSamples(
  shareUrn: string,
  accessToken: string,
): Promise<{ samples: DigestComment[]; note: string | null }> {
  const encoded = encodeURIComponent(shareUrn)
  const url = `https://api.linkedin.com/rest/socialActions/${encoded}/comments?count=8`
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Linkedin-Version': '202405',
      'X-Restli-Protocol-Version': '2.0.0',
    },
  })
  if (res.status === 404) return { samples: [], note: 'Bu gönderide LinkedIn yorumu yok (veya henüz indekslenmedi).' }
  if (!res.ok) {
    const body = await res.text()
    if (/403|401|ACCESS|permission|scope/i.test(body) || res.status === 403 || res.status === 401) {
      return {
        samples: [],
        note: 'Yorum metni için LinkedIn Community Management / r_member_social gerekir — şimdilik yalnızca sayı gösteriliyor.',
      }
    }
    return { samples: [], note: `LinkedIn yorum API ${res.status}` }
  }
  const json = (await res.json()) as {
    elements?: Array<{
      message?: { text?: string }
      actor?: string
      created?: { time?: number }
    }>
  }
  const samples: DigestComment[] = (json.elements || [])
    .map((el) => ({
      text: (el.message?.text || '').trim(),
      author: el.actor || null,
      createdAt: el.created?.time ? new Date(el.created.time).toISOString() : null,
      source: 'linkedin' as const,
    }))
    .filter((c) => c.text)
  return {
    samples,
    note: samples.length ? null : 'API boş döndü — yorum sayısı metrikte olabilir, metin alınamadı.',
  }
}

async function fetchTwitterReplySamples(
  tweetId: string,
  accessToken: string,
): Promise<{ samples: DigestComment[]; note: string | null }> {
  const q = encodeURIComponent(`conversation_id:${tweetId} -is:retweet`)
  const url = `https://api.twitter.com/2/tweets/search/recent?query=${q}&max_results=10&tweet.fields=created_at,author_id,text`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!res.ok) {
    const body = await res.text()
    if (res.status === 402 || /payment|tier|403|401/i.test(body)) {
      return {
        samples: [],
        note: 'X yanıt metni için Search API / ücretli tier gerekir — şimdilik yalnızca reply_count.',
      }
    }
    return { samples: [], note: `X yanıt API ${res.status}` }
  }
  const json = (await res.json()) as {
    data?: Array<{ text?: string; author_id?: string; created_at?: string }>
  }
  const samples: DigestComment[] = (json.data || [])
    .map((t) => ({
      text: (t.text || '').trim(),
      author: t.author_id || null,
      createdAt: t.created_at || null,
      source: 'twitter' as const,
    }))
    .filter((c) => c.text && !c.text.startsWith('RT '))
  return {
    samples,
    note: samples.length ? null : 'Yanıt metni bulunamadı (sayı metrikte olabilir).',
  }
}

/** Read-only engagement + comment digest — never posts replies or DMs. */
export async function buildEngagementDigest(options: {
  limit?: number
  syncFirst?: boolean
  fetchCommentText?: boolean
} = {}): Promise<EngagementDigest> {
  const limit = Math.min(40, Math.max(5, options.limit ?? 20))
  const syncErrors: string[] = []
  let synced = 0

  if (options.syncFirst !== false) {
    try {
      const r = await syncAllPublishedPostAnalytics(Math.min(40, limit + 10))
      synced = r.synced
      syncErrors.push(...r.errors.slice(0, 8))
    } catch (err) {
      syncErrors.push(err instanceof Error ? err.message : String(err))
    }
  }

  const rows = await prisma.socialMediaPost.findMany({
    where: {
      status: 'PUBLISHED',
      platform: { in: ['TWITTER', 'LINKEDIN', 'FACEBOOK', 'INSTAGRAM'] },
      NOT: { platformPostId: { startsWith: 'mock_' } },
    },
    orderBy: { publishedAt: 'desc' },
    take: 80,
    include: { account: true },
  })

  const scored = rows
    .map((p) => {
      const a = readPostAnalytics(p.metrics)
      const comments = a?.comments ?? 0
      const engagement = a?.engagement ?? (a?.likes ?? 0) + comments + (a?.shares ?? 0)
      return { post: p, analytics: a, comments, engagement }
    })
    .filter((x) => x.comments > 0 || x.engagement > 0)
    .sort((a, b) => b.comments - a.comments || b.engagement - a.engagement)
    .slice(0, limit)

  const posts: DigestPost[] = []
  const fetchText = options.fetchCommentText !== false

  for (const { post, analytics, comments, engagement } of scored) {
    let commentSamples: DigestComment[] = []
    let commentFetchNote: string | null = null

    if (fetchText && comments > 0 && post.platformPostId && !post.account.accountId.startsWith('dryrun_')) {
      try {
        const token = await getValidAccessToken(post.account)
        if (post.platform === 'LINKEDIN') {
          const urn = post.platformPostId.startsWith('urn:')
            ? post.platformPostId
            : `urn:li:share:${post.platformPostId}`
          const r = await fetchLinkedInCommentSamples(urn, token)
          commentSamples = r.samples
          commentFetchNote = r.note
        } else if (post.platform === 'TWITTER') {
          const r = await fetchTwitterReplySamples(post.platformPostId, token)
          commentSamples = r.samples
          commentFetchNote = r.note
        } else if (post.platform === 'FACEBOOK' || post.platform === 'INSTAGRAM') {
          commentFetchNote =
            'Meta yorum metni App Review (pages_read_engagement / user content) sonrası; şimdilik sayı + gönderi özeti.'
        }
      } catch (err) {
        commentFetchNote = err instanceof Error ? err.message.slice(0, 120) : 'yorum çekilemedi'
      }
    } else if (comments === 0) {
      commentFetchNote = null
    }

    const preview = snippet(post.postContent, 120)
    const suggestions = suggestionsForPost({
      platform: post.platform,
      preview,
      comments,
      likes: analytics?.likes ?? null,
      shares: analytics?.shares ?? null,
      impressions: analytics?.impressions ?? null,
      engagement,
      commentSamples,
    })

    posts.push({
      id: post.id,
      platform: post.platform,
      preview,
      publishedAt: (post.publishedAt || post.createdAt).toISOString(),
      publicUrl: socialPostPublicUrl(post.platform, post.platformPostId),
      comments,
      likes: analytics?.likes ?? null,
      shares: analytics?.shares ?? null,
      impressions: analytics?.impressions ?? null,
      engagement,
      commentSamples,
      commentFetchNote,
      suggestions,
    })
  }

  const globalSuggestions: DigestSuggestion[] = []
  const byPlat = new Map<string, { comments: number; engagement: number; n: number }>()
  for (const p of posts) {
    const cur = byPlat.get(p.platform) || { comments: 0, engagement: 0, n: 0 }
    cur.comments += p.comments
    cur.engagement += p.engagement
    cur.n += 1
    byPlat.set(p.platform, cur)
  }
  const ranked = [...byPlat.entries()].sort((a, b) => b[1].comments - a[1].comments)
  if (ranked[0] && ranked[0][1].comments > 0) {
    globalSuggestions.push({
      kind: 'platform',
      text: `En çok yorum: ${ranked[0][0]} — bir sonraki üretim turunda bu platforma daha fazla caption ayır.`,
    })
  }
  const withComments = posts.filter((p) => p.comments > 0).length
  if (withComments === 0) {
    globalSuggestions.push({
      kind: 'cta',
      text: 'Henüz yorum metrikli post yok — yayın sonrası «İstatistikleri yenile»; caption sonuna soru ekle.',
    })
  } else {
    globalSuggestions.push({
      kind: 'content',
      text: 'DM/yanıt otomatik yapılmaz. Yorumlardan çıkan temaları Onay kuyruğundaki yeni caption’lara taşı.',
    })
  }

  const topic = buildTopicSummary(posts, globalSuggestions)

  return {
    mode: 'read_only',
    note: 'Salt okuma: DM ve yorum yanıtı gönderilmez. Metin API izni yoksa yalnızca sayı + gönderi özeti + öneri gelir.',
    synced,
    syncErrors,
    posts,
    globalSuggestions,
    topic,
    fetchedAt: new Date().toISOString(),
  }
}
