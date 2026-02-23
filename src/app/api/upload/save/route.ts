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

    // 모든 로그인된 사용자가 데이터 입력 가능
    console.log('[Upload Save] User:', user.email, 'Role:', user.role)

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
        onlineByChannel: (() => {
          const result = Object.fromEntries(
            Object.entries(finalChannels).map(([code, data]: [string, any]) => [code, { 
              count: data.count || 0, 
              feeRate: data.feeRate || CHANNEL_FEE_RATES[code] || 10 
            }])
          )
          console.log('[Upload Save] onlineByChannel to save:', JSON.stringify(result))
          return result
        })(),
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

    // 월별 파일에 저장 (로컬 개발용)
    try {
      await saveUploadDataByMonth(year, month, storedData)
      console.log('[Upload Save] Saved to file system for', year, month)
      
      // 레거시 파일에도 저장 (하위 호환성)
      await saveUploadData(storedData)
    } catch (fsError) {
      console.log('[Upload Save] File system save failed (expected on Vercel):', fsError)
    }
    
    // ============================================
    // DB에 저장 (Vercel 서버리스 환경에서 필수)
    // ============================================
    try {
      const prisma = (await import('@/lib/prisma')).default
      
      // 기존 데이터 삭제 (upsert 대신 delete + create)
      const existingSummary = await prisma.monthlySummary.findFirst({
        where: { year, month },
      })
      
      if (existingSummary) {
        // 관련 데이터 삭제
        await prisma.onlineSale.deleteMany({
          where: { uploadHistoryId: existingSummary.uploadHistoryId },
        })
        await prisma.offlineSale.deleteMany({
          where: { uploadHistoryId: existingSummary.uploadHistoryId },
        })
        await prisma.monthlySummary.delete({
          where: { id: existingSummary.id },
        })
        await prisma.uploadHistory.delete({
          where: { id: existingSummary.uploadHistoryId },
        })
        console.log('[Upload Save] Deleted existing DB data for', year, month)
      }
      
      // 새 UploadHistory 생성
      const uploadHistory = await prisma.uploadHistory.create({
        data: {
          fileName: storedData.fileName,
          fileSize: 0, // 파일 크기 (해당 시점에서 알 수 없음)
          periodStart: new Date(storedData.periodStart),
          periodEnd: new Date(storedData.periodEnd),
          uploadedById: user.id,
        },
      })
      
      // MonthlySummary 생성
      await prisma.monthlySummary.create({
        data: {
          uploadHistoryId: uploadHistory.id,
          year,
          month,
          onlineTotal: finalOnlineCount,
          offlineTotal: finalOfflineCount,
          grandTotal: finalTotalCount,
          onlineRevenue: storedData.monthly.revenue.online,
          onlineFee: storedData.monthly.revenue.onlineFee,
          onlineNet: storedData.monthly.revenue.onlineNet,
          offlineRevenue: storedData.monthly.revenue.offline,
          totalRevenue: storedData.monthly.revenue.total,
          totalNet: storedData.monthly.revenue.totalNet,
          onlineByChannel: storedData.monthly.onlineByChannel,
          onlineByAge: storedData.monthly.onlineByAge || {},
          offlineByCategory: storedData.monthly.offlineByCategory,
        },
      })
      
      // 일별 온라인/오프라인 판매 데이터 저장 (단순화: 일별 총합만 저장)
      const onlineSalesData: any[] = []
      const offlineSalesData: any[] = []
      
      console.log('[Upload Save] Processing daily data:', finalDailyData.length, 'days')
      
      for (const dayData of finalDailyData) {
        const saleDate = new Date(dayData.date)
        
        // 온라인 일별 총합 저장 (채널 분배 없이 단순 저장)
        if (dayData.online > 0) {
          onlineSalesData.push({
            uploadHistoryId: uploadHistory.id,
            saleDate,
            vendor: 'DAILY_TOTAL',
            channel: 'DAILY_TOTAL',
            channelCode: 'DAILY_TOTAL',
            feeRate: 0,
            ageGroup: '성인',
            quantity: dayData.online,
            unitPrice: BASE_PRICE,
            grossAmount: BASE_PRICE * dayData.online,
            feeAmount: 0,
            netAmount: BASE_PRICE * dayData.online,
          })
        }
        
        // 오프라인 일별 총합 저장 (카테고리 분배 없이 단순 저장)
        if (dayData.offline > 0) {
          offlineSalesData.push({
            uploadHistoryId: uploadHistory.id,
            saleDate,
            category: 'DAILY_TOTAL',
            categoryCode: 'DAILY_TOTAL',
            quantity: dayData.offline,
            unitPrice: BASE_PRICE,
            totalAmount: BASE_PRICE * dayData.offline,
          })
        }
      }
      
      console.log('[Upload Save] Online sales data:', onlineSalesData.length, 'records')
      console.log('[Upload Save] Offline sales data:', offlineSalesData.length, 'records')
      
      // 일괄 저장
      if (onlineSalesData.length > 0) {
        await prisma.onlineSale.createMany({ data: onlineSalesData })
        console.log('[Upload Save] Saved', onlineSalesData.length, 'online sales to DB')
      }
      
      if (offlineSalesData.length > 0) {
        await prisma.offlineSale.createMany({ data: offlineSalesData })
        console.log('[Upload Save] Saved', offlineSalesData.length, 'offline sales to DB')
      }
      
      console.log('[Upload Save] Saved to DB for', year, month)
    } catch (dbError) {
      console.error('[Upload Save] DB save error:', dbError)
      // DB 저장 실패해도 계속 진행 (파일 시스템에는 저장됨)
    }

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
    try {
      const { saveDailyDataWithoutRecalc } = await import('@/lib/daily-data-store')
      await saveDailyDataWithoutRecalc(year, month, dailyAggDataList)
      console.log('[Upload Save] Saved to daily data store:', dailyAggDataList.length, 'days')
    } catch (dailyError) {
      console.error('[Upload Save] Daily data store error:', dailyError)
      // daily-data-store 저장 실패해도 upload-data는 이미 저장됨 - 경고만 출력
    }

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
    console.error('[Upload Save] Error details:', error instanceof Error ? error.stack : String(error))
    
    // 더 구체적인 에러 메시지 반환
    let errorMessage = '데이터 저장 중 오류가 발생했습니다.'
    if (error instanceof Error) {
      if (error.message.includes('ENOENT')) {
        errorMessage = '저장 경로를 찾을 수 없습니다. 서버 관리자에게 문의하세요.'
      } else if (error.message.includes('EACCES')) {
        errorMessage = '파일 쓰기 권한이 없습니다. 서버 관리자에게 문의하세요.'
      } else {
        errorMessage = `저장 오류: ${error.message}`
      }
    }
    
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

