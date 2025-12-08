import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getActiveCategories } from '@/lib/master-data'

/**
 * GET /api/master/categories
 * 현장 판매 구분 마스터 데이터 조회
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    // 활성 구분만 반환 (정렬됨)
    const categories = getActiveCategories()

    return NextResponse.json({
      success: true,
      categories,
    })
  } catch (error) {
    console.error('[Master/Categories] Error:', error)
    return NextResponse.json({ error: '구분 목록 조회 실패' }, { status: 500 })
  }
}

