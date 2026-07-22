/**
 * Phase 0: Content discovery scan (sitemap → ingest → pipeline).
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/run-content-discovery.ts
 *   npx tsx --env-file=.env scripts/run-content-discovery.ts --dry-run
 *   npx tsx --env-file=.env scripts/run-content-discovery.ts --slug zamani-zafere-donusturmek
 */

import { runContentDiscovery } from '../lib/discovery/contentDiscovery'
import { prisma } from '../lib/prisma'

const dryRun = process.argv.includes('--dry-run')
const slugArg = process.argv.find((a) => a.startsWith('--slug='))?.split('=')[1]

async function main() {
  if (dryRun) {
    const { fetchBlogSitemap } = await import('../lib/discovery/sitemap')
    const entries = slugArg
      ? [{ slug: slugArg, url: `https://www.egitim.today/blog/${slugArg}` }]
      : await fetchBlogSitemap()
    console.log(`Dry-run: ${entries.length} blog URLs in sitemap`)
    for (const e of entries.slice(0, 10)) {
      console.log(`  ${e.slug}`)
    }
    return
  }

  const result = await runContentDiscovery({
    limit: slugArg ? 1 : 2,
    triggerPipeline: true,
    slugs: slugArg ? [slugArg] : undefined,
  })

  console.log(JSON.stringify(result, null, 2))
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
