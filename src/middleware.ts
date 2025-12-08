import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production'
)

// 인증이 필요 없는 경로
const publicPaths = ['/login', '/api/auth/login']

// 정적 파일 경로
const staticPaths = ['/_next', '/favicon.ico', '/images']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 정적 파일은 통과
  if (staticPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.next()
  }

  // 공개 경로는 통과
  if (publicPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.next()
  }

  // 토큰 확인
  const token = request.cookies.get('auth-token')?.value

  if (!token) {
    // API 요청은 401 응답
    if (pathname.startsWith('/api')) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }
    // 페이지 요청은 로그인으로 리다이렉트
    return NextResponse.redirect(new URL('/login', request.url))
  }

  try {
    // 토큰 검증
    const { payload } = await jwtVerify(token, JWT_SECRET)
    
    // 요청 헤더에 사용자 정보 추가
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-user-id', payload.userId as string)
    requestHeaders.set('x-user-role', payload.role as string)
    if (payload.companyId) {
      requestHeaders.set('x-company-id', payload.companyId as string)
    }

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    })
  } catch (error) {
    // 토큰이 유효하지 않음
    if (pathname.startsWith('/api')) {
      return NextResponse.json(
        { error: '유효하지 않은 토큰입니다.' },
        { status: 401 }
      )
    }
    
    // 쿠키 삭제 후 로그인으로 리다이렉트
    const response = NextResponse.redirect(new URL('/login', request.url))
    response.cookies.delete('auth-token')
    return response
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}



