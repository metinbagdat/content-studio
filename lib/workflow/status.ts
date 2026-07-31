import { prisma } from '../prisma'
import { socialPostPublicUrl } from '../social/postUrl'
import { toImagePreviewPath } from '../social/imagePreview'
import { auditSocialAccounts, repairMissingSocialAccounts, type AccountAudit } from '../social/accountAudit'

export type WorkflowStepId =
  | 'discovery'
  | 'pipeline'
  | 'review'
  | 'media'
  | 'social'
  | 'calendar'
  | 'publish'

export type StepState = 'done' | 'active' | 'pending' | 'warn'

export type WorkflowStep = {
  id: WorkflowStepId
  label: string
  href: string
  state: StepState
  detail: string
  count?: number
}

export type PublishedFeedItem = {
  id: string
  platform: string
  platformLabel: string
  publishedAt: string
  publicUrl: string | null
  preview: string
  accountName: string
  isDryRun: boolean
  isMockPost: boolean
  imagePreviewUrl: string | null
}

export type WorkflowSnapshot = {
  steps: WorkflowStep[]
  nextActions: string[]
  publishedFeed: PublishedFeedItem[]
  accountHealth: AccountAudit
  counts: {
    sources: number
    pipelinesCompleted: number
    reviewPending: number
    podcastScripts: number
    podcastMedia: number
    socialDrafts: number
    scheduledPosts: number
    linkedAccounts: number
    publishedPosts: number
    failedPosts: number
  }
}

function pickActive(steps: WorkflowStep[]): WorkflowStepId | null {
  const warn = steps.find((s) => s.state === 'warn')
  if (warn) return warn.id
  const active = steps.find((s) => s.state === 'active')
  return active?.id ?? null
}

