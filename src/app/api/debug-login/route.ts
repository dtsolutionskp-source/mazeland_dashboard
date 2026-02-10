import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()
    
    console.log('[Debug Login] Testing login for:', email)
    
    // 1. 사용자 조회
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        password: true,
        plainPassword: true,
        isActive: true,
        role: true,
      }
    })
    
    if (!user) {
      return NextResponse.json({
        step: 'user_lookup',
        success: false,
        error: 'User not found',
        email,
      })
    }
    
    // 2. 비밀번호 정보
    const passwordInfo = {
      storedPasswordLength: user.password.length,
      storedPasswordPrefix: user.password.substring(0, 10) + '...',
      plainPasswordStored: user.plainPassword || 'NOT STORED',
      inputPasswordLength: password.length,
      isBcryptHash: user.password.startsWith('$2'),
    }
    
    // 3. bcrypt 비교 테스트
    let bcryptResult = false
    let bcryptError = null
    try {
      bcryptResult = await bcrypt.compare(password, user.password)
    } catch (e) {
      bcryptError = e instanceof Error ? e.message : String(e)
    }
    
    // 4. 평문 비교 테스트
    const plainTextMatch = password === user.password
    const plainPasswordMatch = password === user.plainPassword
    
    return NextResponse.json({
      step: 'password_verification',
      success: bcryptResult || plainTextMatch || plainPasswordMatch,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isActive: user.isActive,
        role: user.role,
      },
      passwordInfo,
      verification: {
        bcryptResult,
        bcryptError,
        plainTextMatch,
        plainPasswordMatch,
      }
    })
  } catch (error) {
    console.error('[Debug Login] Error:', error)
    return NextResponse.json({
      step: 'error',
      success: false,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack?.substring(0, 500) : null,
    }, { status: 500 })
  }
}

// GET 요청으로 모든 사용자 목록 확인
export async function GET() {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        plainPassword: true,
      }
    })
    
    return NextResponse.json({
      success: true,
      userCount: users.length,
      users: users.map(u => ({
        ...u,
        plainPassword: u.plainPassword || '(not stored)',
      }))
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 })
  }
}
