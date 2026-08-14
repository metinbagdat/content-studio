import type { SocialPlatform } from '@prisma/client'
import { prisma } from '../prisma'
import type { PlatformAccountStats } from './platformStats'

export type AccountPublicRow = {
  id: string
  platform: SocialPlatform
  accountName: string
  accountId: string
  isActive: boolean
  lastSyncAt: Date | null
  tokenExpiry: Date | null
  dryRun: boolean
  oauth: boolean
  username: string | null
  organizationId: string | null
  linkedinAuthorUrn: string | null
  stats: PlatformAccountStats | null
}

/** Account list without access/refresh tokens or full config JSON (Supabase egress). */
export async function loadAccountPublicRows(): Promise<AccountPublicRow[]> {
  const rows = await prisma.$queryRaw<
    Array<{
      id: string
      platform: SocialPlatform
      accountName: string
      accountId: string
      isActive: boolean
      lastSyncAt: Date | null
      tokenExpiry: Date | null
      dryRun: boolean
      oauth: boolean
      username: string | null
      organizationId: string | null
      linkedinAuthorUrn: string | null
      stats: PlatformAccountStats | null
    }>
  >`
    SELECT
      id,
      platform,
      "accountName",
      "accountId",
      "isActive",
      "lastSyncAt",
      "tokenExpiry",
      (
        COALESCE(config->>'dryRun', 'false') IN ('true', 't', '1')
        OR "accountId" LIKE 'dryrun_%'
      ) AS "dryRun",
      COALESCE(config->>'oauth', 'false') IN ('true', 't', '1') AS oauth,
      NULLIF(config->>'username', '') AS username,
      NULLIF(config->>'organizationId', '') AS "organizationId",
      NULLIF(config->>'linkedinAuthorUrn', '') AS "linkedinAuthorUrn",
      config->'stats' AS stats
    FROM "SocialMediaAccount"
    ORDER BY "createdAt" DESC
  `
  return rows.map((r) => ({
    ...r,
    stats: r.stats && typeof r.stats === 'object' ? r.stats : null,
  }))
}
