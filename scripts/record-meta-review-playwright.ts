/**
 * Real Meta App Review screen recording (Playwright video).
 * OAuth step pauses for YOU to click Allow on real facebook.com.
 *
 * Usage:
 *   $env:ADMIN_API_KEY = "prod-key"
 *   npx playwright install chromium
 *   npx tsx scripts/record-meta-review-playwright.ts
 */
import { chromium } from 'playwright'
import { mkdir } from 'fs/promises'
import path from 'path'

const BASE = process.env.PROD_URL || 'https://studio.egitim.today'
const ADMIN_KEY = process.env.ADMIN_API_KEY || ''
const OUT_DIR = path.join(process.cwd(), 'storage', 'meta-review-recordings')

async function pause(msg: string) {
  console.log('\n⏸  ' + msg)
  console.log('   Hazır olunca Enter...')
  await new Promise<void>((resolve) => {
    process.stdin.once('data', () => resolve())
  })
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

  await pause('Yenile / dashboard yüklendi mi?')

  const oauthBtn = page.getByRole('button', { name: /OAuth bağla/i }).first()
  if (await oauthBtn.isVisible().catch(() => false)) {
    await oauthBtn.click()
    await pause('facebook.com OAuth — Egitim.today + Allow → callback sonrası Enter')
  }

  await page.goto(`${BASE}/admin/social`, { waitUntil: 'networkidle' })
  await pause('Tek DRAFT → Yayınla tıkla → Enter')

  await page.goto('https://www.facebook.com/Egitim.today', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  await pause('Post görünüyor mu? Enter bitir')

  const video = page.video()
  await context.close()
  await browser.close()
  if (video) {
    const p = await video.path()
    console.log('\n✅ Video:', p)
    console.log('ffmpeg -i "' + p + '" -c:v libx264 -pix_fmt yuv420p meta-pages-manage-posts.mp4')
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