// 월별 업로드 데이터 삭제
export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const year = parseInt(searchParams.get('year') || '')
    const month = parseInt(searchParams.get('month') || '')

    if (!year || !month || isNaN(year) || isNaN(month)) {
      return NextResponse.json({ error: '연도와 월을 지정해주세요.' }, { status: 400 })
    }

    console.log('[Upload Delete] User:', user.email, 'Deleting:', year, month)

    let deletedFromDB = false
    let deletedFromFS = false

    // 1. DB에서 삭제 시도 (MonthlySummary 먼저 찾고 관련 데이터 모두 삭제)
    try {
      const prisma = (await import('@/lib/prisma')).default
      
      // MonthlySummary 찾기
      const summary = await prisma.monthlySummary.findFirst({
        where: { year, month },
      })
      
      if (summary) {
        // 관련된 OnlineSale 삭제
        await prisma.onlineSale.deleteMany({
          where: { uploadHistoryId: summary.uploadHistoryId },
        })
        console.log('[Upload Delete] Deleted OnlineSales from DB')
        
        // 관련된 OfflineSale 삭제
        await prisma.offlineSale.deleteMany({
          where: { uploadHistoryId: summary.uploadHistoryId },
        })
        console.log('[Upload Delete] Deleted OfflineSales from DB')
        
        // MonthlySummary 삭제
        await prisma.monthlySummary.delete({
          where: { id: summary.id },
        })
        console.log('[Upload Delete] Deleted MonthlySummary from DB')
        
        // UploadHistory 삭제
        await prisma.uploadHistory.delete({
          where: { id: summary.uploadHistoryId },
        })
        console.log('[Upload Delete] Deleted UploadHistory from DB')
        
        deletedFromDB = true
      } else {
        console.log('[Upload Delete] No MonthlySummary found in DB for', year, month)
      }
    } catch (dbError) {
      console.error('[Upload Delete] DB delete error:', dbError)
    }

    // 2. 파일 시스템에서 월별 파일 삭제
    try {
      const { deleteMonthlyData, clearUploadData, getUploadData } = await import('@/lib/data-store')
      await deleteMonthlyData(year, month)
      console.log('[Upload Delete] Deleted monthly file from file system')
      
      // 레거시 upload-data.json도 확인해서 해당 월이면 삭제
      const legacyData = await getUploadData()
      if (legacyData) {
        const legacyDate = new Date(legacyData.periodStart)
        if (legacyDate.getFullYear() === year && legacyDate.getMonth() + 1 === month) {
          await clearUploadData()
          console.log('[Upload Delete] Cleared legacy upload-data.json')
        }
      }
      
      deletedFromFS = true
    } catch (fsError) {
      console.error('[Upload Delete] File system delete error:', fsError)
    }

    // 3. daily-data-store에서도 삭제
    try {
      const { deleteDailyDataForMonth } = await import('@/lib/daily-data-store')
      await deleteDailyDataForMonth(year, month)
      console.log('[Upload Delete] Deleted from daily data store')
    } catch (dailyError) {
      console.error('[Upload Delete] Daily data delete error:', dailyError)
    }

    // 4. MonthlyAgg 데이터도 삭제 (있다면)
    try {
      const prisma = (await import('@/lib/prisma')).default
      await prisma.monthlyAgg.deleteMany({
        where: { year, month },
      })
      console.log('[Upload Delete] Deleted MonthlyAgg from DB')
    } catch (aggError) {
      console.log('[Upload Delete] MonthlyAgg delete (may not exist):', aggError)
    }

    return NextResponse.json({
      success: true,
      message: `${year}년 ${month}월 데이터가 삭제되었습니다.`,
      details: {
        deletedFromDB,
        deletedFromFS,
      }
    })
  } catch (error) {
    console.error('[Upload Delete] Error:', error)
    return NextResponse.json({ 
      error: '데이터 삭제 중 오류가 발생했습니다.' 
    }, { status: 500 })
  }
}
