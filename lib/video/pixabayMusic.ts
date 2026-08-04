import { mkdir, writeFile } from 'fs/promises'
import path from 'path'

const PIXABAY_URL = 'https://pixabay.com/api/videos/music/' // NOTE: verify exact endpoint against docs before first real run

export function musicStorageDir(): string {
  return path.join(process.cwd(), 'storage', 'music-cache')
}

/** Fetch a free royalty-free background track from Pixabay, cached locally by mood keyword. */
export async function fetchBackgroundMusic(mood = 'inspiring'): Promise<string | null> {
  const key = process.env.PIXABAY_API_KEY
  if (!key) return null

  try {
    const url = `${PIXABAY_URL}?key=${key}&query=${encodeURIComponent(mood)}&per_page=5`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Pixabay ${res.status}`)
    const data = (await res.json()) as { hits?: Array<{ id: number; url: string }> }
    const track = data.hits?.[0]
    if (!track) return null

    const dir = musicStorageDir()
    await mkdir(dir, { recursive: true })
    const filePath = path.join(dir, `${track.id}.mp3`)

    const audioRes = await fetch(track.url)
    if (!audioRes.ok) throw new Error(`Pixabay track fetch ${audioRes.status}`)
    const buffer = Buffer.from(await audioRes.arrayBuffer())
    await writeFile(filePath, buffer)
    return filePath
  } catch (err) {
    console.warn('[pixabayMusic] failed, continuing without background music', err)
    return null
  }
}