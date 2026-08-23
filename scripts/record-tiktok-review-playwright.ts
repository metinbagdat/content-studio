/**
 * TikTok App Review — real browser recording, manual OAuth pause.
 */
import { chromium } from 'playwright'
import { mkdir } from 'fs/promises'
import path from 'path'

const BASE = process.env.PROD_URL || 'https://studio.egitim.today'
const ADMIN_KEY = process.env.ADMIN_API_KEY || ''
const OUT_DIR = path.join(process.cwd(), 'storage', 'meta-review-recordings')

async function pause(msg: string) {
  console.log('\n⏸  ' + msg + ' → Enter')
  await new Promise<void>((r) => process.stdin.once('data', () => r()))
}

async function main() {
  if (!ADMIN_KEY) {
    console.error('Set ADMIN_API_KEY (prod)')
    process.exit(1)
  }
  await mkdir(OUT_DIR, { recursive: true })

  const browser = await chromium.launch({ headless: false, channel: 'chrome' })
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: { dir: OUT_DIR, size: { width: 1920, height: 1080 } },
  })
  const page = await context.newPage()

  await page.goto(`${BASE}/admin/social`, { waitUntil: 'networkidle' })
  const keyInput = page.locator('input[type="password"]').first()
  if (await keyInput.isVisible().catch(() => false)) await keyInput.fill(ADMIN_KEY)

  await pause('TikTok OAuth bağla (Sandbox hesabı)')
  await pause('Video yükle / inbox akışı')

  const video = page.video()
  await context.close()
  await browser.close()
  if (video) console.log('\n✅', await video.path())
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
