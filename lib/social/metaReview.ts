/** Meta App Review / sandbox status for admin (CS-SM-00). Live/Advanced Access is still a Meta dashboard action. */

export const META_DATA_ACCESS_RENEWAL = '2026-10-07'
export const META_APP_ID_PUBLIC = '1309132857965857'
export const META_PAGE_ID_DEFAULT = '1153725161168373'

export function metaBulkPublishLimit(): number {
  const n = Number(process.env.META_BULK_PUBLISH_LIMIT?.trim() || '8')
  return Number.isFinite(n) && n > 0 ? Math.min(20, Math.floor(n)) : 8
}

export function metaBulkPublishGapMs(): number {
  const n = Number(process.env.META_BULK_PUBLISH_GAP_MS?.trim() || '2500')
  return Number.isFinite(n) && n >= 0 ? n : 2500
}

export function metaReviewStatus() {
  const due = new Date(`${META_DATA_ACCESS_RENEWAL}T00:00:00+03:00`)
  const daysLeft = Math.ceil((due.getTime() - Date.now()) / 86_400_000)
  return {
    appId: META_APP_ID_PUBLIC,
    pageId: process.env.META_PAGE_ID?.trim() || META_PAGE_ID_DEFAULT,
    dataAccessRenewal: META_DATA_ACCESS_RENEWAL,
    daysLeft,
    publishOauth: process.env.META_OAUTH_PUBLISH === 'true',
    bulkLimit: metaBulkPublishLimit(),
    bulkGapMs: metaBulkPublishGapMs(),
    submissionDoc: 'docs/META_APP_REVIEW_SUBMISSION.md',
  }
}
