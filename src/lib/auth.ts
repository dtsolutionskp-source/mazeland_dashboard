import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { Role } from '@prisma/client'

// JWT 시크릿 키
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production'
)

// 토큰 유효 기간 (7일)
const TOKEN_EXPIRY = '7d'

export interface JWTPayload {
  userId: string
  email: string
  role: Role
  companyId?: string | null
}

export interface AuthUser {
  id: string
  email: string
  name: string
  role: Role
  companyId: string | null
  company?: {
    id: string
    name: string
    code: string
  } | null
}

// 임시 사용자 데이터
const MOCK_USERS: AuthUser[] = [
  {
    id: '1',
    email: 'admin@mazeland.com',
    name: '시스템 관리자',
    role: 'SUPER_ADMIN',
    companyId: null,
    company: null,
  },
  {
    id: '2',
    email: 'skp@mazeland.com',
    name: 'SKP 담당자',
    role: 'SKP_ADMIN',
    companyId: 'skp',
    company: { id: 'skp', name: 'SKP', code: 'SKP' },
  },
  {
    id: '3',
    email: 'maze@mazeland.com',
    name: '메이즈랜드 담당자',
    role: 'MAZE_ADMIN',
    companyId: 'maze',
    company: { id: 'maze', name: '메이즈랜드', code: 'MAZE' },
  },
  {
    id: '4',
    email: 'culture@mazeland.com',
    name: '컬처커넥션 담당자',
    role: 'CULTURE_ADMIN',
    companyId: 'culture',
    company: { id: 'culture', name: '컬처커넥션', code: 'CULTURE' },
  },
  {
    id: '5',
    email: 'agency@mazeland.com',
    name: 'FMC 담당자',
    role: 'AGENCY_ADMIN',
    companyId: 'agency',
    company: { id: 'agency', name: 'FMC', code: 'AGENCY' },
  },
]

/**
 * JWT 토큰 생성
 */
export async function createToken(payload: JWTPayload): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(JWT_SECRET)
}

/**
 * JWT 토큰 검증
 */
export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload as unknown as JWTPayload
  } catch (error) {
    return null
  }
}

/**
 * 쿠키에서 토큰 가져오기
 */
export async function getTokenFromCookies(): Promise<string | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')
  return token?.value || null
}

/**
 * 현재 로그인한 사용자 정보 가져오기
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const token = await getTokenFromCookies()
  if (!token) return null

  const payload = await verifyToken(token)
  if (!payload) return null

  // DB에서 사용자 조회 시도
  try {
    const { prisma } = await import('./prisma')
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        companyId: true,
        company: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    })
    
    if (user) return user
  } catch (error) {
    console.log('DB 연결 실패, 임시 데이터 사용')
  }

  // DB 실패시 임시 데이터에서 조회
  const mockUser = MOCK_USERS.find(u => u.id === payload.userId || u.email === payload.email)
  return mockUser || null
}

/**
 * 역할 기반 권한 체크
 */
export function hasPermission(
  userRole: Role,
  requiredRoles: Role[]
): boolean {
  return requiredRoles.includes(userRole)
}

/**
 * 관리자 권한 체크 (SUPER_ADMIN, SKP_ADMIN)
 */
export function isAdmin(role: Role): boolean {
  return role === 'SUPER_ADMIN' || role === 'SKP_ADMIN'
}

/**
 * 전체 데이터 조회 권한 체크
 */
export function canViewAllData(role: Role): boolean {
  return role === 'SUPER_ADMIN' || role === 'SKP_ADMIN'
}

/**
 * 데이터 업로드 권한 체크
 */
export function canUploadData(role: Role): boolean {
  return role === 'SUPER_ADMIN' || role === 'SKP_ADMIN'
}

/**
 * 사용자 관리 권한 체크
 */
export function canManageUsers(role: Role): boolean {
  return role === 'SUPER_ADMIN'
}

/**
 * 역할별 조회 가능한 회사 코드
 */
export function getViewableCompanyCodes(role: Role, userCompanyCode?: string): string[] {
  switch (role) {
    case 'SUPER_ADMIN':
    case 'SKP_ADMIN':
      return ['SKP', 'MAZE', 'CULTURE', 'AGENCY']
    case 'MAZE_ADMIN':
      return ['MAZE']
    case 'CULTURE_ADMIN':
      return ['CULTURE']
    case 'AGENCY_ADMIN':
      return ['AGENCY']
    default:
      return userCompanyCode ? [userCompanyCode] : []
  }
}

/**
 * 역할 한글명
 */
export const ROLE_NAMES: Record<Role, string> = {
  SUPER_ADMIN: '최고 관리자',
  SKP_ADMIN: 'SKP 관리자',
  MAZE_ADMIN: '메이즈랜드 관리자',
  CULTURE_ADMIN: '컬처커넥션 관리자',
  AGENCY_ADMIN: 'FMC 관리자',
}
