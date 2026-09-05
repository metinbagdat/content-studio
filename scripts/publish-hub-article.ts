/**
 * Publish a content/hub/{slug} bundle → WordPress drafts + Content Studio pipeline.
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/publish-hub-article.ts --slug=karar-verme-hedef-belirleme-esenlik-dongusu
 *   npx tsx --env-file=.env scripts/publish-hub-article.ts --slug=... --pipeline-only
 *   npx tsx --env-file=.env scripts/publish-hub-article.ts --slug=... --publish   # WP core REST publish (human copy)
 *
 * WP env: WP_BASE_URL, CONNECT_STUDIO_API_KEY (drafts) or WP_USERNAME+WP_APP_PASSWORD (--publish)
 */
import { prisma } from '../lib/prisma'
import { createPipeline, processPipeline } from '../lib/pipeline'
import { llmModeLabel } from '../lib/ai/llmClient'
import { markdownToWpHtml } from '../lib/blog/markdownToWpHtml'
import { withFaqSchemaHtml } from '../lib/seo/faqSchema'
import { hubSlugFromArgv, loadHubBundle } from '../lib/hub/loadHubBundle'
import { ingestWordpressPublished } from '../lib/wordpress/ingestPublished'
import { fetchWpPostBySlug } from '../lib/wordpress/fetchWpPost'
import {
  ensureWpTerms,
  sendDraftToWordPress,
  sendViaCoreRest,
  updateRankMathMeta,
  updateViaCoreRest,
  wordpressConfigured,
} from '../lib/wordpress/publisher'

const pipelineOnly = process.argv.includes('--pipeline-only')
const wpOnly = process.argv.includes('--wp-only')
const doPublish = process.argv.includes('--publish')
const fresh = process.argv.includes('--fresh')

