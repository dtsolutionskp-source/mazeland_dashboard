import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import fs from 'fs'
import path from 'path'

const DATA_DIR = path.join(process.cwd(), '.data')
const ACCOUNTS_FILE = path.join(DATA_DIR, 'accounts.json')

// 기본 계정 데이터
const DEFAULT_ACCOUNTS = [
  {
    id: 'acc_skp',
    email: 'skp@mazeland.com',
    password: 'password123',
    name: 'SKP 관리자',
    role: 'SKP_ADMIN',
    companyCode: 'SKP',
    companyName: 'SK플래닛',
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'acc_maze',
    email: 'maze@mazeland.com',
    password: 'password123',
    name: '메이즈랜드 관리자',
    role: 'PARTNER_ADMIN',
    companyCode: 'MAZE',
    companyName: '메이즈랜드',
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'acc_culture',
    email: 'culture@mazeland.com',
    password: 'password123',
    name: '컬처커넥션 관리자',
    role: 'PARTNER_ADMIN',
    companyCode: 'CULTURE',
    companyName: '컬처커넥션',
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'acc_fmc',
    email: 'fmc@mazeland.com',
    password: 'password123',
    name: 'FMC 관리자',
    role: 'AGENCY_ADMIN',
    companyCode: 'FMC',
    companyName: 'FMC',
    createdAt: '2024-01-01T00:00:00Z',
  },
]

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }
}

function getAccounts() {
  ensureDataDir()
  try {
    if (fs.existsSync(ACCOUNTS_FILE)) {
      const data = fs.readFileSync(ACCOUNTS_FILE, 'utf-8')
      return JSON.parse(data)
    }
  } catch (error) {
    console.error('Read accounts error:', error)
  }
  // 기본 계정 반환
  return DEFAULT_ACCOUNTS
}

function saveAccounts(accounts: any[]) {
  ensureDataDir()
  fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2))
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
    
    const accounts = getAccounts()
    
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
    
    const accounts = getAccounts()
    
    // 이메일 중복 체크
    if (accounts.some((a: any) => a.email === email)) {
      return NextResponse.json({ error: '이미 사용 중인 이메일입니다.' }, { status: 400 })
    }
    
    const COMPANY_NAMES: Record<string, string> = {
      SKP: 'SK플래닛',
      MAZE: '메이즈랜드',
      CULTURE: '컬처커넥션',
      FMC: 'FMC',
    }
    
    const newAccount = {
      id: `acc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      email,
      password,
      name,
      role: role || 'PARTNER_ADMIN',
      companyCode: companyCode || 'MAZE',
      companyName: COMPANY_NAMES[companyCode] || companyCode,
      createdAt: new Date().toISOString(),
    }
    
    accounts.push(newAccount)
    saveAccounts(accounts)
    
    return NextResponse.json({ account: newAccount })
  } catch (error) {
    console.error('Create account error:', error)
    return NextResponse.json({ error: '계정 생성 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
