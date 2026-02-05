import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { createToken } from '@/lib/auth'
import fs from 'fs'
import path from 'path'

// Vercel 환경 감지 - 서버리스에서는 /tmp만 쓰기 가능
const isVercel = process.env.VERCEL === '1'
const BASE_DATA_PATH = isVercel ? '/tmp' : process.cwd()
const DATA_DIR = path.join(BASE_DATA_PATH, '.data')
const ACCOUNTS_FILE = path.join(DATA_DIR, 'accounts.json')

// 기본 사용자 데이터
const DEFAULT_ACCOUNTS = [
  {
    id: 'acc_skp',
    email: 'skp@mazeland.com',
    password: 'password123',
    name: 'SKP 관리자',
    role: 'SKP_ADMIN',
    companyCode: 'SKP',
    companyName: 'SK플래닛',
  },
  {
    id: 'acc_maze',
    email: 'maze@mazeland.com',
    password: 'password123',
    name: '메이즈랜드 관리자',
    role: 'PARTNER_ADMIN',
    companyCode: 'MAZE',
    companyName: '메이즈랜드',
  },
  {
    id: 'acc_culture',
    email: 'culture@mazeland.com',
    password: 'password123',
    name: '컬처커넥션 관리자',
    role: 'PARTNER_ADMIN',
    companyCode: 'CULTURE',
    companyName: '컬처커넥션',
  },
  {
    id: 'acc_fmc',
    email: 'fmc@mazeland.com',
    password: 'password123',
    name: 'FMC 관리자',
    role: 'AGENCY_ADMIN',
    companyCode: 'FMC',
    companyName: 'FMC',
  },
]

// 저장된 계정 목록 조회
function getAccounts() {
  try {
    if (fs.existsSync(ACCOUNTS_FILE)) {
      const data = fs.readFileSync(ACCOUNTS_FILE, 'utf-8')
      return JSON.parse(data)
    }
  } catch (error) {
    console.error('Read accounts error:', error)
  }
  return DEFAULT_ACCOUNTS
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

    // 저장된 계정에서 사용자 조회
    const accounts = getAccounts()
    const account = accounts.find((a: any) => a.email === email)
    
    // 계정을 사용자 형식으로 변환
    let user = account ? {
      id: account.id,
      email: account.email,
      password: account.password,
      name: account.name,
      role: account.role,
      companyId: account.companyCode?.toLowerCase(),
      company: {
        id: account.companyCode?.toLowerCase(),
        name: account.companyName,
        code: account.companyCode,
      },
      isActive: true,
    } : null

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

    // 비밀번호 검증 (저장된 비밀번호와 직접 비교)
    let isPasswordValid = false
    
    // 평문 비밀번호와 직접 비교 (accounts.json에 평문으로 저장)
    if (password === user.password) {
      isPasswordValid = true
    } else {
      // bcrypt 해시된 비밀번호와 비교 시도
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
