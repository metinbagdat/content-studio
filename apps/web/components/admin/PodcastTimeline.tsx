'use client'

import { estimateSpeechDurationSec } from '@/lib/media/podcastText'

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

function fmtSec(sec: number): string {
  if (sec < 60) return `~${sec} sn`
  const m = Math.round(sec / 60)
  return `~${m} dk`
}

/** Structured timeline view for PODCAST_SCRIPT — falls back to raw JSON if it doesn't parse. */
export function PodcastTimeline({
  content,
  episodeIndex,
  episodeTotal,
}: {
  content: string
  episodeIndex?: number
  episodeTotal?: number
}) {
  const script = tryParse(content)
  if (!script) return <div className="pre">{content}</div>

  const spokenParts: string[] = []
  if (script.welcome) spokenParts.push(script.welcome)
  for (const seg of script.segments || []) {
    if (seg.script) spokenParts.push(seg.script)
  }
  if (script.keyTakeaways?.length) spokenParts.push(script.keyTakeaways.join('. '))
  if (script.cta) spokenParts.push(script.cta)
  const spokenSec = estimateSpeechDurationSec(spokenParts.join('\n\n'))

  return (
    <div className="podcast-timeline">
      {episodeTotal && episodeTotal > 1 ? (
        <p className="muted" style={{ margin: '0 0 0.5rem' }}>
          Seri bölüm {episodeIndex}/{episodeTotal}
        </p>
      ) : null}
      {script.introMusicCue ? <div className="podcast-cue">🎵 {script.introMusicCue}</div> : null}
      {script.welcome ? (
        <div className="podcast-segment">
          <span className="podcast-segment-label">
            Giriş <span className="muted">({fmtSec(estimateSpeechDurationSec(script.welcome))})</span>
          </span>
          <p>{script.welcome}</p>
        </div>
      ) : null}
      {(script.segments || []).map((seg, i) => (
        <div className="podcast-segment" key={i}>
          <span className="podcast-segment-label">
            {i + 1}. {seg.title || `Bölüm ${i + 1}`}{' '}
            {seg.script ? (
              <span className="muted">({fmtSec(estimateSpeechDurationSec(seg.script))})</span>
            ) : null}
          </span>
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
      <p className="muted" style={{ margin: '0.5rem 0 0', fontSize: '0.78rem' }}>
        Tahmini konuşma: {fmtSec(spokenSec)}
        {script.durationMin ? ` · hedef ~${script.durationMin} dk` : ''}
      </p>
    </div>
  )
}
