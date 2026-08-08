/** Shared TTS pronunciation — Turkish voice reads brand/URLs phonetically.
 * Applied to all spoken audio (podcast, video, song); subtitles keep original text. */
export function ttsPronunciation(text: string): string {
  return text
    .replace(/www\s*\.\s*egitim\s*\.\s*today/gi, 'www nokta egitim nokta tudey')
    .replace(/(?:https?:\/\/)?(?:www\.)?egitim\.today/gi, 'www nokta egitim nokta tudey')
    .replace(/\begitim\s*\.\s*today\b/gi, 'egitim nokta tudey')
    .replace(/https?:\/\/\S+/g, '')
    .trim()
}
