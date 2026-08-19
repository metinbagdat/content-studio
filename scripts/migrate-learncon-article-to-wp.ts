/**
 * Copy a live LearnCon /blog article onto blog.egitim.today (canonical SEO hub)
 * and ingest it into Content Studio with wp-link tags.
 *
 * Usage:
 *   npx tsx --env-file=.env --env-file=.env.local scripts/migrate-learncon-article-to-wp.ts
 *   npx tsx --env-file=.env --env-file=.env.local scripts/migrate-learncon-article-to-wp.ts --slug=zamani-zafere-donusturmek
 *
 * Publishes via WP core REST (migration of already-public human copy, not CS autopilot).
 * Pipeline: pass --pipeline to process atomization (uses GROQ; set CS_ALLOW_SUPABASE_WORKER=1 only for a one-shot).
 */
import { fetchEgitimTodayBlog } from '../lib/blog/fetchEgitimToday'
import { markdownToWpHtml } from '../lib/blog/markdownToWpHtml'
import { fetchWpPostBySlug } from '../lib/wordpress/fetchWpPost'
import { sendViaCoreRest } from '../lib/wordpress/publisher'
import { ingestWordpressPublished } from '../lib/wordpress/ingestPublished'
import { processPipeline } from '../lib/pipeline'
import { prisma } from '../lib/prisma'

const slugArg = process.argv.find((a) => a.startsWith('--slug='))
const BLOG_SLUG = slugArg?.slice('--slug='.length) || 'zamani-zafere-donusturmek'
const runPipeline = process.argv.includes('--pipeline')

async function main() {
  const existingWp = await fetchWpPostBySlug(BLOG_SLUG)
  let postId = existingWp?.id
  let link = existingWp?.link
  let title = existingWp?.title
  let contentHtml = existingWp?.contentHtml
  let excerpt = existingWp?.excerpt

  if (!existingWp) {
    console.log(`WP miss — fetching LearnCon /blog/${BLOG_SLUG}`)
    const blog = await fetchEgitimTodayBlog(BLOG_SLUG)
    const html = markdownToWpHtml(blog.contentMarkdown)
    const sent = await sendViaCoreRest(
      {
        title: blog.title,
        content: html,
        excerpt: blog.excerpt,
        post_type: 'article',
      },
      { status: 'publish', slug: BLOG_SLUG },
    )
    if (!sent.success || !sent.wpPostId) {
      throw new Error(sent.errorMessage || 'WP publish failed')
    }
    postId = sent.wpPostId
    const created = await fetchWpPostBySlug(BLOG_SLUG)
    if (!created) throw new Error('Published but REST slug lookup failed')
    link = created.link
    title = created.title
    contentHtml = created.contentHtml
    excerpt = created.excerpt
    console.log('WP published', postId, link)
  } else {
    console.log('WP already live', existingWp.id, existingWp.link)
  }

  const ingest = await ingestWordpressPublished(
    {
      post_id: postId,
      title,
      link,
      content: contentHtml,
      excerpt,
      post_type: 'article',
    },
    { triggerPipeline: runPipeline },
  )
  console.log('ingest', ingest)

  if (runPipeline && ingest.pipelineId) {
    await processPipeline(ingest.pipelineId)
    console.log('pipeline completed', ingest.pipelineId)
  } else if (runPipeline) {
    console.log('no new pipeline (already ingested); skip process')
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
