import { prisma } from '../lib/prisma'
import { auditSocialAccounts, bootstrapFaz2DryRunAccounts } from '../lib/social/accountAudit'
import { syncSocialDraftsFromApprovedCaptions } from '../lib/pipeline'
import { getDraftDiagnostics } from '../lib/social/draftDiagnostics'
import { oauthEnvCheck } from '../lib/social/config'

async function main() {
  const doBootstrap = process.argv.includes('--bootstrap')

  if (doBootstrap) {
    const created = await bootstrapFaz2DryRunAccounts()
    const sync = await syncSocialDraftsFromApprovedCaptions()
    console.log('Faz2 dry-run oluşturuldu:', created.length ? created.join(', ') : '(zaten vardı)')
    console.log('Taslak senkron:', sync.draftsCreated, 'yeni')
  }

  const audit = await auditSocialAccounts()
  const diag = await getDraftDiagnostics()
  const env = oauthEnvCheck()

  console.log('\n=== ENV DURUMU (Faz 1) ===')
  console.log('X_CLIENT_ID:', env.X_CLIENT_ID ? 'OK' : 'EKSİK')
  console.log('X_CLIENT_SECRET:', env.X_CLIENT_SECRET ? 'OK' : 'EKSİK')
  console.log('LINKEDIN_CLIENT_ID:', env.LINKEDIN_CLIENT_ID ? 'OK' : 'EKSİK')
  console.log('LINKEDIN_CLIENT_SECRET:', env.LINKEDIN_CLIENT_SECRET ? 'OK' : 'EKSİK')
  console.log('LINKEDIN_ORGANIZATION_ID:', process.env.LINKEDIN_ORGANIZATION_ID?.trim() || '(boş — kişisel post)')
  console.log('LINKEDIN_ORG_POST:', process.env.LINKEDIN_ORG_POST || 'false')
  console.log('NEXT_PUBLIC_APP_URL:', process.env.NEXT_PUBLIC_APP_URL || '(yok)')
  console.log('SOCIAL_AUTOPILOT:', process.env.SOCIAL_AUTOPILOT ?? 'true')
  console.log('TOKEN_ENCRYPTION_KEY:', process.env.TOKEN_ENCRYPTION_KEY ? 'OK' : 'EKSİK')

  console.log('\n=== BAĞLI HESAPLAR ===')
  const accounts = await prisma.socialMediaAccount.findMany({ orderBy: { platform: 'asc' } })
  for (const a of accounts) {
    const cfg = a.config && typeof a.config === 'object' ? (a.config as Record<string, unknown>) : {}
    const dry = a.accountId.startsWith('dryrun_') || Boolean(cfg.dryRun)
    const oauthAcc = Boolean(cfg.oauth) || (!dry && Boolean(a.refreshToken))
    console.log(
      `  ${a.platform} · ${a.accountName} · ${a.isActive ? 'aktif' : 'pasif'} · ${dry ? 'DRY-RUN' : oauthAcc ? 'OAuth' : 'legacy'}`,
    )
    if (a.platform === 'LINKEDIN' && cfg.organizationId) {
      console.log(`    org: ${String(cfg.organizationId)}`)
    }
  }

  console.log('\n=== HESAP AUDIT (Faz 1) ===')
  for (const s of audit.slots) {
    console.log(`  ${s.label}: ${s.status} — ${s.detail}`)
  }

  console.log('\n=== CAPTION / PLATFORM KIRILIMI ===')
  for (const b of diag.breakdown) {
    console.log(
      `  ${b.platform}: ${b.approvedCount} onaylı · ${b.draftCount} taslak · ${b.publishedCount} yayında · ${b.failedCount} hata`,
    )
    console.log(`    → ${b.reason}`)
  }

  console.log('\n=== FAZ 2 — DRY-RUN ÖNERİSİ ===')
  const faz2 = ['YOUTUBE', 'INSTAGRAM', 'TIKTOK', 'FACEBOOK'] as const
  for (const p of faz2) {
    const has = accounts.some((a) => a.platform === p && a.isActive)
    console.log(`  ${p}: ${has ? 'dry-run/hesap var' : 'hesap yok — /admin/social Dry-run bağla'}`)
  }

  const pinterestCaptions = diag.breakdown.find((b) => b.platform === 'PINTEREST')
  if (pinterestCaptions) {
    console.log(`\n  PINTEREST: ${pinterestCaptions.approvedCount} onaylı caption — gerçek API Faz 2, dry-run ile test`)
  }
}

main().finally(() => prisma.$disconnect())
