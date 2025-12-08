// Prisma 클라이언트 (DB 연결이 없어도 앱이 동작하도록 처리)

let prisma: any = null

try {
  const { PrismaClient } = require('@prisma/client')
  
  const globalForPrisma = globalThis as unknown as {
    prisma: any | undefined
  }

  prisma = globalForPrisma.prisma ?? new PrismaClient()

  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma
  }
} catch (error) {
  console.log('Prisma 클라이언트를 초기화할 수 없습니다. DB 없이 실행됩니다.')
  // 더미 prisma 객체 생성
  prisma = {
    user: {
      findUnique: async () => null,
      findMany: async () => [],
      create: async () => null,
      update: async () => null,
      delete: async () => null,
    },
    company: {
      findUnique: async () => null,
      findMany: async () => [],
    },
    settlement: {
      findMany: async () => [],
      upsert: async () => null,
    },
    salesRecord: {
      createMany: async () => ({ count: 0 }),
    },
    uploadHistory: {
      create: async () => ({ id: 'mock' }),
      update: async () => null,
      findMany: async () => [],
    },
    marketingLog: {
      findMany: async () => [],
      findUnique: async () => null,
      create: async () => null,
      update: async () => null,
      delete: async () => null,
    },
    aIInsight: {
      findFirst: async () => null,
      upsert: async () => null,
    },
  }
}

export { prisma }
