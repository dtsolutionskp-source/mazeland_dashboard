import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient() {
  console.log('[Prisma] Creating new PrismaClient instance')
  console.log('[Prisma] DATABASE_URL exists:', !!process.env.DATABASE_URL)
  
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

// Production에서도 globalForPrisma에 저장하여 커넥션 재사용
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
} else {
  // Vercel 서버리스에서 커넥션 풀 재사용
  globalForPrisma.prisma = prisma
}

export default prisma
