/**
 * TikTok app review demo MP4 — end-to-end flow walkthrough for studio.egitim.today
 * Usage: npx tsx scripts/generate-tiktok-demo-video.ts
 */
import ffmpegPath from 'ffmpeg-static'
import ffmpeg from 'fluent-ffmpeg'
import sharp from 'sharp'
import { mkdir, rm, writeFile } from 'fs/promises'
import path from 'path'

if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath)

const W = 1920
const H = 1080
const OUT = path.join(process.cwd(), 'public', 'tiktok-demo-review.mp4')
const WORK = path.join(process.cwd(), 'storage', 'video-work', 'tiktok-demo')

type Slide = {
  title: string
  subtitle: string
  url: string
  step: string
  body: string[]
  accent?: string
}

const SLIDES: Slide[] = [
  {
    step: '1 / 6',
    url: 'https://studio.egitim.today',
    title: 'egitim.today Content Studio',
    subtitle: 'TikTok Integration Demo',
    body: ['Educational content pipeline', 'Login Kit + Content Posting API'],
    accent: '#22c55e',
  },
  {
    step: '2 / 6',
    url: 'https://studio.egitim.today/admin/social',
    title: 'Social Dashboard',
    subtitle: 'Connect TikTok via OAuth',
    body: ['Platform: TikTok', 'Click «OAuth bağla»', 'Login Kit — user.info.basic scope'],
    accent: '#fe2c55',
  },
  {
    step: '3 / 6',
    url: 'https://www.tiktok.com/v2/auth/authorize',
    title: 'TikTok Authorization',
    subtitle: 'User grants permission',
    body: ['Login Kit OAuth flow', 'Scopes: user.info.basic, video.upload', 'Redirect → studio.egitim.today/callback/tiktok'],
    accent: '#fe2c55',
  },
  {
    step: '4 / 6',
    url: 'https://studio.egitim.today/admin/social',
    title: 'Account Connected',
    subtitle: 'TikTok · Bağlı ✓',
    body: ['Approved SHORT_VIDEO_SCRIPT drafts listed', 'Branded MP4 generated in pipeline', 'Admin reviews before publish'],
    accent: '#22c55e',
  },
  {
    step: '5 / 6',
    url: 'https://studio.egitim.today/admin/social',
    title: 'Publish to TikTok',
    subtitle: 'Content Posting API',
    body: ['User clicks «Yayınla» on draft', 'video.upload → TikTok API', 'Encrypted token from OAuth'],
    accent: '#0ea5e9',
  },
  {
    step: '6 / 6',
    url: 'https://studio.egitim.today/admin/social',
    title: 'Video in TikTok Inbox',
    subtitle: 'User confirms in TikTok app',
    body: ['Unaudited app: inbox / draft confirmation', 'Audited app: direct feed (video.publish)', 'Disconnect anytime: «Kes»'],
    accent: '#22c55e',
  },
]

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
}

