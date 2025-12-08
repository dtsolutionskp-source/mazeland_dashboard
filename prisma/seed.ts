import { PrismaClient, Role } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // 1. 회사 생성
  const companies = await Promise.all([
    prisma.company.upsert({
      where: { code: 'SKP' },
      update: {},
      create: {
        name: 'SKP',
        code: 'SKP',
        description: '주식회사 SKP',
      },
    }),
    prisma.company.upsert({
      where: { code: 'MAZE' },
      update: {},
      create: {
        name: '메이즈랜드',
        code: 'MAZE',
        description: '메이즈랜드 운영사',
      },
    }),
    prisma.company.upsert({
      where: { code: 'CULTURE' },
      update: {},
      create: {
        name: '컬처커넥션',
        code: 'CULTURE',
        description: '컬처커넥션',
      },
    }),
    prisma.company.upsert({
      where: { code: 'AGENCY' },
      update: {},
      create: {
        name: '운영대행사',
        code: 'AGENCY',
        description: '운영대행사',
      },
    }),
  ])

  console.log('✅ Companies created:', companies.map(c => c.name).join(', '))

  // 2. 사용자 생성
  const hashedPassword = await bcrypt.hash('password123', 10)

  const users = await Promise.all([
    // SUPER_ADMIN
    prisma.user.upsert({
      where: { email: 'admin@mazeland.com' },
      update: {},
      create: {
        email: 'admin@mazeland.com',
        password: hashedPassword,
        name: '시스템 관리자',
        role: Role.SUPER_ADMIN,
      },
    }),
    // SKP_ADMIN
    prisma.user.upsert({
      where: { email: 'skp@mazeland.com' },
      update: {},
      create: {
        email: 'skp@mazeland.com',
        password: hashedPassword,
        name: 'SKP 담당자',
        role: Role.SKP_ADMIN,
        companyId: companies.find(c => c.code === 'SKP')?.id,
      },
    }),
    // MAZE_ADMIN
    prisma.user.upsert({
      where: { email: 'maze@mazeland.com' },
      update: {},
      create: {
        email: 'maze@mazeland.com',
        password: hashedPassword,
        name: '메이즈랜드 담당자',
        role: Role.MAZE_ADMIN,
        companyId: companies.find(c => c.code === 'MAZE')?.id,
      },
    }),
    // CULTURE_ADMIN
    prisma.user.upsert({
      where: { email: 'culture@mazeland.com' },
      update: {},
      create: {
        email: 'culture@mazeland.com',
        password: hashedPassword,
        name: '컬처커넥션 담당자',
        role: Role.CULTURE_ADMIN,
        companyId: companies.find(c => c.code === 'CULTURE')?.id,
      },
    }),
    // AGENCY_ADMIN
    prisma.user.upsert({
      where: { email: 'agency@mazeland.com' },
      update: {},
      create: {
        email: 'agency@mazeland.com',
        password: hashedPassword,
        name: '운영대행사 담당자',
        role: Role.AGENCY_ADMIN,
        companyId: companies.find(c => c.code === 'AGENCY')?.id,
      },
    }),
  ])

  console.log('✅ Users created:', users.map(u => u.email).join(', '))
  console.log('\n📝 테스트 계정 정보:')
  console.log('   모든 계정 비밀번호: password123')
  console.log('   - admin@mazeland.com (SUPER_ADMIN)')
  console.log('   - skp@mazeland.com (SKP_ADMIN)')
  console.log('   - maze@mazeland.com (MAZE_ADMIN)')
  console.log('   - culture@mazeland.com (CULTURE_ADMIN)')
  console.log('   - agency@mazeland.com (AGENCY_ADMIN)')

  console.log('\n✨ Seeding completed!')
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })



