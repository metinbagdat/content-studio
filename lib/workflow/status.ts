import { prisma } from '../prisma'

export type WorkflowStepId =
  | 'discovery'
  | 'pipeline'
  | 'review'
  | 'media'
  | 'social'
  | 'calendar'

export type StepState = 'done' | 'active' | 'pending' | 'warn'

export type WorkflowStep = {
  id: WorkflowStepId
  label: string
  href: string
  state: StepState
  detail: string
  count?: number
}

export type WorkflowSnapshot = {
  steps: WorkflowStep[]
  nextActions: string[]
  counts: {
    sources: number
    pipelinesCompleted: number
    reviewPending: number
    podcastScripts: number
    podcastMedia: number
    socialDrafts: number
    scheduledPosts: number
    linkedAccounts: number
  }
}

function pickActive(steps: WorkflowStep[]): WorkflowStepId | null {
  const warn = steps.find((s) => s.state === 'warn')
  if (warn) return warn.id
  const active = steps.find((s) => s.state === 'active')
  return active?.id ?? null
}

/** Ops dashboard: where we are in source → publish flow. */
export async function getWorkflowSnapshot(): Promise<WorkflowSnapshot> {
  const [
    sources,
    pipelinesCompleted,
    reviewPending,
    podcastScripts,
    podcastMedia,
    socialDrafts,
    scheduledPosts,
    linkedAccounts,
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
  ])

  const counts = {
    sources,
    pipelinesCompleted,
    reviewPending,
    podcastScripts,
    podcastMedia,
    socialDrafts,
    scheduledPosts,
    linkedAccounts,
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
        linkedAccounts === 0
          ? 'warn'
          : socialDrafts > 0
            ? 'active'
            : reviewPending === 0 && pipelinesCompleted > 0
              ? 'done'
              : 'pending',
      detail:
        linkedAccounts === 0
          ? 'Hesap bağla'
          : `${socialDrafts} taslak · ${linkedAccounts} hesap`,
      count: socialDrafts,
    },
    {
      id: 'calendar',
      label: 'Takvim',
      href: '/admin/calendar',
      state: scheduledPosts > 0 ? 'active' : socialDrafts > 0 ? 'warn' : 'pending',
      detail: scheduledPosts ? `${scheduledPosts} zamanlandı` : 'Dağıtım uygula',
      count: scheduledPosts,
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
  if (linkedAccounts === 0)
    nextActions.push('Sosyal’de LinkedIn/X OAuth veya dry-run bağla — onay sonrası taslak oluşur')
  if (socialDrafts > 0 && scheduledPosts === 0)
    nextActions.push('Takvim’de pipeline seç → Önizle → Takvime uygula')
  if (!nextActions.length) nextActions.push('Akış tamam — yayınlanan postları Takvim’de izle')

  return { steps, nextActions, counts }
}
