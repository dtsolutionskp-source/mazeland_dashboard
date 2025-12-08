/**
 * 판매 데이터 API v2
 * - 일자별/월별 데이터 조회 및 저장
 * - 수수료 정책 관리
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getMasterData, CHANNEL_MASTER, CATEGORY_MASTER } from '@/lib/master-data'
import {
  getMonthlyAggData,
  getAllDailyDataForMonth,
  saveDailyData,
  saveBulkDailyData,
  recalculateMonthlyAgg,
  getAvailableMonthsV2,
} from '@/lib/daily-data-store'
import {
  getMonthlyFeeSettings,
  saveMonthlyFeeSettings,
  createDefaultFeeSettings,
  getFeeRateForDate,
} from '@/lib/fee-policy'
import { calculateSettlement } from '@/lib/settlement'
import {
  DailyAggData,
  DailyChannelSale,
  DailyCategorySale,
  MonthlyFeeSettings,
  DataSource,
} from '@/types/sales-data'

/**
 * GET - 월별/일자별 데이터 조회
 * 
 * Query params:
 * - year, month: 연/월 (필수)
 * - date: 특정 일자 (선택)
 * - includeDaily: 일자별 상세 포함 여부 (기본 false)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const yearParam = searchParams.get('year')
    const monthParam = searchParams.get('month')
    const dateParam = searchParams.get('date')
    const includeDailyParam = searchParams.get('includeDaily')

    const masterData = getMasterData()
    const availableMonths = await getAvailableMonthsV2()

    // 연/월이 없으면 마스터 데이터와 가용 월 목록만 반환
    if (!yearParam || !monthParam) {
      return NextResponse.json({
        success: true,
        masterData,
        availableMonths,
      })
    }

    const year = parseInt(yearParam)
    const month = parseInt(monthParam)
    const includeDaily = includeDailyParam === 'true'

    // 수수료 설정 조회
    const feeSettings = await getMonthlyFeeSettings(year, month)

    // 월별 집계 조회
    let monthlyData = await getMonthlyAggData(year, month)
    
    // 데이터가 없으면 빈 구조 반환
    if (!monthlyData) {
      monthlyData = {
        year,
        month,
        source: 'manual',
        uploadedAt: new Date().toISOString(),
        feeSettings,
        dailyData: [],
        channelAggs: CHANNEL_MASTER.map(ch => ({
          channelCode: ch.code,
          channelName: ch.name,
          avgFeeRate: ch.defaultFeeRate,
          totalCount: 0,
          grossRevenue: 0,
          totalFee: 0,
          netRevenue: 0,
        })),
        categoryAggs: CATEGORY_MASTER.map(cat => ({
          categoryCode: cat.code,
          categoryName: cat.name,
          totalCount: 0,
          revenue: 0,
        })),
        summary: {
          totalDays: 0,
          onlineCount: 0,
          offlineCount: 0,
          totalCount: 0,
          onlineGrossRevenue: 0,
          onlineFee: 0,
          onlineNetRevenue: 0,
          offlineRevenue: 0,
          totalGrossRevenue: 0,
          totalNetRevenue: 0,
        },
      }
    }

    // 일자별 상세 포함 여부
    let dailyData = null
    if (includeDaily) {
      dailyData = await getAllDailyDataForMonth(year, month)
    }

    // 정산 계산
    const settlementInput = {
      onlineSales: monthlyData.channelAggs.map(ch => ({
        channelCode: ch.channelCode as any,
        channelName: ch.channelName,
        count: ch.totalCount,
      })),
      offlineCount: monthlyData.summary.offlineCount,
    }
    
    const settlement = calculateSettlement(
      settlementInput,
      undefined,
      new Date(year, month - 1, 1),
      new Date(year, month, 0)
    )

    return NextResponse.json({
      success: true,
      masterData,
      availableMonths,
      feeSettings,
      monthlyData: {
        ...monthlyData,
        dailyData: includeDaily ? dailyData : undefined,
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
    })
  } catch (error) {
    console.error('[Sales Data V2 API] GET Error:', error)
    return NextResponse.json({ error: '데이터 조회 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

/**
 * POST - 데이터 저장
 * 
 * Body:
 * - action: 'saveFee' | 'saveDaily' | 'saveBulkDaily'
 * - year, month
 * - feeSettings (action=saveFee)
 * - dailyData (action=saveDaily/saveBulkDaily)
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    if (!['SUPER_ADMIN', 'SKP_ADMIN'].includes(user.role)) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
    }

    const body = await request.json()
    const { action, year, month } = body

    console.log('[Sales Data V2 API] Action:', action, { year, month })

    switch (action) {
      case 'saveFee':
        return await handleSaveFee(body)
      case 'saveDaily':
        return await handleSaveDaily(body)
      case 'saveBulkDaily':
        return await handleSaveBulkDaily(body)
      default:
        return NextResponse.json({ error: '알 수 없는 action입니다.' }, { status: 400 })
    }
  } catch (error) {
    console.error('[Sales Data V2 API] POST Error:', error)
    return NextResponse.json({ error: '데이터 저장 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

/**
 * 수수료 설정 저장
 */
