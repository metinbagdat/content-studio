import { recoverStuckPublishing } from '../lib/social/preparePublish'
import { prisma } from '../lib/prisma'

recoverStuckPublishing(0)
  .then((n) => console.log(`Recovered ${n} stuck PUBLISHING posts`))
  .finally(() => prisma.$disconnect())
