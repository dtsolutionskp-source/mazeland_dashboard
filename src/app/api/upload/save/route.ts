import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { saveUploadData, saveUploadDataByMonth, getUploadDataByMonth, StoredUploadData } from '@/lib/data-store'
import { saveBulkDailyData } from '@/lib/daily-data-store'
import { calculateSettlement } from '@/lib/settlement'
import { DailyAggData, DailyChannelSale, DailyCategorySale } from '@/types/sales-data'

interface DailyData {
  date: string
  online: number
  offline: number
  total: number
  channelData?: Record<string, { count: number; feeRate: number }>
  categoryData?: Record<string, { count: number }>
}

interface ChannelData {
  name: string
  count: number
  feeRate: number
}

interface CategoryData {
  name: string
  count: number
}

const BASE_PRICE = 3000

// 채널별 수수료율
const CHANNEL_FEE_RATES: Record<string, number> = {
  NAVER_MAZE_25: 10,
  GENERAL_TICKET: 15,
  MAZE_TICKET: 12,
  MAZE_TICKET_SINGLE: 12,
  MAZE_25_SPECIAL: 10,  // 25특가
  OTHER: 15,
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    // 관리자만 저장 가능
    if (!['SUPER_ADMIN', 'SKP_ADMIN'].includes(user.role)) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
    }

    const body = await request.json()
    const { dailyData, channels, categories, summary, year, month, mergeMode } = body

    console.log('[Upload Save] Saving data for:', year, month, 'mergeMode:', mergeMode)
    console.log('[Upload Save] Daily data count:', dailyData?.length)

    // 병합 모드: 해당 월의 기존 데이터와 병합
    let finalDailyData: DailyData[] = dailyData
    let finalChannels: Record<string, ChannelData> = channels || {}
    let finalCategories: Record<string, CategoryData> = categories || {}
    
    if (mergeMode) {
      // 해당 월의 기존 데이터만 가져옴
      const existingData = await getUploadDataByMonth(year, month)
      if (existingData) {
        console.log('[Upload Save] Merging with existing data for', year, month)
        
        // 기존 일별 데이터를 맵으로 변환
        const existingDailyMap = new Map<string, DailyData>()
        for (const d of existingData.dailyData || []) {
          existingDailyMap.set(d.date, d)
        }
        
        // 새 데이터 병합 (겹치는 날짜는 새 데이터로 덮어쓰기)
        for (const d of dailyData) {
          existingDailyMap.set(d.date, d)
        }
        
        // 맵을 배열로 변환하고 정렬
        finalDailyData = Array.from(existingDailyMap.values())
          .sort((a, b) => a.date.localeCompare(b.date))
        
        console.log('[Upload Save] Merged daily data count:', finalDailyData.length)
        
        // ⚠️ 채널/카테고리 월계 데이터는 합산하지 않음!
        // 엑셀 파일의 "월 계"는 이미 누적값이므로, 최신 파일(새 데이터)의 월계를 그대로 사용
        // 예: 1~14 파일 월계 + 15~31 파일 월계 = 중복! (15~31 파일에 이미 전체 월 누적값 포함)
        console.log('[Upload Save] Using NEW channels/categories (cumulative totals from latest file)')
        console.log('[Upload Save] New channels:', Object.entries(finalChannels).map(([k, v]) => `${k}: ${v.count}`))
        console.log('[Upload Save] New categories:', Object.entries(finalCategories).map(([k, v]) => `${k}: ${v.count}`))
      }
    }

    // 일별 데이터에서 합계 재계산 (병합된 데이터 사용)
    const totalOnline = finalDailyData.reduce((sum: number, d: DailyData) => sum + d.online, 0)
    const totalOffline = finalDailyData.reduce((sum: number, d: DailyData) => sum + d.offline, 0)
    const totalCount = totalOnline + totalOffline

    console.log('[Upload Save] Recalculated totals:', { totalOnline, totalOffline, totalCount })

    // 채널별 합계 재계산 (병합된 데이터 사용)
    const channelSum = Object.values(finalChannels).reduce((sum, ch) => sum + (ch.count || 0), 0)
    const categorySum = Object.values(finalCategories).reduce((sum, cat) => sum + (cat.count || 0), 0)
    
    // 채널/카테고리 합계가 일별 합계와 다르면 채널/카테고리 합계 우선 사용
    const finalOnlineCount = channelSum > 0 ? channelSum : totalOnline
    const finalOfflineCount = categorySum > 0 ? categorySum : totalOffline
    const finalTotalCount = finalOnlineCount + finalOfflineCount
    
    console.log('[Upload Save] Final counts:', { finalOnlineCount, finalOfflineCount, finalTotalCount })

    // 채널별 데이터를 직접 사용하여 정산 계산
    const onlineSales = Object.entries(finalChannels).map(([code, data]: [string, any]) => ({
      channelCode: code as any,
      channelName: data.name,
      count: data.count || 0,
    }))

    const settlementInput = {
      onlineSales,
      offlineCount: finalOfflineCount,
    }

    // 시작일/종료일 계산
    const dates = finalDailyData.map((d: DailyData) => new Date(d.date)).sort((a: Date, b: Date) => a.getTime() - b.getTime())
    const periodStart = dates[0] || new Date(year, month - 1, 1)
    const periodEnd = dates[dates.length - 1] || new Date(year, month, 0)

    const settlement = calculateSettlement(
      settlementInput,
      undefined,
      periodStart,
      periodEnd
    )

    console.log('[Upload Save] Settlement result:', settlement.settlements.map(s => ({
      name: s.companyName,
      code: s.companyCode,
      revenue: s.revenue,
      income: s.income,
      cost: s.cost,
      profit: s.profit,
    })))

    // 채널별 순매출 계산 (병합된 데이터 사용)
    let onlineNetRevenue = 0
    for (const [code, data] of Object.entries(finalChannels) as [string, ChannelData][]) {
      const feeRate = data.feeRate || CHANNEL_FEE_RATES[code] || 10
      const netPrice = BASE_PRICE * (1 - feeRate / 100)
      onlineNetRevenue += netPrice * (data.count || 0)
    }
    const offlineRevenue = finalOfflineCount * BASE_PRICE
    const totalNetRevenue = onlineNetRevenue + offlineRevenue

    // ============================================
    // 1. 기존 저장소에 저장 (upload-data.json)
    // ============================================
    const storedData: StoredUploadData = {
      uploadedAt: new Date().toISOString(),
      fileName: mergeMode ? `${year}년_${month}월_병합데이터.xlsx` : `${year}년_${month}월_수정데이터.xlsx`,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      source: 'file',
      summary: {
        onlineCount: finalOnlineCount,
        offlineCount: finalOfflineCount,
        totalCount: finalTotalCount,
      },
      dailyData: finalDailyData.map((d: DailyData) => ({
        date: d.date,
        online: d.online,
        offline: d.offline,
        total: d.online + d.offline,
        channelData: d.channelData || {},
        categoryData: d.categoryData || {},
      })),
      channels: finalChannels,
      categories: finalCategories,
      monthly: {
        onlineByChannel: Object.fromEntries(
          Object.entries(finalChannels).map(([code, data]: [string, any]) => [code, data.count || 0])
        ),
        onlineByAge: {},
        offlineByCategory: Object.fromEntries(
          Object.entries(finalCategories).map(([code, data]: [string, any]) => [code, data.count || 0])
        ),
        revenue: {
          online: finalOnlineCount * BASE_PRICE,
          onlineFee: Math.round(finalOnlineCount * BASE_PRICE - onlineNetRevenue),
          onlineNet: Math.round(onlineNetRevenue),
          offline: offlineRevenue,
          total: finalTotalCount * BASE_PRICE,
          totalNet: Math.round(totalNetRevenue),
        },
      },
      settlement: {
        companies: settlement.settlements.map(s => ({
          name: s.companyName,
          code: s.companyCode,
          revenue: s.revenue,
          income: s.income,
          cost: s.cost,
          profit: s.profit,
          profitRate: s.profitRate,
        })),
      },
    }

    // 월별 파일에 저장
    await saveUploadDataByMonth(year, month, storedData)
    console.log('[Upload Save] Saved to upload-data for', year, month)
    
    // 레거시 파일에도 저장 (하위 호환성)
    await saveUploadData(storedData)
    console.log('[Upload Save] Also saved to legacy upload-data.json')

    // ============================================
    // 2. 일자별 데이터 저장소에도 저장 (daily 폴더)
    // ============================================
    
    // 채널별/카테고리별 누적 배분량 추적 (반올림 오차 보정용)
    const channelCodes = Object.keys(finalChannels)
    const categoryCodes = Object.keys(finalCategories)
    const channelDistributed: Record<string, number> = {}
    const categoryDistributed: Record<string, number> = {}
    
    channelCodes.forEach(code => { channelDistributed[code] = 0 })
    categoryCodes.forEach(code => { categoryDistributed[code] = 0 })
    
    const sortedDailyData = [...finalDailyData].sort((a: DailyData, b: DailyData) => 
      a.date.localeCompare(b.date)
    )
    const lastIndex = sortedDailyData.length - 1
    
    const dailyAggDataList: DailyAggData[] = sortedDailyData.map((d: DailyData, idx: number) => {
      const isLastDay = idx === lastIndex
      
      // 채널별 판매 데이터 생성 (일별 비율로 배분, 마지막 날 나머지 보정)
      const dayRatioOnline = finalOnlineCount > 0 ? d.online / finalOnlineCount : 0
      const dayRatioOffline = finalOfflineCount > 0 ? d.offline / finalOfflineCount : 0

      const channelSales: DailyChannelSale[] = channelCodes.map(code => {
        const chData = (finalChannels as Record<string, ChannelData>)[code]
        const targetTotal = chData.count || 0
        const feeRate = chData.feeRate || CHANNEL_FEE_RATES[code] || 10
        
        let count: number
        if (isLastDay) {
          // 마지막 날: 남은 수량 전부 할당 (반올림 오차 보정)
          count = Math.max(0, targetTotal - channelDistributed[code])
        } else {
          count = Math.floor(targetTotal * dayRatioOnline)
        }
        
        channelDistributed[code] += count
        
        return {
          date: d.date,
          channelCode: code,
          channelName: chData.name || code,
          count,
          feeRate,
          grossRevenue: BASE_PRICE * count,
          fee: Math.round(BASE_PRICE * count * feeRate / 100),
          netRevenue: Math.round(BASE_PRICE * count * (1 - feeRate / 100)),
        }
      })

      const categorySales: DailyCategorySale[] = categoryCodes.map(code => {
        const catData = (finalCategories as Record<string, CategoryData>)[code]
        const targetTotal = catData.count || 0
        
        let count: number
        if (isLastDay) {
          // 마지막 날: 남은 수량 전부 할당 (반올림 오차 보정)
          count = Math.max(0, targetTotal - categoryDistributed[code])
        } else {
          count = Math.floor(targetTotal * dayRatioOffline)
        }
        
        categoryDistributed[code] += count
        
        return {
          date: d.date,
          categoryCode: code,
          categoryName: catData.name || code,
          count,
          revenue: BASE_PRICE * count,
        }
      })

      // 실제 일별 합계 사용 (사용자가 입력한 값)
      const onlineCount = d.online
      const offlineCount = d.offline

      return {
        date: d.date,
        channelSales,
        categorySales,
        summary: {
          date: d.date,
          onlineCount,
          offlineCount,
          totalCount: onlineCount + offlineCount,
          onlineNetRevenue: channelSales.reduce((sum, ch) => sum + (ch.netRevenue || 0), 0),
          offlineRevenue: offlineCount * BASE_PRICE,
          totalNetRevenue: channelSales.reduce((sum, ch) => sum + (ch.netRevenue || 0), 0) + offlineCount * BASE_PRICE,
        },
        source: 'file',
      }
    })

    // 일자별 데이터 저장 (월별 재집계는 하지 않음 - 원본 총계 유지)
    // saveBulkDailyData 대신 직접 저장하여 recalculateMonthlyAgg 호출 방지
    const { saveDailyDataWithoutRecalc } = await import('@/lib/daily-data-store')
    await saveDailyDataWithoutRecalc(year, month, dailyAggDataList)
    console.log('[Upload Save] Saved to daily data store:', dailyAggDataList.length, 'days')

    return NextResponse.json({
      success: true,
      summary: storedData.summary,
      settlement: {
        companies: storedData.settlement.companies,
      },
      revenue: storedData.monthly.revenue,
    })
  } catch (error) {
    console.error('[Upload Save] Error:', error)
    return NextResponse.json({ error: '데이터 저장 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