/** Ops dashboard: where we are in source → publish flow. */
export async function getWorkflowSnapshot(options: { autoRepairAccounts?: boolean } = {}): Promise<WorkflowSnapshot> {
  let accountHealth = options.autoRepairAccounts
    ? await repairMissingSocialAccounts()
    : await auditSocialAccounts()

  if (accountHealth.missingCount > 0 && !options.autoRepairAccounts) {
    accountHealth = await repairMissingSocialAccounts()
  }

  const [
    sources,
    pipelinesCompleted,
    reviewPending,
    podcastScripts,
    podcastMedia,
    socialDrafts,
    scheduledPosts,
    linkedAccounts,
    publishedPosts,
    failedPosts,
    recentPublished,
  ] = await Promise.all([
    prisma.contentSource.count(),
    prisma.contentPipeline.count({ where: { status: 'COMPLETED' } }),
    prisma.derivedContent.count({ where: { status: 'IN_REVIEW' } }),
    prisma.derivedContent.count({ where: { contentType: 'PODCAST_SCRIPT', status: { in: ['IN_REVIEW', 'APPROVED'] } } }),
    prisma.mediaFile.count({
      where: {
        mediaType: 'AUDIO',
        processingStatus: 'COMPLETED',
        derivedContent: { contentType: 'PODCAST_SCRIPT' },
      },
    }),
    prisma.socialMediaPost.count({ where: { status: 'DRAFT' } }),
    prisma.socialMediaPost.count({ where: { status: 'SCHEDULED' } }),
    prisma.socialMediaAccount.count({
      where: { isActive: true, accountId: { not: { startsWith: 'dryrun_' } } },
    }),
    prisma.socialMediaPost.count({ where: { status: 'PUBLISHED' } }),
    prisma.socialMediaPost.count({ where: { status: 'FAILED' } }),
    prisma.socialMediaPost.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { publishedAt: 'desc' },
      take: 10,
      include: {
        account: { select: { accountName: true, accountId: true, config: true } },
      },
    }),
  ])

  const publishedFeed: PublishedFeedItem[] = recentPublished.map((p) => {
    const cfg =
      p.account.config && typeof p.account.config === 'object'
        ? (p.account.config as Record<string, unknown>)
        : {}
    const isDryRun = Boolean(cfg.dryRun) || p.account.accountId.startsWith('dryrun_')
    const isMockPost = Boolean(p.platformPostId?.startsWith('mock_'))
    const platformLabel =
      p.platform === 'TWITTER' ? 'X' : p.platform === 'LINKEDIN' ? 'LinkedIn' : p.platform
    return {
      id: p.id,
      platform: p.platform,
      platformLabel,
      publishedAt: (p.publishedAt || p.createdAt).toISOString(),
      publicUrl: socialPostPublicUrl(p.platform, p.platformPostId),
      preview: p.postContent.slice(0, 140).replace(/\s+/g, ' ').trim(),
      accountName: p.account.accountName,
      isDryRun,
      isMockPost,
      imagePreviewUrl: toImagePreviewPath(p.mediaUrls?.[0]),
    }
  })

  const counts = {
    sources,
    pipelinesCompleted,
    reviewPending,
    podcastScripts,
    podcastMedia,
    socialDrafts,
    scheduledPosts,
    linkedAccounts,
    publishedPosts,
    failedPosts,
  }

  const steps: WorkflowStep[] = [
    {
      id: 'discovery',
      label: 'Discovery',
      href: '/admin/discovery',
      state: sources > 0 ? 'done' : 'active',
      detail: sources ? `${sources} kaynak` : 'Sitemap tara',
      count: sources,
    },
    {
      id: 'pipeline',
      label: 'Pipeline',
      href: '/admin',
      state:
        sources === 0
          ? 'pending'
          : pipelinesCompleted > 0
            ? 'done'
            : 'active',
      detail: pipelinesCompleted ? `${pipelinesCompleted} tamamlandı` : 'Pipeline başlat',
      count: pipelinesCompleted,
    },
    {
      id: 'review',
      label: 'Onay',
      href: '/admin/review',
      state:
        reviewPending > 0
          ? 'warn'
          : pipelinesCompleted > 0
            ? 'done'
            : sources > 0
              ? 'active'
              : 'pending',
      detail: reviewPending ? `${reviewPending} bekliyor` : 'Onay kuyruğu',
      count: reviewPending,
    },
    {
      id: 'media',
      label: 'Medya',
      href: '/admin/media',
      state:
        podcastScripts > 0 && podcastMedia < podcastScripts
          ? 'warn'
          : podcastMedia > 0
            ? 'done'
            : 'pending',
      detail:
        podcastScripts > 0
          ? `${podcastMedia}/${podcastScripts} podcast MP3`
          : 'Podcast ses (pipeline sonrası)',
      count: podcastMedia,
    },
    {
      id: 'social',
      label: 'Sosyal',
      href: '/admin/social',
      state:
        accountHealth.missingCount > 0
          ? 'warn'
          : accountHealth.brokenCount > 0
            ? 'warn'
            : linkedAccounts === 0 && accountHealth.slots.every((s) => s.status === 'dry_run')
              ? 'warn'
              : socialDrafts > 0
                ? 'active'
                : reviewPending === 0 && pipelinesCompleted > 0
                  ? 'done'
                  : 'pending',
      detail:
        accountHealth.missingCount > 0
          ? 'Hesap eksik'
          : linkedAccounts === 0
            ? `${socialDrafts} taslak · dry-run`
            : `${socialDrafts} taslak · ${linkedAccounts} OAuth`,
      count: socialDrafts,
    },
    {
      id: 'calendar',
      label: 'Takvim',
      href: '/admin/calendar',
      state:
        scheduledPosts > 0
          ? 'active'
          : socialDrafts > 0
            ? 'warn'
            : publishedPosts > 0
              ? 'done'
              : 'pending',
      detail: scheduledPosts ? `${scheduledPosts} zamanlandı` : 'Dağıtım uygula',
      count: scheduledPosts,
    },
    {
      id: 'publish',
      label: 'Yayın',
      href: '/admin/social#published',
      state:
        failedPosts > 0
          ? 'warn'
          : publishedPosts > 0
            ? 'done'
            : scheduledPosts > 0
              ? 'active'
              : 'pending',
      detail: publishedPosts ? `${publishedPosts} yayında` : 'Yayınla',
      count: publishedPosts,
    },
  ]

  const activeId = pickActive(steps)
  if (activeId) {
    const step = steps.find((s) => s.id === activeId)
    if (step && step.state === 'pending') step.state = 'active'
  }

  const nextActions: string[] = []
  if (sources === 0) nextActions.push('Discovery veya Pipeline ile ilk kaynak ekle')
  if (sources > 0 && pipelinesCompleted === 0)
    nextActions.push('Pipeline’da kaynak seç → Start Pipeline (podcast/video script otomatik üretilir)')
  if (reviewPending > 0)
    nextActions.push(`${reviewPending} türev onay bekliyor → Onay ekranında toplu onayla`)
  if (podcastScripts > podcastMedia)
    nextActions.push(`${podcastScripts - podcastMedia} podcast için Medya’da ses üret (veya toplu onayda otomatik)`)
  if (linkedAccounts === 0 && accountHealth.slots.some((s) => s.status === 'dry_run'))
    nextActions.push('Dry-run hesaplar bağlı — gerçek yayın için Sosyal’de OAuth bağla')
  else if (linkedAccounts === 0)
    nextActions.push('Sosyal’de LinkedIn/X OAuth veya dry-run bağla — onay sonrası taslak oluşur')
  if (socialDrafts > 0 && scheduledPosts === 0)
    nextActions.push('Takvim’de pipeline seç → Önizle → Takvime uygula')
  if (accountHealth.missingCount > 0)
    nextActions.push('Sosyal hesap eksik — dry-run otomatik eklendi veya OAuth bağla')
  if (accountHealth.brokenCount > 0)
    nextActions.push('Başarısız post veya süresi dolmuş token — Sosyal’de kontrol et')
  if (failedPosts > 0)
    nextActions.push(`${failedPosts} başarısız yayın — Sosyal’de yeniden dene`)
  if (!nextActions.length && publishedPosts > 0)
    nextActions.push(`${publishedPosts} yayınlandı — akış ağacında linkleri izle`)
  if (!nextActions.length) nextActions.push('Akış tamam — yayınlanan postları Takvim’de izle')

  return { steps, nextActions, publishedFeed, accountHealth, counts }
}
