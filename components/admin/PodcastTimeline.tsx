'use client'

type ParsedPodcast = {
  introMusicCue?: string
  welcome?: string
  segments?: Array<{ title?: string; script?: string }>
  keyTakeaways?: string[]
  cta?: string
  outroMusicCue?: string
  durationMin?: number
}

function tryParse(content: string): ParsedPodcast | null {
  try {
    const data = JSON.parse(content) as ParsedPodcast
    if (data && typeof data === 'object' && (data.welcome || data.segments)) return data
    return null
  } catch {
    return null
  }
}

/** Structured timeline view for PODCAST_SCRIPT — falls back to raw JSON if it doesn't parse. */
export function PodcastTimeline({ content }: { content: string }) {
  const script = tryParse(content)
  if (!script) return <div className="pre">{content}</div>

  return (
    <div className="podcast-timeline">
      {script.introMusicCue ? <div className="podcast-cue">🎵 {script.introMusicCue}</div> : null}
      {script.welcome ? (
        <div className="podcast-segment">
          <span className="podcast-segment-label">Giriş</span>
          <p>{script.welcome}</p>
        </div>
      ) : null}
      {(script.segments || []).map((seg, i) => (
        <div className="podcast-segment" key={i}>
          <span className="podcast-segment-label">{i + 1}. {seg.title || `Bölüm ${i + 1}`}</span>
          <p>{seg.script}</p>
        </div>
      ))}
      {script.keyTakeaways?.length ? (
        <div className="podcast-segment">
          <span className="podcast-segment-label">Özet noktalar</span>
          <ul>
            {script.keyTakeaways.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {script.cta ? (
        <div className="podcast-segment">
          <span className="podcast-segment-label">Kapanış / CTA</span>
          <p>{script.cta}</p>
        </div>
      ) : null}
      {script.outroMusicCue ? <div className="podcast-cue">🎵 {script.outroMusicCue}</div> : null}
      {script.durationMin ? (
        <p className="muted" style={{ margin: '0.5rem 0 0', fontSize: '0.78rem' }}>
          Tahmini süre: ~{script.durationMin} dk
        </p>
      ) : null}
    </div>
  )
}
