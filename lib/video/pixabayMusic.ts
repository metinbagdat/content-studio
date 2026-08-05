import { readdir } from 'fs/promises'
import path from 'path'

function musicLibraryDir(): string {
  return path.join(process.cwd(), 'storage', 'music-library')
}

const MOOD_FOLDERS: Record<string, string> = {
  'marching band anthem, uplifting, orchestral': 'marching',
  'inspiring corporate': 'uplifting',
  'pop, uplifting, motivational': 'uplifting',
  calm: 'calm',
}

function resolveFolder(mood: string): string {
  return MOOD_FOLDERS[mood] || 'uplifting'
}

/** Pick a random local royalty-free track by mood. Returns null if the library is empty —
 * callers already treat null as "continue without music" (best-effort, non-fatal). */
export async function fetchBackgroundMusic(mood = 'inspiring corporate'): Promise<string | null> {
  const folder = path.join(musicLibraryDir(), resolveFolder(mood))
  try {
    const files = (await readdir(folder)).filter((f) => f.toLowerCase().endsWith('.mp3'))
    if (!files.length) return null
    const pick = files[Math.floor(Math.random() * files.length)]
    return path.join(folder, pick)
  } catch {
    return null // folder doesn't exist yet — fine, just means no music for now
  }
}