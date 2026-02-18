import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function getDatabaseUrl(): string {
  const baseUrl = process.env.DATABASE_URL || ''
  
  // 이미 connection_limit이 있으면 그대로 사용
  if (baseUrl.includes('connection_limit')) {
    return baseUrl
  }
  
  // URL에 연결 타임아웃 및 풀 설정 추가
  const separator = baseUrl.includes('?') ? '&' : '?'
  return `${baseUrl}${separator}connect_timeout=10&pool_timeout=10`
}

function createPrismaClient() {
  console.log('[Prisma] Creating new PrismaClient instance')
  console.log('[Prisma] DATABASE_URL exists:', !!process.env.DATABASE_URL)
  
  const url = getDatabaseUrl()
  
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    datasources: {
      db: {
        url,
      },
    },
  })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

// 모든 환경에서 globalForPrisma에 저장하여 커넥션 재사용
globalForPrisma.prisma = prisma

export default prisma
