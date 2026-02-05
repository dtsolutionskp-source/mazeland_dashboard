import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import fs from 'fs'
import path from 'path'

// Vercel 환경 감지 - 서버리스에서는 /tmp만 쓰기 가능
const isVercel = process.env.VERCEL === '1'
const BASE_DATA_PATH = isVercel ? '/tmp' : process.cwd()
const DATA_DIR = path.join(BASE_DATA_PATH, '.data')
const ACCOUNTS_FILE = path.join(DATA_DIR, 'accounts.json')

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
  return DEFAULT_ACCOUNTS
}

function saveAccounts(accounts: any[]) {
  ensureDataDir()
  fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2))
}

const COMPANY_NAMES: Record<string, string> = {
  SKP: 'SK플래닛',
  MAZE: '메이즈랜드',
  CULTURE: '컬처커넥션',
  FMC: 'FMC',
}

// 계정 수정
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }
    
    if (user.role !== 'SUPER_ADMIN' && user.role !== 'SKP_ADMIN') {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
    }
    
    const { id } = params
    const body = await request.json()
    const { email, password, name, role, companyCode } = body
    
    const accounts = getAccounts()
    const index = accounts.findIndex((a: any) => a.id === id)
    
    if (index === -1) {
      return NextResponse.json({ error: '계정을 찾을 수 없습니다.' }, { status: 404 })
    }
    
    // 이메일 중복 체크 (자신 제외)
    if (email && accounts.some((a: any, i: number) => a.email === email && i !== index)) {
      return NextResponse.json({ error: '이미 사용 중인 이메일입니다.' }, { status: 400 })
    }
    
    // 업데이트
    accounts[index] = {
      ...accounts[index],
      ...(email && { email }),
      ...(password && { password }), // 비밀번호가 있을 때만 업데이트
      ...(name && { name }),
      ...(role && { role }),
      ...(companyCode && { 
        companyCode,
        companyName: COMPANY_NAMES[companyCode] || companyCode,
      }),
      updatedAt: new Date().toISOString(),
    }
    
    saveAccounts(accounts)
    
    return NextResponse.json({ account: accounts[index] })
  } catch (error) {
    console.error('Update account error:', error)
    return NextResponse.json({ error: '계정 수정 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

// 계정 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }
    
    if (user.role !== 'SUPER_ADMIN' && user.role !== 'SKP_ADMIN') {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
    }
    
    const { id } = params
    const accounts = getAccounts()
    
    // SKP 계정은 삭제 불가
    const account = accounts.find((a: any) => a.id === id)
    if (account?.companyCode === 'SKP') {
      return NextResponse.json({ error: 'SKP 관리자 계정은 삭제할 수 없습니다.' }, { status: 400 })
    }
    
    const filtered = accounts.filter((a: any) => a.id !== id)
    
    if (filtered.length === accounts.length) {
      return NextResponse.json({ error: '계정을 찾을 수 없습니다.' }, { status: 404 })
    }
    
    saveAccounts(filtered)
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete account error:', error)
    return NextResponse.json({ error: '계정 삭제 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
