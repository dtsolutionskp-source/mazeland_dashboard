/**
 * 판매 데이터 API
 * - GET: 월별 데이터 조회 + 마스터 데이터
 * - POST: 데이터 저장 (수기 입력 / 혼합)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getMasterData } from '@/lib/master-data'
import { 
  getMonthlyData, 
  saveMonthlyData, 
  getAvailableMonths,
  calculateSummary,
  enrichChannelData,
  enrichCategoryData,
  getUploadData,
} from '@/lib/data-store'
import { calculateSettlement } from '@/lib/settlement'
import { 
  MonthlyAggData, 
  SaveSalesDataRequest, 
  GetSalesDataResponse,
  ChannelSalesData,
  CategorySalesData,
} from '@/types/sales-input'

/**
 * GET - 월별 데이터 조회
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

    // 마스터 데이터
    const masterData = getMasterData()

    // 연/월이 없으면 마스터 데이터만 반환
    if (!yearParam || !monthParam) {
      const availableMonths = await getAvailableMonths()
      
      // 기존 upload-data.json에서 월 정보 추출
      const uploadData = await getUploadData()
      if (uploadData && availableMonths.length === 0) {
        const periodDate = new Date(uploadData.periodStart)
        availableMonths.push({
          year: periodDate.getFullYear(),
          month: periodDate.getMonth() + 1,
        })
      }

      return NextResponse.json({
        success: true,
        data: null,
        masterData,
        availableMonths,
      })
    }

    const year = parseInt(yearParam)
    const month = parseInt(monthParam)

    // 월별 데이터 조회
    let data = await getMonthlyData(year, month)

    // 데이터가 없으면 기존 upload-data.json에서 변환 시도
    if (!data) {
      const uploadData = await getUploadData()
      if (uploadData) {
        const uploadDate = new Date(uploadData.periodStart)
        const uploadYear = uploadDate.getFullYear()
        const uploadMonth = uploadDate.getMonth() + 1

        if (uploadYear === year && uploadMonth === month) {
          // 기존 데이터를 새 형식으로 변환
          data = convertUploadDataToMonthlyAgg(uploadData, year, month)
        }
      }
    }

    // 사용 가능한 월 목록
    const availableMonths = await getAvailableMonths()

    const response: GetSalesDataResponse = {
      success: true,
      data: data || undefined,
      masterData,
    }

    return NextResponse.json({
      ...response,
      availableMonths,
    })
  } catch (error) {
    console.error('[Sales Data API] GET Error:', error)
    return NextResponse.json({ error: '데이터 조회 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

/**
 * POST - 데이터 저장
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    // 권한 확인
    if (!['SUPER_ADMIN', 'SKP_ADMIN'].includes(user.role)) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
    }

    const body: SaveSalesDataRequest = await request.json()
    const { year, month, source, channels, categories, dailyData } = body

    console.log('[Sales Data API] Saving:', { year, month, source })
    console.log('[Sales Data API] Channels:', channels.length)
    console.log('[Sales Data API] Categories:', categories.length)

    // 데이터 검증
    if (!year || !month) {
      return NextResponse.json({ error: '연/월을 선택해주세요.' }, { status: 400 })
    }

    // 채널/카테고리 데이터에 계산 필드 추가
    const enrichedChannels = enrichChannelData(channels)
    const enrichedCategories = enrichCategoryData(categories)

    // 요약 계산
    const summary = calculateSummary(enrichedChannels, enrichedCategories)

    // 정산 계산
    const settlementInput = {
      onlineSales: enrichedChannels.map(ch => ({
        channelCode: ch.channelCode as any,
        channelName: ch.channelName,
        count: ch.count,
      })),
      offlineCount: summary.offlineCount,
    }

    const periodStart = dailyData && dailyData.length > 0 
      ? new Date(dailyData[0].date)
      : new Date(year, month - 1, 1)
    const periodEnd = dailyData && dailyData.length > 0 
      ? new Date(dailyData[dailyData.length - 1].date)
      : new Date(year, month, 0)

    const settlement = calculateSettlement(
      settlementInput,
      undefined,
      periodStart,
      periodEnd
    )

    // MonthlyAggData 생성
    const monthlyData: MonthlyAggData = {
      year,
      month,
      source,
      uploadedAt: new Date().toISOString(),
      channels: enrichedChannels,
      categories: enrichedCategories,
      summary,
      dailyData,
    }

    // 저장
    await saveMonthlyData(monthlyData)

    console.log('[Sales Data API] Saved successfully')
    console.log('[Sales Data API] Summary:', summary)

    return NextResponse.json({
      success: true,
      data: monthlyData,
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
    console.error('[Sales Data API] POST Error:', error)
    return NextResponse.json({ error: '데이터 저장 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

/**
 * 기존 StoredUploadData를 MonthlyAggData로 변환
 */
function convertUploadDataToMonthlyAgg(
  uploadData: any, 
  year: number, 
  month: number
): MonthlyAggData {
  const masterData = getMasterData()

  // channels 객체를 배열로 변환
  const channels: ChannelSalesData[] = masterData.channels.map(master => {
    const data = uploadData.channels?.[master.code]
    return {
      channelCode: master.code,
      channelName: master.name,
      feeRate: master.feeRate,
      count: data?.count || 0,
    }
  })

  // categories 객체를 배열로 변환
  const categories: CategorySalesData[] = masterData.categories.map(master => {
    const data = uploadData.categories?.[master.code]
    return {
      categoryCode: master.code,
      categoryName: master.name,
      count: data?.count || 0,
    }
  })

  // 데이터 보강
  const enrichedChannels = enrichChannelData(channels)
  const enrichedCategories = enrichCategoryData(categories)
  const summary = calculateSummary(enrichedChannels, enrichedCategories)

  return {
    year,
    month,
    source: uploadData.source || 'file',
    uploadedAt: uploadData.uploadedAt,
    channels: enrichedChannels,
    categories: enrichedCategories,
    summary,
    dailyData: uploadData.dailyData,
  }
}

