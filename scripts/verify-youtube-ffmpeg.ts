import { configureFfmpeg } from '../lib/media/ffmpegPaths'
import { execFileSync } from 'child_process'
import { existsSync } from 'fs'
import path from 'path'
import os from 'os'
import { prisma } from '../lib/prisma'
import { getAudioDurationSec } from '../lib/video/audioDuration'

async function main() {
  configureFfmpeg()
  const ffprobe = path.join(
    process.cwd(),
    'node_modules',
    'ffprobe-static',
    'bin',
    os.platform(),
    os.arch() === 'x64' ? 'x64' : os.arch(),
    'ffprobe.exe',
  )
  console.log('ffprobe exists', existsSync(ffprobe), ffprobe)
  console.log(execFileSync(ffprobe, ['-version'], { encoding: 'utf8' }).split('\n')[0])

  const accounts = await prisma.socialMediaAccount.findMany({
    where: { platform: 'YOUTUBE' },
    select: {
      id: true,
      accountName: true,
      accountId: true,
      isActive: true,
      accessToken: true,
      refreshToken: true,
    },
  })
  console.log(
    'accounts',
    accounts.map((a) => ({
      id: a.id.slice(0, 8),
      accountName: a.accountName,
      accountId: a.accountId,
      isActive: a.isActive,
      dryRun: a.accountId.startsWith('dryrun_'),
      hasToken: Boolean(a.accessToken && a.accessToken !== 'dry-run'),
      hasRefresh: Boolean(a.refreshToken),
    })),
  )

  const posts = await prisma.socialMediaPost.findMany({
    where: { platform: 'YOUTUBE' },
    orderBy: { createdAt: 'desc' },
    take: 15,
    select: {
      id: true,
      status: true,
      scheduledAt: true,
      publishedAt: true,
      error: true,
      platformPostId: true,
      mediaUrls: true,
      derivedContentId: true,
    },
  })
  console.log(
    'posts',
    posts.map((p) => ({
      id: p.id,
      status: p.status,
      scheduledAt: p.scheduledAt,
      error: p.error?.slice(0, 160) || null,
      platformPostId: p.platformPostId,
      media: p.mediaUrls.length,
      derived: p.derivedContentId.slice(0, 8),
    })),
  )

  // Smoke: ffprobe on any existing mp4 under storage/videos
  const { readdirSync } = await import('fs')
  const videoDir = path.join(process.cwd(), 'storage', 'videos')
  if (existsSync(videoDir)) {
    const mp4 = readdirSync(videoDir).find((f) => f.endsWith('.mp4'))
    if (mp4) {
      const full = path.join(videoDir, mp4)
      const dur = await getAudioDurationSec(full)
      console.log('ffprobe duration ok', mp4, dur.toFixed(2), 's')
    } else {
      console.log('no mp4 in storage/videos yet')
    }
  } else {
    console.log('storage/videos missing')
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
