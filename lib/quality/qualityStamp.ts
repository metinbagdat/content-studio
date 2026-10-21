import { applyPedagogicalJudge } from './pedagogicalJudge'
import {
  evaluateDraft,
  qualityAutoAdvanceEnabled,
  qualityScoreThreshold,
  withQualityMetadata,
  type DraftStatusAfterScore,
  type QualityReport,
} from './scoreDraft'

/** Score a new draft and choose IN_REVIEW or APPROVED. LLM judge runs only when QUALITY_LLM_JUDGE=1. */
export async function stampDraftQuality(input: {
  title: string
  content: string
  contentType: string
  metadata: unknown
}): Promise<{ metadata: Record<string, unknown>; status: DraftStatusAfterScore; report: QualityReport }> {
  const pedagogy = await applyPedagogicalJudge(input)
  const { report, status } = evaluateDraft({
    ...input,
    threshold: qualityScoreThreshold(),
    autoAdvance: qualityAutoAdvanceEnabled(),
    judgeMode: pedagogy.stage === 'cheap' ? 'llm' : 'rules',
    pedagogy: pedagogy.rejected ? { rejected: true, reasons: pedagogy.reasons } : undefined,
  })
  return { metadata: withQualityMetadata(input.metadata, report), status, report }
}
