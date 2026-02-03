import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getUploadDataByMonth, getAvailableUploadMonths } from '@/lib/data-store'

// 정산 항목별 회사 매핑
const SETTLEMENT_ITEMS = [
  { id: 'SKP_TO_MAZE_REVENUE', fromCode: 'SKP', toCode: 'MAZE', isNonRevenue: false },
  { id: 'MAZE_TO_SKP_OPERATION', fromCode: 'MAZE', toCode: 'SKP', isNonRevenue: false },
  { id: 'CULTURE_TO_SKP', fromCode: 'CULTURE', toCode: 'SKP', isNonRevenue: false },
  { id: 'SKP_TO_CULTURE_PLATFORM', fromCode: 'SKP', toCode: 'CULTURE', isNonRevenue: false },
  { id: 'SKP_TO_MAZE_CULTURE_SHARE', fromCode: 'SKP', toCode: 'MAZE', isNonRevenue: true },
  { id: 'FMC_TO_SKP_AGENCY', fromCode: 'FMC', toCode: 'SKP', isNonRevenue: false },
]

// 단일 월 정산 금액 계산
function calculateMonthAmounts(uploadData: any): Record<string, number> {
  const channels = uploadData.channels || {}
  const onlineCount = uploadData.summary?.onlineCount || 0
  const offlineCount = uploadData.summary?.offlineCount || 0

  let onlineRevenue_3000 = 0
  let onlineRevenue_1000 = 0
  let onlineRevenue_500_maze = 0

  Object.values(channels).forEach((ch: any) => {
    const count = ch.count || 0
    const feeRate = (ch.feeRate || 0) / 100

    onlineRevenue_3000 += count * 3000 * (1 - feeRate)
    onlineRevenue_1000 += count * 1000 * (1 - feeRate)
    onlineRevenue_500_maze += count * 500 * (1 - feeRate)
  })

  const offlineRevenue_3000 = offlineCount * 3000
  const offlineRevenue_1000 = offlineCount * 1000
  const offlineRevenue_500 = offlineCount * 500

  const total_3000 = Math.round(onlineRevenue_3000 + offlineRevenue_3000)
  const total_1000 = Math.round(onlineRevenue_1000 + offlineRevenue_1000)
  const total_500_maze = Math.round(onlineRevenue_500_maze + offlineRevenue_500)

  // SKP 수익 계산 (FMC 수수료 대상)
  // SKP매출 - 메이즈R/S - 컬처R/S + 메이즈비용분담금
  // ※ 플랫폼 이용료(SKP→컬처)는 수수료 계산에 포함하지 않음
  let skpProfit = 0
  Object.values(channels).forEach((ch: any) => {
    const count = ch.count || 0
    const feeRate = (ch.feeRate || 0) / 100
    // 3000 - 1000 - 1000 + 500 = 1500원 (인당)
    const profitPerPerson = 3000 * (1 - feeRate) - 1000 * (1 - feeRate) - 
                            1000 * (1 - feeRate) + 500 * (1 - feeRate)
    skpProfit += count * profitPerPerson
  })
  skpProfit += offlineCount * 1500  // 오프라인: 3000 - 1000 - 1000 + 500 = 1500

  return {
    SKP_TO_MAZE_REVENUE: total_3000,
    MAZE_TO_SKP_OPERATION: total_1000,
    CULTURE_TO_SKP: total_1000,
    SKP_TO_CULTURE_PLATFORM: Math.round(total_1000 * 0.2),
    SKP_TO_MAZE_CULTURE_SHARE: total_500_maze,
    FMC_TO_SKP_AGENCY: Math.round(skpProfit * 0.2),
  }
}

// 회사별 매출/비용/수익 계산
function calculateCompanySummary(amounts: Record<string, number>) {
  const summary: Record<string, { revenue: number; expense: number; profit: number }> = {
    SKP: { revenue: 0, expense: 0, profit: 0 },
    MAZE: { revenue: 0, expense: 0, profit: 0 },
    CULTURE: { revenue: 0, expense: 0, profit: 0 },
    FMC: { revenue: 0, expense: 0, profit: 0 },
  }

  SETTLEMENT_ITEMS.forEach(item => {
    const amount = amounts[item.id] || 0
    
    // 발행처(fromCode)의 경우: 매출 또는 수익
    if (item.isNonRevenue) {
      summary[item.fromCode].profit += amount
    } else {
      summary[item.fromCode].revenue += amount
    }
    
    // 수취처(toCode)의 경우: 비용
    summary[item.toCode].expense += amount
  })

  return summary
}

// 누적 정산 데이터 조회 API
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'yearly' // 'yearly' or 'total'
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString())

    const availableMonths = await getAvailableUploadMonths()
    
    // 대상 월 필터링
    let targetMonths = availableMonths
    if (type === 'yearly') {
      targetMonths = availableMonths.filter(m => m.year === year)
    }

    // 누적 금액 계산
    const cumulativeAmounts: Record<string, number> = {}
    let totalVisitors = 0
    let totalOnline = 0
    let totalOffline = 0
    const monthlyData: Array<{
      year: number
      month: number
      amounts: Record<string, number>
      visitors: number
    }> = []

    for (const m of targetMonths) {
      const uploadData = await getUploadDataByMonth(m.year, m.month)
      if (uploadData) {
        const amounts = calculateMonthAmounts(uploadData)
        
        // 누적
        Object.keys(amounts).forEach(key => {
          cumulativeAmounts[key] = (cumulativeAmounts[key] || 0) + amounts[key]
        })

        const onlineCount = uploadData.summary?.onlineCount || 0
        const offlineCount = uploadData.summary?.offlineCount || 0
        totalVisitors += onlineCount + offlineCount
        totalOnline += onlineCount
        totalOffline += offlineCount

        monthlyData.push({
          year: m.year,
          month: m.month,
          amounts,
          visitors: onlineCount + offlineCount,
        })
      }
    }

    // 회사별 요약
    const companySummary = calculateCompanySummary(cumulativeAmounts)

    return NextResponse.json({
      type,
      year: type === 'yearly' ? year : null,
      period: type === 'yearly' 
        ? `${year}년` 
        : `${availableMonths[availableMonths.length - 1]?.year || year}년 ~ ${availableMonths[0]?.year || year}년`,
      monthCount: targetMonths.length,
      totalVisitors,
      totalOnline,
      totalOffline,
      amounts: cumulativeAmounts,
      companySummary,
      monthlyData,
      availableYears: [...new Set(availableMonths.map(m => m.year))].sort((a, b) => b - a),
    })
  } catch (error) {
    console.error('Cumulative settlement data API error:', error)
    return NextResponse.json(
      { error: '누적 정산 데이터 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

