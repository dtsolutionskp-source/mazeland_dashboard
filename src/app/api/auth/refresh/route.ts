import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, createToken } from '@/lib/auth'

// 세션 갱신 API
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    
    if (!user) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    // 새 토큰 생성
    const token = await createToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
    })

    const response = NextResponse.json({ success: true })

    // 쿠키 갱신 (10분 연장)
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 10, // 10분
      path: '/',
    })

    return response
  } catch (error) {
    console.error('Token refresh error:', error)
    return NextResponse.json(
      { error: '세션 갱신 실패' },
      { status: 500 }
    )
  }
}
