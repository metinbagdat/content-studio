import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import sharp from 'sharp'
import { renderVideo, type VideoScene } from '../lib/video/renderVideo'
import { writeAudioFile, audioDiskPath } from '../lib/media/tts'
import { assembleSpeechVoiceover } from '../lib/media/ttsSegments'
import { fetchBackgroundMusic } from '../lib/video/pixabayMusic'

async function main() {
  const imgPath = path.join(process.cwd(), 'storage', 'images', 'test-scene.png')
  await mkdir(path.dirname(imgPath), { recursive: true })
  await sharp({ create: { width: 1280, height: 720, channels: 3, background: { r: 40, g: 60, b: 120 } } })
    .png()
    .toFile(imgPath)

  const speech = await assembleSpeechVoiceover({
    segments: ['Merhaba, bu bir test cümlesidir.'],
    workKey: 'ffmpeg-test',
    language: 'tr',
    minSegmentSec: 3,
    pauseSec: 0.5,
    outroPadSec: 1,
  })

  const scene: VideoScene = {
    foreground: imgPath,
    backgrounds: [imgPath, imgPath, imgPath],
    durationSec: 5,
  }

  const music = await fetchBackgroundMusic('inspiring corporate')
  console.log('music:', music)
  console.log('voice:', speech.voiceoverPath)

  const buf = await renderVideo({
    scenes: [scene, { ...scene, durationSec: 4 }],
    voiceoverPath: speech.voiceoverPath,
    musicPath: music,
    srtContent: '1\n00:00:00,000 --> 00:00:05,000\nTest\n',
    aspect: '16:9',
  })
  console.log('OK, bytes:', buf.length)
}

main().catch((e) => {
  console.error('FAIL', e)
  process.exit(1)
})