async function handleSaveFee(body: any) {
  const { year, month, channels, overrides } = body

  if (!year || !month || !channels) {
    return NextResponse.json({ error: '필수 파라미터가 누락되었습니다.' }, { status: 400 })
  }

  const feeSettings: MonthlyFeeSettings = {
    year,
    month,
    channels,
    overrides: overrides || [],
    updatedAt: new Date().toISOString(),
  }

  await saveMonthlyFeeSettings(feeSettings)

  // 월별 집계 재계산 (수수료 변경 반영)
  const monthlyData = await recalculateMonthlyAgg(year, month)

  return NextResponse.json({
    success: true,
    feeSettings,
    monthlyData,
  })
}

/**
 * 단일 일자 데이터 저장
 */
async function handleSaveDaily(body: any) {
  const { year, month, date, channelSales, categorySales, source } = body

  if (!year || !month || !date) {
    return NextResponse.json({ error: '필수 파라미터가 누락되었습니다.' }, { status: 400 })
  }

  // 수수료 설정 조회
  const feeSettings = await getMonthlyFeeSettings(year, month)

  // 채널 판매 데이터에 수수료율 적용
  const enrichedChannelSales: DailyChannelSale[] = (channelSales || []).map((sale: any) => {
    const feeRate = getFeeRateForDate(feeSettings, sale.channelCode, date)
    const master = CHANNEL_MASTER.find(m => m.code === sale.channelCode)
    
    return {
      date,
      channelCode: sale.channelCode,
      channelName: master?.name || sale.channelName || sale.channelCode,
      count: sale.count || 0,
      feeRate,
    }
  })

  // 카테고리 판매 데이터
  const enrichedCategorySales: DailyCategorySale[] = (categorySales || []).map((sale: any) => {
    const master = CATEGORY_MASTER.find(m => m.code === sale.categoryCode)
    
    return {
      date,
      categoryCode: sale.categoryCode,
      categoryName: master?.name || sale.categoryName || sale.categoryCode,
      count: sale.count || 0,
    }
  })

  const dailyData: DailyAggData = {
    date,
    channelSales: enrichedChannelSales,
    categorySales: enrichedCategorySales,
    summary: {
      date,
      onlineCount: 0,
      offlineCount: 0,
      totalCount: 0,
      onlineNetRevenue: 0,
      offlineRevenue: 0,
      totalNetRevenue: 0,
    },
    source: source || 'manual',
  }

  await saveDailyData(year, month, dailyData)

  // 업데이트된 월별 집계 반환
  const monthlyData = await getMonthlyAggData(year, month)

  return NextResponse.json({
    success: true,
    dailyData,
    monthlyData,
  })
}

/**
 * 여러 일자 데이터 일괄 저장
 */
async function handleSaveBulkDaily(body: any) {
  const { year, month, dailyDataList, source } = body

  if (!year || !month || !dailyDataList || !Array.isArray(dailyDataList)) {
    return NextResponse.json({ error: '필수 파라미터가 누락되었습니다.' }, { status: 400 })
  }

  // 수수료 설정 조회
  const feeSettings = await getMonthlyFeeSettings(year, month)

  // 각 일자 데이터에 수수료율 적용
  const enrichedDataList: DailyAggData[] = dailyDataList.map((daily: any) => {
    const date = daily.date

    const channelSales: DailyChannelSale[] = (daily.channelSales || []).map((sale: any) => {
      const feeRate = getFeeRateForDate(feeSettings, sale.channelCode, date)
      const master = CHANNEL_MASTER.find(m => m.code === sale.channelCode)
      
      return {
        date,
        channelCode: sale.channelCode,
        channelName: master?.name || sale.channelName || sale.channelCode,
        count: sale.count || 0,
        feeRate,
      }
    })

    const categorySales: DailyCategorySale[] = (daily.categorySales || []).map((sale: any) => {
      const master = CATEGORY_MASTER.find(m => m.code === sale.categoryCode)
      
      return {
        date,
        categoryCode: sale.categoryCode,
        categoryName: master?.name || sale.categoryName || sale.categoryCode,
        count: sale.count || 0,
      }
    })

    return {
      date,
      channelSales,
      categorySales,
      summary: {
        date,
        onlineCount: 0,
        offlineCount: 0,
        totalCount: 0,
        onlineNetRevenue: 0,
        offlineRevenue: 0,
        totalNetRevenue: 0,
      },
      source: source || 'manual',
    }
  })

  await saveBulkDailyData(year, month, enrichedDataList)

  // 업데이트된 월별 집계 반환
  const monthlyData = await getMonthlyAggData(year, month)

  return NextResponse.json({
    success: true,
    savedCount: enrichedDataList.length,
    monthlyData,
  })
}

