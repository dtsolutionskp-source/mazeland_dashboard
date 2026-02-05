import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getActiveChannels } from '@/lib/master-data'

/**
 * GET /api/master/channels
 * 인터넷 채널 마스터 데이터 조회
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    // 활성 채널만 반환 (정렬됨)
    const channels = getActiveChannels()

    return NextResponse.json({
      success: true,
      channels,
    })
  } catch (error) {
    console.error('[Master/Channels] Error:', error)
    return NextResponse.json({ error: '채널 목록 조회 실패' }, { status: 500 })
  }
}

