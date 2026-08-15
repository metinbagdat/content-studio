import 'dotenv/config'
import { prisma } from '../lib/prisma'

async function main() {
  const tables = await prisma.$queryRawUnsafe<Array<{ table_name: string }>>(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name",
  )
  console.log(tables)
}

main()
  .catch((err) => console.error(err))
  .finally(() => prisma.$disconnect())