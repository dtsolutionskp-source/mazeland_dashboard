import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { 
  getMonthlySettlementCheck, 
  toggleSettlementCheck,
  SettlementItemId 
} from '@/lib/settlement-check-store'

// 정산 체크 상태 조회
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString())
    const month = parseInt(searchParams.get('month') || (new Date().getMonth() + 1).toString())

    const checkData = await getMonthlySettlementCheck(year, month)

    return NextResponse.json({ 
      year, 
      month, 
      checks: checkData?.checks || {},
      updatedAt: checkData?.updatedAt 
    })
  } catch (error) {
    console.error('Get settlement check error:', error)
    return NextResponse.json(
      { error: '정산 체크 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// 정산 체크 상태 업데이트
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const body = await request.json()
    const { year, month, itemId, checked, amount } = body

    if (!year || !month || !itemId || checked === undefined || amount === undefined) {
      return NextResponse.json({ error: '필수 파라미터가 누락되었습니다.' }, { status: 400 })
    }

    const result = await toggleSettlementCheck(
      year,
      month,
      itemId as SettlementItemId,
      checked,
      amount,
      user.name
    )

    return NextResponse.json({ 
      success: true, 
      checks: result.checks,
      updatedAt: result.updatedAt 
    })
  } catch (error) {
    console.error('Update settlement check error:', error)
    return NextResponse.json(
      { error: '정산 체크 업데이트 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

