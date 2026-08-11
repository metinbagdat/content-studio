import { prisma } from '../lib/prisma'

async function main() {
  try {
    await prisma.$queryRaw`SELECT 1`
    console.log('DB connection: ok')
  } catch (err) {
    console.log('DB connection: failed')
    console.log(err instanceof Error ? err.message : String(err))
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
