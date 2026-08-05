/** Shared TTS pronunciation fixes — Turkish voice needs phonetic help for the brand name
 * and should never read raw URLs aloud. Reused by both podcast and video generation. */
export function ttsPronunciation(text: string): string {
  return text
    .replace(/(?:https?:\/\/)?(?:www\.)?egitim\.today/gi, 'www nokta egitim nokta tudey')
    .replace(/https?:\/\/\S+/g, '')
    .trim()
}
