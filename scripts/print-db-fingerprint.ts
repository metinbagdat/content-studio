import { databaseFingerprint, getDeployParityInfo } from '../lib/env/deployParity'

const info = getDeployParityInfo()
console.log('=== Local ↔ Prod veri senkronu ===')
console.log('APP_URL:', info.appUrl)
console.log('DB fingerprint:', info.databaseFingerprint ?? '(DATABASE_URL eksik)')
console.log('')
console.log('Vercel Production + .env.local içine ekleyin (aynı Supabase için):')
console.log(`DEPLOY_PARITY_DB_FINGERPRINT="${info.databaseFingerprint ?? ''}"`)
console.log('')
console.log(info.sharedDataNote)

if (!info.databaseFingerprint) process.exit(1)
