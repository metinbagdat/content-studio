/**
 * Meta App Review screencast (pages_manage_posts) — 1920x1080 walkthrough.
 * Usage: npx tsx scripts/generate-meta-app-review-video.ts
 */
import ffmpegPath from 'ffmpeg-static'
import ffmpeg from 'fluent-ffmpeg'
import sharp from 'sharp'
import { mkdir, rm, writeFile } from 'fs/promises'
import path from 'path'

if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath)

const W = 1920
const H = 1080
const OUT = path.join(process.cwd(), 'public', 'meta-app-review-pages-manage-posts.mp4')
const WORK = path.join(process.cwd(), 'storage', 'video-work', 'meta-app-review')

type Slide = {
  title: string
  subtitle: string
  url: string
  step: string
  body: string[]
  cta: string
  accent?: string
}

const SLIDES: Slide[] = [
  {
    step: '1 / 6',
    url: 'https://studio.egitim.today/admin/social',
    title: 'Content Studio admin',
    subtitle: 'egitim.today · Facebook Page publishing',
    body: [
      'Open /admin/social',
      'Enter production ADMIN_API_KEY',
      'Click Yenile — dashboard loads',
    ],
    cta: 'Yenile',
    accent: '#2563eb',
  },
  {
    step: '2 / 6',
    url: 'https://studio.egitim.today/admin/social',
    title: 'Facebook card',
    subtitle: 'Page: Egitim.today · 1153725161168373',
    body: ['Click Kes if token is stale', 'Then OAuth bağla', 'Login Config 919581157862599'],
    cta: 'OAuth bağla',
    accent: '#1877f2',
  },
  {
    step: '3 / 6',
    url: 'https://www.facebook.com/v21.0/dialog/oauth',
    title: 'Facebook Login for Business',
    subtitle: 'Grant pages_manage_posts',
    body: [
      'User: Metin Bağdat (Administrator)',
      'Permission: create/edit/delete Page posts',
      'Select Page Egitim.today → Allow',
    ],
    cta: 'Allow',
    accent: '#1877f2',
  },
  {
    step: '4 / 6',
    url: 'https://studio.egitim.today/admin/social',
    title: 'Connected',
    subtitle: 'Facebook · Bağlı ✓',
    body: ['Token includes pages_manage_posts', 'Ready drafts listed under Facebook', 'Admin reviews before publish'],
    cta: 'Bağlı',
    accent: '#16a34a',
  },
  {
    step: '5 / 6',
    url: 'https://studio.egitim.today/admin/social',
    title: 'Publish a Page post',
    subtitle: 'Explicit click → Pages API',
    body: [
      'Click Yayınla on a DRAFT',
      'POST /{page-id}/feed (text + optional image)',
      'Status becomes PUBLISHED',
    ],
    cta: 'Yayınla',
    accent: '#0ea5e9',
  },
  {
    step: '6 / 6',
    url: 'https://www.facebook.com/Egitim.today',
    title: 'Post on the Page',
    subtitle: 'Visible on Egitim.today feed',
    body: [
      'Only Pages the admin manages',
      'No ads, messaging, or comment scrape',
      'Disconnect anytime: Kes',
    ],
    cta: 'Done',
    accent: '#16a34a',
  },
]

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
}

function slideSvg(slide: Slide): string {
  const accent = slide.accent || '#1877f2'
  const bodyLines = slide.body
    .map(
      (line, i) =>
        `<text x="120" y="${500 + i * 52}" font-family="Segoe UI, Arial, sans-serif" font-size="34" fill="#cbd5e1">${esc(line)}</text>`,
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
  <rect x="80" y="80" width="1760" height="920" rx="16" fill="#1e293b" stroke="#334155" stroke-width="2"/>
  <rect x="80" y="80" width="1760" height="64" rx="16" fill="#0f172a"/>
  <circle cx="120" cy="112" r="10" fill="#ef4444"/>
  <circle cx="152" cy="112" r="10" fill="#eab308"/>
  <circle cx="184" cy="112" r="10" fill="#22c55e"/>
  <rect x="240" y="96" width="980" height="32" rx="8" fill="#334155"/>
  <text x="260" y="118" font-family="Consolas, monospace" font-size="18" fill="#94a3b8">${esc(slide.url)}</text>
  <text x="120" y="210" font-family="Segoe UI, Arial, sans-serif" font-size="26" fill="${accent}" font-weight="600">${esc(slide.step)}</text>
  <text x="120" y="290" font-family="Segoe UI, Arial, sans-serif" font-size="56" fill="#f8fafc" font-weight="700">${esc(slide.title)}</text>
  <text x="120" y="360" font-family="Segoe UI, Arial, sans-serif" font-size="34" fill="#94a3b8">${esc(slide.subtitle)}</text>
  ${bodyLines}
  <rect x="120" y="720" width="1680" height="220" rx="12" fill="#0f172a" stroke="${accent}" stroke-width="2"/>
  <text x="160" y="780" font-family="Segoe UI, Arial, sans-serif" font-size="26" fill="${accent}" font-weight="700">pages_manage_posts · Egitim.today Page</text>
  <text x="160" y="828" font-family="Segoe UI, Arial, sans-serif" font-size="22" fill="#64748b">studio.egitim.today · Facebook Login for Business · Config 919581157862599</text>
  <rect x="1360" y="850" width="400" height="64" rx="10" fill="${accent}"/>
  <text x="1480" y="892" font-family="Segoe UI, Arial, sans-serif" font-size="26" fill="#ffffff" font-weight="700">${esc(slide.cta)}</text>
</svg>`
}

async function renderSlidePng(slide: Slide, outPath: string): Promise<void> {
  await sharp(Buffer.from(slideSvg(slide))).png().toFile(outPath)
}

function pngToClip(pngPath: string, clipPath: string, durationSec: number): Promise<void> {
  const fps = 25
  const frames = Math.ceil(durationSec * fps)
  const filter = `[0:v]scale=${W}:${H},zoompan=z='min(zoom+0.0006,1.04)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${W}x${H}:fps=${fps}[outv]`
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
  await writeFile(listPath, clipPaths.map((p) => `file '${p.replace(/\\/g, '/')}'`).join('\n'), 'utf-8')
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
  const secPerSlide = 8
  for (let i = 0; i < SLIDES.length; i++) {
    const pngPath = path.join(WORK, `slide-${i}.png`)
    const clipPath = path.join(WORK, `clip-${i}.mp4`)
    await renderSlidePng(SLIDES[i], pngPath)
    await pngToClip(pngPath, clipPath, secPerSlide)
    clipPaths.push(clipPath)
    console.log(`Slide ${i + 1}/${SLIDES.length}`)
  }
  await concatClips(clipPaths, OUT)
  console.log(`\nScreencast: ${OUT}`)
  console.log(`Duration ~${SLIDES.length * secPerSlide}s — upload on Reviewer instructions step`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