function slideSvg(slide: Slide): string {
  const accent = slide.accent || '#22c55e'
  const bodyLines = slide.body
    .map(
      (line, i) =>
        `<text x="120" y="${520 + i * 56}" font-family="Segoe UI, Arial, sans-serif" font-size="36" fill="#cbd5e1">${esc(line)}</text>`,
    )
    .join('\n')

  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <!-- browser chrome -->
  <rect x="80" y="80" width="1760" height="920" rx="16" fill="#1e293b" stroke="#334155" stroke-width="2"/>
  <rect x="80" y="80" width="1760" height="64" rx="16" fill="#0f172a"/>
  <circle cx="120" cy="112" r="10" fill="#ef4444"/>
  <circle cx="152" cy="112" r="10" fill="#eab308"/>
  <circle cx="184" cy="112" r="10" fill="#22c55e"/>
  <rect x="240" y="96" width="720" height="32" rx="8" fill="#334155"/>
  <text x="260" y="118" font-family="Consolas, monospace" font-size="20" fill="#94a3b8">${esc(slide.url)}</text>
  <!-- content -->
  <text x="120" y="220" font-family="Segoe UI, Arial, sans-serif" font-size="28" fill="${accent}" font-weight="600">${esc(slide.step)}</text>
  <text x="120" y="300" font-family="Segoe UI, Arial, sans-serif" font-size="64" fill="#f8fafc" font-weight="700">${esc(slide.title)}</text>
  <text x="120" y="380" font-family="Segoe UI, Arial, sans-serif" font-size="40" fill="#94a3b8">${esc(slide.subtitle)}</text>
  ${bodyLines}
  <!-- mock UI card -->
  <rect x="120" y="720" width="1680" height="240" rx="12" fill="#0f172a" stroke="${accent}" stroke-width="2"/>
  <text x="160" y="780" font-family="Segoe UI, Arial, sans-serif" font-size="28" fill="${accent}" font-weight="700">LEARNCONNECT.NET · egitim.today</text>
  <text x="160" y="830" font-family="Segoe UI, Arial, sans-serif" font-size="24" fill="#64748b">Domain: studio.egitim.today · Products: Login Kit, Content Posting API</text>
  <rect x="1400" y="860" width="360" height="72" rx="10" fill="${accent}"/>
  <text x="1480" y="908" font-family="Segoe UI, Arial, sans-serif" font-size="28" fill="#0f172a" font-weight="700">${slide.step.startsWith('3') ? 'Authorize' : slide.step.startsWith('5') ? 'Yayınla' : 'OAuth bağla'}</text>
</svg>`
}

async function renderSlidePng(slide: Slide, outPath: string): Promise<void> {
  const svg = slideSvg(slide)
  await sharp(Buffer.from(svg)).png().toFile(outPath)
}

async function pngToClip(pngPath: string, clipPath: string, durationSec: number): Promise<void> {
  const fps = 25
  const frames = Math.ceil(durationSec * fps)
  const filter =
    `[0:v]scale=${W}:${H},zoompan=z='min(zoom+0.0006,1.04)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${W}x${H}:fps=${fps}[outv]`

  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(pngPath)
      .inputOptions(['-loop', '1', '-t', String(durationSec)])
      .complexFilter(filter, ['outv'])
      .outputOptions(['-r', String(fps), '-pix_fmt', 'yuv420p', '-t', String(durationSec)])
      .output(clipPath)
      .on('end', () => resolve())
      .on('error', reject)
      .run()
  })
}

async function concatClips(clipPaths: string[], outputPath: string): Promise<void> {
  const listPath = path.join(WORK, 'concat.txt')
  const list = clipPaths.map((p) => `file '${p.replace(/\\/g, '/')}'`).join('\n')
  await writeFile(listPath, list, 'utf-8')

  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(listPath)
      .inputOptions(['-f', 'concat', '-safe', '0'])
      .outputOptions(['-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart'])
      .output(outputPath)
      .on('end', () => resolve())
      .on('error', reject)
      .run()
  })
}

async function main() {
  await rm(WORK, { recursive: true, force: true })
  await mkdir(WORK, { recursive: true })
  await mkdir(path.dirname(OUT), { recursive: true })

  const clipPaths: string[] = []
  const secPerSlide = 10

  for (let i = 0; i < SLIDES.length; i++) {
    const pngPath = path.join(WORK, `slide-${i}.png`)
    const clipPath = path.join(WORK, `clip-${i}.mp4`)
    await renderSlidePng(SLIDES[i], pngPath)
    await pngToClip(pngPath, clipPath, secPerSlide)
    clipPaths.push(clipPath)
    console.log(`Slide ${i + 1}/${SLIDES.length} rendered`)
  }

  await concatClips(clipPaths, OUT)
  console.log(`\nDemo video: ${OUT}`)
  console.log(`Duration: ~${SLIDES.length * secPerSlide}s · Upload to TikTok App Review`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
