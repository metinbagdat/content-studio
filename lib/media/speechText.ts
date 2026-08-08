import { ttsPronunciation } from './pronunciation'
import { isNonSpeakableVideoText } from './videoScriptSchema'
import { isMusicCue } from './podcastText'

/** Final gate before TTS — strips URLs, JSON artifacts, music cues. */
export function sanitizeSpeechText(text: string, language: 'tr' | 'en' = 'tr'): string {
  let t = text.trim()
  if (!t || isNonSpeakableVideoText(t) || isMusicCue(t)) return ''

  t = t
    .replace(/^"(?:hook|narration|voice|callToAction|cta|welcome|script)"\s*:\s*"?/i, '')
    .replace(/"?\s*,?\s*$/, '')
    .replace(/\\n/g, ' ')
    .replace(/\\"/g, '"')
    .trim()

  if (!t || isNonSpeakableVideoText(t)) return ''
  return language === 'tr' ? ttsPronunciation(t) : t.replace(/https?:\/\/\S+/g, '').trim()
}
