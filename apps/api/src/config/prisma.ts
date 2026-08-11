import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { env } from './env'

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined
}

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg({
    connectionString: env.DATABASE_URL,
  })

  return new PrismaClient({
    adapter,
    log: env.isDevelopment ? ['query', 'warn', 'error'] : ['warn', 'error'],
  })
}

export const prisma: PrismaClient = global.__prisma ?? createPrismaClient()

if (env.isDevelopment) {
  global.__prisma = prisma
}

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect()
  console.log('[Prisma] Disconnected from database')
}