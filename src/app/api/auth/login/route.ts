import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { createToken } from '@/lib/auth'
import prisma from '@/lib/prisma'

// 기본 계정 데이터 (DB에 없을 시 생성용)
const DEFAULT_ACCOUNTS = [
  {
    email: 'skp@mazeland.com',
    password: 'password123',
    name: 'SKP 관리자',
    role: 'SKP_ADMIN' as const,
    companyCode: 'SKP',
    companyName: 'SK플래닛',
  },
  {
    email: 'maze@mazeland.com',
    password: 'password123',
    name: '메이즈랜드 관리자',
    role: 'MAZE_ADMIN' as const,
    companyCode: 'MAZE',
    companyName: '메이즈랜드',
  },
  {
    email: 'culture@mazeland.com',
    password: 'password123',
    name: '컬처커넥션 관리자',
    role: 'CULTURE_ADMIN' as const,
    companyCode: 'CULTURE',
    companyName: '컬처커넥션',
  },
  {
    email: 'fmc@mazeland.com',
    password: 'password123',
    name: 'FMC 관리자',
    role: 'AGENCY_ADMIN' as const,
    companyCode: 'FMC',
    companyName: 'FMC',
  },
]

// 기본 회사 및 계정 초기화 (DB에 없을 시)
async function ensureDefaultAccounts() {
  try {
    const userCount = await prisma.user.count()
    if (userCount > 0) return // 이미 계정이 있으면 스킵

    console.log('[Auth] Initializing default accounts...')

    // 회사 생성
    for (const acc of DEFAULT_ACCOUNTS) {
      // 회사 upsert
      const company = await prisma.company.upsert({
        where: { code: acc.companyCode },
        update: {},
        create: {
          code: acc.companyCode,
          name: acc.companyName,
        },
      })

      // 비밀번호 해시
      const hashedPassword = await bcrypt.hash(acc.password, 10)

      // 사용자 생성 (원본 비밀번호도 저장)
      await prisma.user.create({
        data: {
          email: acc.email,
          password: hashedPassword,
          plainPassword: acc.password, // 원본 비밀번호 저장 (관리자 조회용)
          name: acc.name,
          role: acc.role,
          companyId: company.id,
          isActive: true,
        },
      })
    }

    console.log('[Auth] Default accounts created successfully')
  } catch (error) {
    console.error('[Auth] Error creating default accounts:', error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json(
        { error: '이메일과 비밀번호를 입력해주세요.' },
        { status: 400 }
      )
    }

    // 기본 계정 확인 및 생성
    await ensureDefaultAccounts()

    // DB에서 사용자 조회
    const user = await prisma.user.findUnique({
      where: { email },
      include: { company: true },
    })

    if (!user) {
      console.log('사용자를 찾을 수 없음:', email)
      return NextResponse.json(
        { error: '이메일 또는 비밀번호가 올바르지 않습니다.' },
        { status: 401 }
      )
    }

    console.log('로그인 시도:', email, '사용자 찾음:', user.name)

    // 비활성화된 계정 체크
    if (!user.isActive) {
      return NextResponse.json(
        { error: '비활성화된 계정입니다. 관리자에게 문의하세요.' },
        { status: 403 }
      )
    }

    // 비밀번호 검증
    let isPasswordValid = false

    // bcrypt 해시된 비밀번호와 비교
    try {
      isPasswordValid = await bcrypt.compare(password, user.password)
    } catch {
      isPasswordValid = false
    }

    // 평문 비밀번호와 직접 비교 (마이그레이션 호환성)
    if (!isPasswordValid && password === user.password) {
      isPasswordValid = true
      // 평문 비밀번호를 해시로 업데이트
      const hashedPassword = await bcrypt.hash(password, 10)
      await prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword },
      })
    }

    if (!isPasswordValid) {
      return NextResponse.json(
        { error: '이메일 또는 비밀번호가 올바르지 않습니다.' },
        { status: 401 }
      )
    }

    // JWT 토큰 생성
    const token = await createToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
    })

    // 응답 생성
    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        company: user.company ? {
          id: user.company.id,
          name: user.company.name,
          code: user.company.code,
        } : null,
      },
      message: '로그인 성공',
    })

    // 쿠키에 토큰 저장
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7일
      path: '/',
    })

    return response
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: '로그인 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
