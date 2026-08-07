import { prisma } from '../lib/prisma'

async function main() {
  try {
    await prisma.$connect()
    const n = await prisma.contentSource.count()
    console.log('DB OK, sources:', n)
  } catch (e) {
    console.error('DB FAIL')
    console.error(e instanceof Error ? e.message : e)
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

main()