async function main() {
  const slug = hubSlugFromArgv()
  const bundle = await loadHubBundle(slug)
  const { manifest } = bundle

  console.log(`Hub bundle: ${slug}`)
  console.log(`AI: ${llmModeLabel()}`)
  console.log(`Segment: ${manifest.segment} → platforms: ${bundle.platforms.join(', ')}`)

  let wpArticleId: number | undefined
  let wpLink = `https://blog.egitim.today/${slug}/`

  if (!pipelineOnly) {
    if (wordpressConfigured()) {
      const articleHtml = withFaqSchemaHtml(
        markdownToWpHtml(bundle.articleMarkdown),
        manifest.title,
        bundle.articleMarkdown,
      ).html
      const podHtml = markdownToWpHtml(bundle.podcastScriptMarkdown)
      const anthemHtml = markdownToWpHtml(bundle.songLyricsMarkdown)
      const focus = manifest.focusKeyword || 'karar verme'

      let catIds: number[] = []
      let tagIds: number[] = []
      try {
        catIds = await ensureWpTerms('categories', manifest.wpCategories)
        tagIds = await ensureWpTerms('tags', manifest.wpTags)
        console.log('WP terms', { categories: catIds, tags: tagIds })
      } catch (err) {
        console.warn('WP terms skipped:', err instanceof Error ? err.message : err)
      }

      const articlePayload = {
        title: manifest.title,
        content: articleHtml,
        excerpt: manifest.excerpt,
        slug,
        post_type: 'article' as const,
        acf: manifest.hkmt,
        meta: { script: manifest.seoTitle },
      }
      const articleId = manifest.wp?.articleId
      const articleRes = articleId
        ? await updateViaCoreRest(articleId, articlePayload, {
            slug,
            categories: catIds,
            tags: tagIds,
          })
        : await sendDraftToWordPress(articlePayload)
      console.log('WP article:', articleRes)
      const savedArticleId = articleRes.wpPostId || articleId
      if (savedArticleId) {
        const seo = await updateRankMathMeta(savedArticleId, {
          focusKeyword: focus,
          title: manifest.seoTitle,
          description: manifest.excerpt,
        })
        console.log('Rank Math article:', seo)
      }

      const podPayload = {
        title: manifest.podcast.title,
        content: podHtml,
        excerpt: `Podcast bölüm ${manifest.podcast.episodeNumber} · ~${manifest.podcast.durationMinutes} dk`,
        slug: manifest.podcast.slug,
        post_type: 'podcast' as const,
        acf: manifest.hkmt,
        meta: {
          script: bundle.podcastScriptMarkdown,
          podcast_duration: manifest.podcast.durationMinutes,
        },
      }
      const podId = manifest.wp?.podcastId
      const podRes = podId
        ? await updateViaCoreRest(podId, podPayload, { slug: manifest.podcast.slug })
        : await sendDraftToWordPress(podPayload)
      console.log('WP podcast:', podRes)
      const savedPodId = podRes.wpPostId || podId
      if (savedPodId) {
        console.log(
          'Rank Math podcast:',
          await updateRankMathMeta(savedPodId, {
            focusKeyword: 'karar alma sanatı',
            title: `${manifest.podcast.title} | Eğitim.Today Podcast`,
            description: `Karar verme ve hedef belirleme üzerine ${manifest.podcast.durationMinutes} dakikalık bölüm.`,
          }),
        )
      }

      const anthemPayload = {
        title: manifest.anthem.title,
        content: anthemHtml,
        excerpt: 'Motivasyonel marş · karar verme ve hedef belirleme',
        slug: manifest.anthem.slug,
        post_type: 'anthem' as const,
        acf: manifest.hkmt,
        meta: { lyrics: bundle.songLyricsMarkdown },
      }
      const anthemId = manifest.wp?.anthemId
      const anthemRes = anthemId
        ? await updateViaCoreRest(anthemId, anthemPayload, { slug: manifest.anthem.slug })
        : await sendDraftToWordPress(anthemPayload)
      console.log('WP anthem:', anthemRes)
      const savedAnthemId = anthemRes.wpPostId || anthemId
      if (savedAnthemId) {
        console.log(
          'Rank Math anthem:',
          await updateRankMathMeta(savedAnthemId, {
            focusKeyword: 'karar alma sanatı',
            title: `${manifest.anthem.title} | Eğitim.Today`,
            description: 'Karar verme ve hedef belirleme temalı motivasyonel marş.',
          }),
        )
      }
    } else {
      console.warn('WP not configured — skip WP drafts (set WP_BASE_URL + CONNECT_STUDIO_API_KEY)')
    }

    if (doPublish) {
      const existing = await fetchWpPostBySlug(slug)
      if (existing) {
        wpArticleId = existing.id
        wpLink = existing.link
        console.log('WP already published', wpLink)
      } else {
        const html = withFaqSchemaHtml(
          markdownToWpHtml(bundle.articleMarkdown),
          manifest.title,
          bundle.articleMarkdown,
        ).html
        const pub = await sendViaCoreRest(
          {
            title: manifest.title,
            content: html,
            excerpt: manifest.excerpt,
            post_type: 'article',
            acf: manifest.hkmt,
          },
          { status: 'publish', slug },
        )
        if (!pub.success || !pub.wpPostId) throw new Error(pub.errorMessage || 'WP publish failed')
        wpArticleId = pub.wpPostId
        const created = await fetchWpPostBySlug(slug)
        wpLink = created?.link || wpLink
        console.log('WP published', wpArticleId, wpLink)
      }
    }
  }

  if (wpOnly) {
    console.log('WP-only mode — skipping CS pipeline')
    return
  }

  const existing = await prisma.contentSource.findFirst({
    where: { tags: { has: `blog:${slug}` } },
  })

  const source = existing
    ? await prisma.contentSource.update({
        where: { id: existing.id },
        data: {
          title: manifest.title,
          content: bundle.articleMarkdown,
          category: manifest.category,
          tags: bundle.tags,
        },
      })
    : await prisma.contentSource.create({
        data: {
          title: manifest.title,
          content: bundle.articleMarkdown,
          category: manifest.category,
          tags: bundle.tags,
        },
      })

  if (fresh) {
    await prisma.derivedContent.deleteMany({
      where: { sourceId: source.id, status: { in: ['DRAFT', 'IN_REVIEW'] } },
    })
    console.log('--fresh: cleared draft derivatives')
  }

  console.log('ContentSource:', source.id)

  const pipeOpts = manifest.pipeline || {}
  const batchStart = new Date()
  const pipeline = await createPipeline(source.id, {
    platforms: bundle.platforms,
    includeMarchSong: pipeOpts.includeMarchSong ?? true,
    marchStyle: pipeOpts.marchStyle ?? 'motivational',
    musicGenre: pipeOpts.musicGenre ?? 'acoustic-pop',
    podcastDuration: pipeOpts.podcastDurationMinutes ?? manifest.podcast.durationMinutes,
    videoStyle: pipeOpts.videoStyle ?? 'educational',
  })

  await processPipeline(pipeline.id)
  console.log('Pipeline completed:', pipeline.id)

  const derived = await prisma.derivedContent.findMany({
    where: { sourceId: source.id, createdAt: { gte: batchStart } },
    select: { id: true, contentType: true, status: true, metadata: true },
  })
  console.log(`Derivatives: ${derived.length}`)
  for (const d of derived.slice(0, 12)) {
    const platform = (d.metadata as { platform?: string } | null)?.platform
    console.log(`  ${d.contentType} ${platform || '-'} ${d.status}`)
  }
  if (derived.length > 12) console.log(`  ... +${derived.length - 12} more`)

  if (wpArticleId) {
    const ingest = await ingestWordpressPublished(
      {
        post_id: wpArticleId,
        title: manifest.title,
        link: wpLink,
        content: markdownToWpHtml(bundle.articleMarkdown),
        excerpt: manifest.excerpt,
        post_type: 'article',
        meta: { cs_safe_samurai_validated: 'yes' },
      },
      { triggerPipeline: false },
    )
    console.log('WP ingest (idempotent):', ingest.message)
  }

  console.log('\nReview: http://localhost:3100/admin/review')
  console.log('Social: http://localhost:3100/admin/social (after approve + sync-drafts)')
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
