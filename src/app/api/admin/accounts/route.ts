import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import bcrypt from 'bcryptjs'
import prisma from '@/lib/prisma'

const COMPANY_NAMES: Record<string, string> = {
  SKP: 'SK플래닛',
  MAZE: '메이즈랜드',
  CULTURE: '컬처커넥션',
  FMC: 'FMC',
}

const ROLE_MAP: Record<string, 'SKP_ADMIN' | 'MAZE_ADMIN' | 'CULTURE_ADMIN' | 'AGENCY_ADMIN' | 'SUPER_ADMIN'> = {
  SKP: 'SKP_ADMIN',
  MAZE: 'MAZE_ADMIN',
  CULTURE: 'CULTURE_ADMIN',
  FMC: 'AGENCY_ADMIN',
}

// 계정 목록 조회
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    // SKP 관리자만 접근 가능
    if (user.role !== 'SUPER_ADMIN' && user.role !== 'SKP_ADMIN') {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
    }

    const users = await prisma.user.findMany({
      include: { company: true },
      orderBy: { createdAt: 'desc' },
    })

    // 기존 형식에 맞게 변환
    const accounts = users.map(u => ({
      id: u.id,
      email: u.email,
      password: '********', // 비밀번호는 숨김
      name: u.name,
      role: u.role,
      companyCode: u.company?.code || '',
      companyName: u.company?.name || '',
      createdAt: u.createdAt.toISOString(),
      isActive: u.isActive,
    }))

    return NextResponse.json({ accounts })
  } catch (error) {
    console.error('Get accounts error:', error)
    return NextResponse.json({ error: '계정 조회 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

// 계정 생성
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    if (user.role !== 'SUPER_ADMIN' && user.role !== 'SKP_ADMIN') {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
    }

    const body = await request.json()
    const { email, password, name, role, companyCode } = body

    if (!email || !password || !name) {
      return NextResponse.json({ error: '필수 정보를 입력해주세요.' }, { status: 400 })
    }

    // 이메일 중복 체크
    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      return NextResponse.json({ error: '이미 사용 중인 이메일입니다.' }, { status: 400 })
    }

    // 회사 찾기 또는 생성
    const code = companyCode || 'MAZE'
    let company = await prisma.company.findUnique({ where: { code } })
    if (!company) {
      company = await prisma.company.create({
        data: {
          code,
          name: COMPANY_NAMES[code] || code,
        },
      })
    }

    // 비밀번호 해시
    const hashedPassword = await bcrypt.hash(password, 10)

    // 사용자 생성
    const newUser = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: role || ROLE_MAP[code] || 'MAZE_ADMIN',
        companyId: company.id,
        isActive: true,
      },
      include: { company: true },
    })

    const account = {
      id: newUser.id,
      email: newUser.email,
      password: '********',
      name: newUser.name,
      role: newUser.role,
      companyCode: newUser.company?.code || '',
      companyName: newUser.company?.name || '',
      createdAt: newUser.createdAt.toISOString(),
    }

    return NextResponse.json({ account })
  } catch (error) {
    console.error('Create account error:', error)
    return NextResponse.json({ error: '계정 생성 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
