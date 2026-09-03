/**
 * One-shot: regenerate the 5 podcasts stuck with "Cannot find ffmpeg" and
 * clear their reviewFault flag on success.
 *
 * Run from repo root, ALL in one command line (avoids terminal env drift):
 *
 *   $env:DATABASE_URL="<prod connection string>"; $env:CS_ALLOW_SUPABASE_WORKER="1"; npx tsx scripts/regenerate-podcasts.ts
 *
 * Safe to re-run — generatePodcastAudio(id, {force:true}) always regenerates,
 * and clearReviewFault is a no-op if there's nothing to clear.
 */
import { generatePodcastAudio } from '../lib/media/generatePodcast'
import { clearReviewFault } from '../lib/review/fault'

const IDS = [
  'b82b0456-fe59-4547-b39d-278a60906295',
  '11ec15f0-41f0-485d-9791-ca594aee0ef3',
  '8f557c01-06d0-4f2f-8e72-553964852028',
  '6c5d45b4-d737-44fd-96b8-9dced357ddb1',
  '2ca8a867-317c-407a-bfff-9786614018e7',
]

async function main() {
  if (!process.env.DATABASE_URL || !/postgres/i.test(process.env.DATABASE_URL)) {
    console.error('DATABASE_URL missing or invalid — aborting before touching anything.')
    process.exit(1)
  }
  console.log('Target DB host:', new URL(process.env.DATABASE_URL).host)
  console.log(`Regenerating ${IDS.length} podcast(s)...\n`)

  let ok = 0
  let failed = 0

  for (const id of IDS) {
    try {
      const result = await generatePodcastAudio(id, { force: true })
      await clearReviewFault(id)
      console.log(`✓ ${id} — ${result.durationSec ?? '?'}s, jingles=${result.hasJingles ?? false}`)
      ok += 1
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`✗ ${id} — ${message}`)
      failed += 1
    }
  }

  console.log(`\nDone. ${ok} succeeded, ${failed} failed.`)
  process.exit(failed > 0 ? 1 : 0)
}

main()
