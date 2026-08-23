/**
 * Meta App Review — Video 1: pages_manage_posts (Facebook Page publish).
 * Real Playwright screen recording. OAuth pauses for YOU on facebook.com.
 *
 * Do NOT submit SVG storyboard (generate-meta-app-review-video.ts).
 *
 * Usage:
 *   $env:ADMIN_API_KEY = "prod-key"
 *   npm run meta:record-fb-review
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

  console.log('Video 1 — pages_manage_posts ONLY (no Instagram publish in this recording)')

  const browser = await chromium.launch({ headless: false, channel: 'chrome' })
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: { dir: OUT_DIR, size: { width: 1920, height: 1080 } },
  })
  const page = await context.newPage()

  await page.goto(`${BASE}/admin/social`, { waitUntil: 'networkidle' })
  const keyInput = page.locator('input[type="password"]').first()
  if (await keyInput.isVisible().catch(() => false)) await keyInput.fill(ADMIN_KEY)

  await pause('1/6 Admin key → Yenile. Sadece Facebook kartına odaklan (IG kartını kayda alma).')

  const fbCard = page.locator('[data-platform="FACEBOOK"]')
  const oauthBtn = fbCard.getByRole('button', { name: /OAuth bağla/i })
  if (await oauthBtn.isVisible().catch(() => false)) {
    await oauthBtn.click()
    await pause(
      '3/6 facebook.com OAuth — Login Config 919581157862599, Page Egitim.today → Allow. ' +
        'Adres çubuğunda facebook.com görünsün.',
    )
  } else {
    await pause('Facebook zaten Bağlı — OAuth atlanıyor. Devam için Enter.')
  }

  await page.goto(`${BASE}/admin/social`, { waitUntil: 'networkidle' })
  await pause('5/6 Facebook DRAFT → tek Yayınla (toplu değil). IG kartına dokunma.')

  await page.goto('https://www.facebook.com/Egitim.today', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  await pause('6/6 Yeni post facebook.com/Egitim.today feed\'de görünüyor mu? Enter bitir.')

  const video = page.video()
  await context.close()
  await browser.close()
  if (video) {
    const p = await video.path()
    console.log('\n✅ Video 1 (FB):', p)
    console.log('ffmpeg -i "' + p + '" -c:v libx264 -pix_fmt yuv420p meta-pages-manage-posts.mp4')
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
