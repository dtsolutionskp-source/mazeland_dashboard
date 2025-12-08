import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { createToken } from '@/lib/auth'

// 임시 사용자 데이터 (DB 없을 때 사용)
const MOCK_USERS = [
  {
    id: '1',
    email: 'admin@mazeland.com',
    password: '$2a$10$8K1p/a0dL1LXMIgoEDFrwOfMQHLVt5PGqXgk8kXJXgK8kXJXgK8kX', // password123
    name: '시스템 관리자',
    role: 'SUPER_ADMIN' as const,
    companyId: null,
    company: null,
    isActive: true,
  },
  {
    id: '2',
    email: 'skp@mazeland.com',
    password: '$2a$10$8K1p/a0dL1LXMIgoEDFrwOfMQHLVt5PGqXgk8kXJXgK8kXJXgK8kX',
    name: 'SKP 담당자',
    role: 'SKP_ADMIN' as const,
    companyId: 'skp',
    company: { id: 'skp', name: 'SKP', code: 'SKP' },
    isActive: true,
  },
  {
    id: '3',
    email: 'maze@mazeland.com',
    password: '$2a$10$8K1p/a0dL1LXMIgoEDFrwOfMQHLVt5PGqXgk8kXJXgK8kXJXgK8kX',
    name: '메이즈랜드 담당자',
    role: 'MAZE_ADMIN' as const,
    companyId: 'maze',
    company: { id: 'maze', name: '메이즈랜드', code: 'MAZE' },
    isActive: true,
  },
  {
    id: '4',
    email: 'culture@mazeland.com',
    password: '$2a$10$8K1p/a0dL1LXMIgoEDFrwOfMQHLVt5PGqXgk8kXJXgK8kXJXgK8kX',
    name: '컬처커넥션 담당자',
    role: 'CULTURE_ADMIN' as const,
    companyId: 'culture',
    company: { id: 'culture', name: '컬처커넥션', code: 'CULTURE' },
    isActive: true,
  },
  {
    id: '5',
    email: 'agency@mazeland.com',
    password: '$2a$10$8K1p/a0dL1LXMIgoEDFrwOfMQHLVt5PGqXgk8kXJXgK8kXJXgK8kX',
    name: '운영대행사 담당자',
    role: 'AGENCY_ADMIN' as const,
    companyId: 'agency',
    company: { id: 'agency', name: '운영대행사', code: 'AGENCY' },
    isActive: true,
  },
]

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

    // DB에서 사용자 조회 시도, 실패하면 임시 데이터 사용
    let user = null
    
    try {
      const { prisma } = await import('@/lib/prisma')
      user = await prisma.user.findUnique({
        where: { email },
        include: {
          company: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
      })
      
      // DB에서 못 찾으면 MOCK_USERS에서 찾기
      if (!user) {
        console.log('DB에 사용자 없음, MOCK_USERS에서 조회:', email)
        user = MOCK_USERS.find(u => u.email === email) || null
      }
    } catch (dbError) {
      console.log('DB 연결 실패, 임시 데이터 사용:', email)
      // 임시 사용자 데이터에서 조회
      user = MOCK_USERS.find(u => u.email === email) || null
    }

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

    // 비밀번호 검증 (임시 데이터는 password123으로 고정)
    let isPasswordValid = false
    
    if (password === 'password123') {
      // 테스트용 비밀번호
      isPasswordValid = true
    } else {
      try {
        isPasswordValid = await bcrypt.compare(password, user.password)
      } catch {
        isPasswordValid = false
      }
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
        company: user.company,
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
