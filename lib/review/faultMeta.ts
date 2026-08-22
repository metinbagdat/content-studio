export type ReviewFaultInfo = {
  fault: boolean
  last?: string
}

export function readReviewFault(metadata: unknown): ReviewFaultInfo {
  if (!metadata || typeof metadata !== 'object') return { fault: false }
  const m = metadata as Record<string, unknown>
  return {
    fault: m.reviewFault === true,
    last: typeof m.reviewFaultLast === 'string' ? m.reviewFaultLast : undefined,
  }
}

export const VIDEO_FAULT_TYPES = new Set(['VIDEO_SCRIPT', 'SHORT_VIDEO_SCRIPT'])

export function parseBulkErrorLine(line: string): { id: string; message: string } | null {
  const m = line.match(/^([0-9a-f-]{36}):\s*(.+)$/i)
  if (!m) return null
  return { id: m[1], message: m[2].trim() }
}

export function isStorageOrVideoFault(message: string): boolean {
  return /video|ENOENT|storage|ffmpeg/i.test(message)
}
