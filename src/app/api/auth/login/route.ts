import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { createToken } from '@/lib/auth'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const maxDuration = 15 // 15초 타임아웃

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
    console.log('[Login] Request received')
    
    const body = await request.json()
    const { email, password } = body

    console.log('[Login] Email:', email)

    if (!email || !password) {
      return NextResponse.json(
        { error: '이메일과 비밀번호를 입력해주세요.' },
        { status: 400 }
      )
    }

    // 기본 계정 확인 및 생성 (에러가 발생해도 로그인 시도는 계속)
    try {
      await ensureDefaultAccounts()
    } catch (initError) {
      console.error('[Login] ensureDefaultAccounts error:', initError)
      // 에러가 발생해도 계속 진행
    }

    console.log('[Login] Looking up user in DB...')

    // DB에서 사용자 조회 (재시도 로직 포함)
    let user = null
    let retries = 3
    let lastError = null
    
    while (retries > 0 && !user) {
      try {
        user = await prisma.user.findUnique({
          where: { email },
          include: { company: true },
        })
        break
      } catch (dbError) {
        lastError = dbError
        retries--
        console.log(`[Login] DB query failed, retries left: ${retries}`, dbError)
        if (retries > 0) {
          await new Promise(resolve => setTimeout(resolve, 500)) // 500ms 대기 후 재시도
        }
      }
    }
    
    if (lastError && !user) {
      console.error('[Login] All DB retries failed:', lastError)
      throw lastError
    }

    console.log('[Login] User found:', user ? user.name : 'null')

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

    // 쿠키에 토큰 저장 (보안 강화)
    // 세션 타임아웃은 클라이언트에서 SessionTimeout 컴포넌트가 처리
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict', // 크로스 사이트 요청 차단
      maxAge: 60 * 60 * 24, // 24시간 (실제 세션 관리는 클라이언트에서)
      path: '/',
    })

    return response
  } catch (error) {
    console.error('[Login] Error:', error)
    console.error('[Login] Error details:', error instanceof Error ? error.message : String(error))
    console.error('[Login] Error stack:', error instanceof Error ? error.stack : 'N/A')
    
    // 더 구체적인 에러 메시지 반환
    let errorMessage = '로그인 처리 중 오류가 발생했습니다.'
    if (error instanceof Error) {
      if (error.message.includes('connect') || error.message.includes('Connection')) {
        errorMessage = '데이터베이스 연결에 실패했습니다.'
      } else if (error.message.includes('timeout')) {
        errorMessage = '서버 응답 시간이 초과되었습니다.'
      }
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
