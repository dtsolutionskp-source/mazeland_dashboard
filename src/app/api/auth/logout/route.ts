import { NextResponse } from 'next/server'

export async function POST() {
  const response = NextResponse.json({ message: '로그아웃 성공' })
  
  // 쿠키 삭제
  response.cookies.set('auth-token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  })
  
  return response
}



