/**
 * Meta App Review — Video 2: instagram_content_publish (Instagram publish).
 * Real Playwright screen recording. Separate file from pages_manage_posts video.
 *
 * OAuth: same META_LOGIN_CONFIG_ID_PUBLISH grants both scopes, but this video must
 * show ONLY Instagram usage (publish + instagram.com proof). Do not publish to FB here.
 *
 * Usage:
 *   $env:ADMIN_API_KEY = "prod-key"
 *   npm run meta:record-ig-review
 */
import { chromium } from 'playwright'
import { mkdir } from 'fs/promises'
import path from 'path'

const BASE = process.env.PROD_URL || 'https://studio.egitim.today'
const ADMIN_KEY = process.env.ADMIN_API_KEY || ''
const IG_PROFILE = process.env.META_IG_PROFILE_URL || 'https://www.instagram.com/egitim.today/'
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

  console.log('Video 2 — instagram_content_publish ONLY (no Facebook publish in this recording)')

  const browser = await chromium.launch({ headless: false, channel: 'chrome' })
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: { dir: OUT_DIR, size: { width: 1920, height: 1080 } },
  })
  const page = await context.newPage()

  await page.goto(`${BASE}/admin/social`, { waitUntil: 'networkidle' })
  const keyInput = page.locator('input[type="password"]').first()
  if (await keyInput.isVisible().catch(() => false)) await keyInput.fill(ADMIN_KEY)

  await pause('1/6 Admin key → Yenile. Sadece Instagram kartına odaklan (FB kartını kayda alma).')

  const igCard = page.locator('[data-platform="INSTAGRAM"]')
  const oauthBtn = igCard.getByRole('button', { name: /OAuth bağla/i })
  if (await oauthBtn.isVisible().catch(() => false)) {
    await oauthBtn.click()
    await pause(
      '3/6 facebook.com OAuth (Instagram kartı) — instagram_content_publish + IG Business hesabı. ' +
        'Allow → callback. Zaten FB videosunda OAuth gösterdiysen kısa tutabilirsin.',
    )
  } else {
    await pause('Instagram zaten Bağlı — OAuth atlanıyor (FB videosunda gösterildiyse OK). Enter.')
  }

  await page.goto(`${BASE}/admin/social`, { waitUntil: 'networkidle' })
  await pause(
    '5/6 Instagram DRAFT (görsel URL prod\'da erişilebilir olmalı) → tek Yayınla. FB kartına dokunma.',
  )

  await page.goto(IG_PROFILE, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(4000)
  await pause(`6/6 Yeni post ${IG_PROFILE} profilinde görünüyor mu? Enter bitir.`)

  const video = page.video()
  await context.close()
  await browser.close()
  if (video) {
    const p = await video.path()
    console.log('\n✅ Video 2 (IG):', p)
    console.log('ffmpeg -i "' + p + '" -c:v libx264 -pix_fmt yuv420p meta-instagram-content-publish.mp4')
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
