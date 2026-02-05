import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canUploadData } from '@/lib/auth'
import { saveUploadData, getUploadData, StoredUploadData } from '@/lib/data-store'
import { calculateSettlement } from '@/lib/settlement'
import { 
  getChannelByCode, 
  getCategoryByCode,
  getActiveChannels,
  getActiveCategories,
} from '@/lib/master-data'

// 로컬 타입 정의
type DataSource = 'file' | 'manual' | 'mixed' | 'FILE' | 'MANUAL' | 'MIXED'

interface ManualInputData {
  year: number
  month: number
  source: DataSource
  internetSales: { channelCode: string; count: number }[]
  onsiteSales: { categoryCode: string; count: number }[]
}

const BASE_PRICE = 3000
const MAZE_UNIT = 1000
const CULTURE_UNIT = 1000
const PLATFORM_FEE_UNIT = 200

/**
 * GET /api/sales/monthly
 * 월별 판매 데이터 조회
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString())
    const month = parseInt(searchParams.get('month') || (new Date().getMonth() + 1).toString())

    // 저장된 데이터 조회
    const uploadedData = await getUploadData()
    
    if (!uploadedData) {
      // 데이터 없으면 빈 데이터 반환
      return NextResponse.json({
        success: true,
        exists: false,
        year,
        month,
        data: null,
        channels: getActiveChannels(),
        categories: getActiveCategories(),
      })
    }

    // 채널별/구분별 데이터 구성
    const channels = getActiveChannels()
    const categories = getActiveCategories()

    const internetSales = channels.map(ch => ({
      channelCode: ch.code,
      channelName: ch.name,
      feeRate: ch.defaultFeeRate,
      count: uploadedData.channels?.[ch.code]?.count || 0,
    }))

    const onsiteSales = categories.map(cat => ({
      categoryCode: cat.code,
      categoryName: cat.name,
      count: uploadedData.categories?.[cat.code]?.count || 0,
    }))

    return NextResponse.json({
      success: true,
      exists: true,
      year,
      month,
      source: uploadedData.fileName?.includes('수기') ? 'MANUAL' : 
              uploadedData.fileName?.includes('수정') ? 'MIXED' : 'FILE',
      uploadedAt: uploadedData.uploadedAt,
      fileName: uploadedData.fileName,
      data: {
        internetSales,
        onsiteSales,
        summary: uploadedData.summary,
        settlement: uploadedData.settlement,
      },
      channels,
      categories,
    })
  } catch (error) {
    console.error('[Sales/Monthly GET] Error:', error)
    return NextResponse.json({ error: '데이터 조회 실패' }, { status: 500 })
  }
}

/**
 * POST /api/sales/monthly
 * 수기 입력 또는 혼합 데이터 저장
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    if (!canUploadData(user.role)) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
    }

    const body: ManualInputData = await request.json()
    const { year, month, source, internetSales, onsiteSales } = body

    console.log('[Sales/Monthly POST] Saving data:', { year, month, source })

    // 인터넷 판매 합계
    const onlineCount = internetSales.reduce((sum, s) => sum + (s.count || 0), 0)
    
    // 현장 판매 합계
    const offlineCount = onsiteSales.reduce((sum, s) => sum + (s.count || 0), 0)
    
    const totalCount = onlineCount + offlineCount

    // 채널별 데이터 구성
    const channelsData: Record<string, { name: string; count: number; feeRate: number }> = {}
    for (const sale of internetSales) {
      const channel = getChannelByCode(sale.channelCode)
      if (channel) {
        channelsData[sale.channelCode] = {
          name: channel.name,
          count: sale.count || 0,
          feeRate: channel.defaultFeeRate,
        }
      }
    }

    // 구분별 데이터 구성
    const categoriesData: Record<string, { name: string; count: number }> = {}
    for (const sale of onsiteSales) {
      const category = getCategoryByCode(sale.categoryCode)
      if (category) {
        categoriesData[sale.categoryCode] = {
          name: category.name,
          count: sale.count || 0,
        }
      }
    }

    // 매출 계산
    let onlineNetRevenue = 0
    let onlineGrossRevenue = 0
    let onlineFee = 0

    for (const [code, data] of Object.entries(channelsData)) {
      const feeRate = data.feeRate / 100
      const gross = BASE_PRICE * data.count
      const fee = Math.round(gross * feeRate)
      const net = gross - fee

      onlineGrossRevenue += gross
      onlineFee += fee
      onlineNetRevenue += net
    }

    const offlineRevenue = offlineCount * BASE_PRICE
    const totalNet = onlineNetRevenue + offlineRevenue

    // 정산 계산
    const settlementInput = {
      onlineSales: Object.entries(channelsData).map(([code, data]) => ({
        channelCode: code as any,
        channelName: data.name,
        count: data.count,
      })),
      offlineCount,
    }

    const periodStart = new Date(year, month - 1, 1)
    const periodEnd = new Date(year, month, 0)

    const settlement = calculateSettlement(
      settlementInput,
      undefined,
      periodStart,
      periodEnd
    )

    // 일별 데이터 (수기 입력은 일별 데이터 없음 - 월 합계만)
    const dailyData: any[] = []

    // 저장 데이터 구성
    const sourceLabel = source === 'FILE' ? '' : source === 'MANUAL' ? '_수기입력' : '_수정데이터'
    const storedData: StoredUploadData = {
      uploadedAt: new Date().toISOString(),
      fileName: `${year}년_${month}월${sourceLabel}.xlsx`,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      summary: {
        onlineCount,
        offlineCount,
        totalCount,
      },
      dailyData,
      channels: channelsData,
      categories: categoriesData,
      monthly: {
        onlineByChannel: Object.fromEntries(
          Object.entries(channelsData).map(([code, data]) => [code, data.count])
        ),
        onlineByAge: {},
        offlineByCategory: Object.fromEntries(
          Object.entries(categoriesData).map(([code, data]) => [code, data.count])
        ),
        revenue: {
          online: onlineGrossRevenue,
          onlineFee,
          onlineNet: onlineNetRevenue,
          offline: offlineRevenue,
          total: onlineGrossRevenue + offlineRevenue,
          totalNet,
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

    // 저장
    await saveUploadData(storedData)

    console.log('[Sales/Monthly POST] Data saved successfully')
    console.log('[Sales/Monthly POST] Summary:', storedData.summary)
    console.log('[Sales/Monthly POST] Settlement:', storedData.settlement.companies.map(c => ({
      name: c.name,
      revenue: c.revenue,
      profit: c.profit,
    })))

    return NextResponse.json({
      success: true,
      message: '데이터가 저장되었습니다.',
      summary: storedData.summary,
      settlement: storedData.settlement,
      revenue: storedData.monthly.revenue,
    })
  } catch (error) {
    console.error('[Sales/Monthly POST] Error:', error)
    return NextResponse.json({ error: '데이터 저장 실패' }, { status: 500 })
  }
}

