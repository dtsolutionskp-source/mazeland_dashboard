import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// 비밀번호 강제 업데이트 (일회성 사용)
export async function POST(request: NextRequest) {
  try {
    const { email, newPassword, secretKey } = await request.json()
    
    // 보안을 위한 간단한 시크릿 키 확인
    if (secretKey !== 'mazeland-fix-2024') {
      return NextResponse.json({ error: 'Invalid secret key' }, { status: 403 })
    }
    
    if (!email || !newPassword) {
      return NextResponse.json({ error: 'Email and newPassword required' }, { status: 400 })
    }
    
    // 사용자 찾기
    const user = await prisma.user.findUnique({
      where: { email }
    })
    
    if (!user) {
      return NextResponse.json({ error: 'User not found', email }, { status: 404 })
    }
    
    // 새 비밀번호 해시
    const hashedPassword = await bcrypt.hash(newPassword, 10)
    
    // 업데이트
    const updated = await prisma.user.update({
      where: { email },
      data: {
        password: hashedPassword,
        plainPassword: newPassword,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      }
    })
    
    return NextResponse.json({
      success: true,
      message: 'Password updated successfully',
      user: updated,
    })
  } catch (error) {
    console.error('[Fix Password] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 })
  }
}

// GET으로 현재 상태 확인
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const email = searchParams.get('email')
  
  if (!email) {
    return NextResponse.json({ error: 'Email required as query param' }, { status: 400 })
  }
  
  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        plainPassword: true,
        password: true,
      }
    })
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
        plainPassword: user.plainPassword || '(not stored)',
        passwordIsBcrypt: user.password.startsWith('$2'),
        passwordLength: user.password.length,
      }
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 })
  }
}
