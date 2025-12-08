import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, getViewableCompanyCodes, canViewAllData } from '@/lib/auth'
import { calculateSettlement } from '@/lib/settlement'
import { getUploadData, StoredUploadData } from '@/lib/data-store'
import { getMonthlyAggData, getAvailableMonthsV2 } from '@/lib/daily-data-store'
import { ComparisonData } from '@/types/dashboard'

// 채널명 매핑
const CHANNEL_NAMES: Record<string, string> = {
  NAVER_MAZE_25: '네이버 메이즈랜드25년',
  GENERAL_TICKET: '일반채널 입장권',
  MAZE_TICKET: '메이즈랜드 입장권',
  MAZE_TICKET_SINGLE: '메이즈랜드 입장권(단품)',
  OTHER: '기타',
}

// 구분명 매핑
const CATEGORY_NAMES: Record<string, string> = {
  INDIVIDUAL: '개인',
  TRAVEL_AGENCY: '여행사',
  TAXI: '택시',
  RESIDENT: '도민',
  ALL_PASS: '올패스',
  SHUTTLE_DISCOUNT: '순환버스할인',
  SCHOOL_GROUP: '학단',
  OTHER: '기타',
}

// 전월비 계산 헬퍼
function calculateComparison(current: number, prev: number | null): ComparisonData | null {
  if (prev === null || prev === 0) return null
  
  const diff = current - prev
  const percent = (diff / prev) * 100
  
  return {
    value: diff,
    type: diff > 0 ? 'increase' : diff < 0 ? 'decrease' : 'same',
    percent: Math.abs(percent),
  }
}

// 빈 응답 데이터 생성
function createEmptyResponse(year: number, month: number, user: any, viewableCompanies: string[], canViewAll: boolean, availableMonths: any[]) {
  return {
    dataSource: 'none',
    uploadedAt: null,
    fileName: null,
    year,
    month,
    viewMode: 'single',
    availableMonths,
    user: {
      role: user.role,
      company: user.company,
      canViewAll,
    },
    summary: {
      totalVisitors: 0,
      onlineCount: 0,
      offlineCount: 0,
      onlineRatio: '0',
      offlineRatio: '0',
      totalRevenue: 0,
      totalFee: 0,
      totalNetRevenue: 0,
    },
    prevSummary: null,
    comparison: null,
    dailyTrend: [],
    prevDailyTrend: null,
    channels: [],
    categories: [],
    marketingLogs: [],
    settlement: [],
  }
}

export async function GET(request: NextRequest) {
  console.log('[Dashboard API] ===== Request received =====')
  try {
    const user = await getCurrentUser()
    console.log('[Dashboard API] User:', user?.email, user?.role)
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    // URL 파라미터 파싱
    const { searchParams } = new URL(request.url)
    const yearParam = searchParams.get('year')
    const monthParam = searchParams.get('month')
    const viewMode = searchParams.get('viewMode') || 'single'

    // 요청된 연/월 (기본값: 현재 날짜 기준)
    const now = new Date()
    const requestedYear = yearParam ? parseInt(yearParam) : now.getFullYear()
    const requestedMonth = monthParam ? parseInt(monthParam) : now.getMonth() + 1

    console.log('[Dashboard API] Requested:', { year: requestedYear, month: requestedMonth, viewMode })

    const viewableCompanies = getViewableCompanyCodes(user.role, user.company?.code)
    const canViewAll = canViewAllData(user.role)

    // 사용 가능한 월 목록 가져오기
    const availableMonths = await getAvailableMonthsV2()
    console.log('[Dashboard API] Available months:', availableMonths)

    // 해당 월에 데이터가 있는지 확인
    const hasDataForMonth = availableMonths.some(
      m => m.year === requestedYear && m.month === requestedMonth
    )

    // 데이터가 없으면 빈 응답 반환
    if (!hasDataForMonth) {
      console.log('[Dashboard API] No data for requested month, returning empty response')
      
      // 기존 upload-data.json에서도 확인
      const uploadedData = await getUploadData()
      if (uploadedData) {
        const uploadDate = new Date(uploadedData.periodStart)
        const uploadYear = uploadDate.getFullYear()
        const uploadMonth = uploadDate.getMonth() + 1
        
        if (uploadYear !== requestedYear || uploadMonth !== requestedMonth) {
          console.log('[Dashboard API] Upload data is for different month:', uploadYear, uploadMonth)
          return NextResponse.json(createEmptyResponse(requestedYear, requestedMonth, user, viewableCompanies, canViewAll, availableMonths))
        }
      } else {
        return NextResponse.json(createEmptyResponse(requestedYear, requestedMonth, user, viewableCompanies, canViewAll, availableMonths))
      }
    }

    // 해당 월 데이터 로드
    let dailyData: { date: string; online: number; offline: number; total: number }[] = []
    let channels: Record<string, { name: string; count: number; feeRate: number }> = {}
    let categories: Record<string, { name: string; count: number }> = {}
    let totalOnline = 0
    let totalOffline = 0
    let totalVisitors = 0
    let settlementCompanies: any[] = []
    let dataSource = 'none'
    let uploadedAt: string | null = null
    let fileName: string | null = null

    // *** upload-data.json을 우선적으로 확인 (사용자가 수정한 정확한 총계 유지) ***
    const uploadedData = await getUploadData()
    
    if (uploadedData) {
      const uploadDate = new Date(uploadedData.periodStart)
      const uploadYear = uploadDate.getFullYear()
      const uploadMonth = uploadDate.getMonth() + 1
      
      // 요청된 연/월과 일치하는지 확인
      if (uploadYear === requestedYear && uploadMonth === requestedMonth) {
        console.log('[Dashboard API] Using upload data from:', uploadedData.uploadedAt)
        dataSource = 'uploaded'
        uploadedAt = uploadedData.uploadedAt
        fileName = uploadedData.fileName
        
        dailyData = uploadedData.dailyData
        channels = uploadedData.channels
        categories = uploadedData.categories
        totalOnline = uploadedData.summary.onlineCount
        totalOffline = uploadedData.summary.offlineCount
        totalVisitors = uploadedData.summary.totalCount
        settlementCompanies = uploadedData.settlement.companies
        
        console.log('[Dashboard API] Loaded totals:', { totalOnline, totalOffline, totalVisitors })
      }
    }

    // 데이터가 여전히 없으면 빈 응답
    if (totalVisitors === 0) {
      console.log('[Dashboard API] No data found, returning empty response')
      return NextResponse.json(createEmptyResponse(requestedYear, requestedMonth, user, viewableCompanies, canViewAll, availableMonths))
    }

    // 정산 계산 (아직 없는 경우)
    if (settlementCompanies.length === 0) {
      const settlementInput = {
        onlineSales: Object.entries(channels).map(([code, data]) => ({
          channelCode: code as any,
          channelName: data.name,
          count: data.count,
        })),
        offlineCount: totalOffline,
      }
      const settlement = calculateSettlement(
        settlementInput,
        undefined,
        new Date(requestedYear, requestedMonth - 1, 1),
        new Date(requestedYear, requestedMonth, 0)
      )
      settlementCompanies = settlement.settlements.map(s => ({
        name: s.companyName,
        code: s.companyCode,
        revenue: s.revenue,
        income: s.income,
        cost: s.cost,
        profit: s.profit,
        profitRate: s.profitRate,
      }))
    }

    // 전월 데이터 확인 (실제 데이터가 있는 경우만)
    const prevMonth = requestedMonth === 1 ? 12 : requestedMonth - 1
    const prevYear = requestedMonth === 1 ? requestedYear - 1 : requestedYear
    
    let prevDailyData: typeof dailyData | null = null
    let prevSummary: { totalVisitors: number; onlineCount: number; offlineCount: number; totalRevenue: number } | null = null
    
    // 전월에 실제 데이터가 있는지 확인
    const hasPrevMonthData = availableMonths.some(
      m => m.year === prevYear && m.month === prevMonth
    )
    
    if (hasPrevMonthData) {
      const prevMonthData = await getMonthlyAggData(prevYear, prevMonth)
      if (prevMonthData && prevMonthData.summary.totalCount > 0) {
        prevDailyData = prevMonthData.dailyData.map(d => ({
          date: d.date,
          online: d.summary?.onlineCount || 0,
          offline: d.summary?.offlineCount || 0,
          total: d.summary?.totalCount || 0,
        }))
        
        const prevOnlineNet = prevMonthData.summary.onlineNetRevenue || 0
        const prevOfflineRev = prevMonthData.summary.offlineRevenue || prevMonthData.summary.offlineCount * 3000
        
        prevSummary = {
          totalVisitors: prevMonthData.summary.totalCount,
          onlineCount: prevMonthData.summary.onlineCount,
          offlineCount: prevMonthData.summary.offlineCount,
          totalRevenue: prevOnlineNet + prevOfflineRev,
        }
      }
    }

    // 채널별 상세 (수수료 적용)
    const channelDetails = Object.entries(channels).map(([code, data]) => {
      const revenue = data.count * 3000
      const fee = Math.round(revenue * (data.feeRate / 100))
      return {
        code,
        name: CHANNEL_NAMES[code] || data.name || code,
        count: data.count,
        revenue,
        feeRate: data.feeRate,
        fee,
        netRevenue: revenue - fee,
      }
    })

    // 총 매출 계산 (수수료 차감 후 = SKP 매출)
    const onlineNetRevenue = channelDetails.reduce((sum, ch) => sum + ch.netRevenue, 0)
    const offlineRevenue = totalOffline * 3000
    const totalRevenue = onlineNetRevenue + offlineRevenue

    // 구분별 상세
    const categoryDetails = Object.entries(categories).map(([code, data]) => ({
      code,
      name: CATEGORY_NAMES[code] || data.name || code,
      count: data.count,
    }))

    // 역할별 데이터 필터링
    const filteredSettlement = settlementCompanies
      .filter(s => viewableCompanies.includes(s.code))
      .map(s => {
        const normalized = {
          companyName: s.companyName || s.name,
          companyCode: s.companyCode || s.code,
          revenue: s.revenue,
          income: s.income,
          cost: s.cost,
          profit: s.profit,
          profitRate: s.profitRate,
        }
        
        if (!canViewAll && normalized.companyCode !== user.company?.code) {
          return {
            ...normalized,
            cost: 0,
            income: normalized.revenue,
          }
        }
        return normalized
      })

    // 전월비 계산 (전월 데이터가 있는 경우만)
    const comparison = prevSummary ? {
      totalVisitors: calculateComparison(totalVisitors, prevSummary.totalVisitors),
      onlineCount: calculateComparison(totalOnline, prevSummary.onlineCount),
      offlineCount: calculateComparison(totalOffline, prevSummary.offlineCount),
      totalRevenue: calculateComparison(totalRevenue, prevSummary.totalRevenue),
    } : null

    // 응답 데이터 구성
    const response: any = {
      dataSource,
      uploadedAt,
      fileName,
      year: requestedYear,
      month: requestedMonth,
      viewMode,
      availableMonths,
      user: {
        role: user.role,
        company: user.company,
        canViewAll,
      },
      summary: {
        totalVisitors,
        onlineCount: totalOnline,
        offlineCount: totalOffline,
        onlineRatio: totalVisitors > 0 ? ((totalOnline / totalVisitors) * 100).toFixed(1) : '0',
        offlineRatio: totalVisitors > 0 ? ((totalOffline / totalVisitors) * 100).toFixed(1) : '0',
        totalRevenue,
        totalFee: channelDetails.reduce((sum, ch) => sum + ch.fee, 0),
        totalNetRevenue: totalRevenue,
      },
      prevSummary,
      comparison,
      dailyTrend: dailyData.map(d => ({
        ...d,
        dateLabel: d.date.slice(5).replace('-', '/'),
      })),
      prevDailyTrend: prevDailyData?.map(d => ({
        ...d,
        dateLabel: d.date.slice(5).replace('-', '/'),
      })) || null,
      channels: channelDetails,
      categories: categoryDetails,
      marketingLogs: [],
      settlement: filteredSettlement,
    }

    // 채널별 수수료 적용 계산 함수 (모든 역할에서 사용)
    const calcWithFee = (baseAmount: number) => {
      const onlineTotal = channelDetails.reduce((sum, ch) => {
        const multiplier = 1 - (ch.feeRate || 0) / 100
        return sum + Math.round(baseAmount * multiplier * ch.count)
      }, 0)
      const offlineTotal = baseAmount * totalOffline
      return onlineTotal + offlineTotal
    }

    // 역할별 추가 데이터
    switch (user.role) {
      case 'SUPER_ADMIN':
      case 'SKP_ADMIN':
        const skp = settlementCompanies.find(s => s.code === 'SKP')
        const agency = settlementCompanies.find(s => s.code === 'AGENCY')
        
        // SKP 지급비용 계산 (수수료 차감 적용)
        const skpToMaze = calcWithFee(1000)      // SKP → 메이즈랜드 (1,000원/인)
        const skpToCulture = calcWithFee(500)    // SKP → 컬처커넥션 (500원/인)
        const platformFeeIncome = calcWithFee(200)  // 컬처 → SKP 플랫폼료 (200원/인)
        
        response.skpDetails = {
          grossRevenue: totalRevenue,
          channelFees: channelDetails.reduce((sum, ch) => sum + ch.fee, 0),
          netRevenue: totalRevenue,
          mazePayment: skpToMaze,
          culturePayment: skpToCulture,
          agencyPayment: agency?.revenue || 0,
          totalCost: skpToMaze + skpToCulture + (agency?.revenue || 0),
          platformFeeIncome,
          profit: skp?.profit || 0,
        }
        response.channelMargins = channelDetails.map(ch => ({
          name: ch.name,
          margin: ch.revenue > 0 ? ((ch.netRevenue / ch.revenue) * 100).toFixed(1) : '0',
          netRevenue: ch.netRevenue,
        }))
        break

      case 'MAZE_ADMIN':
        // 메이즈랜드도 수수료 적용
        const mazeFromSkp = calcWithFee(1000)      // SKP에서 받음 (1,000원/인)
        const mazeToCulture = calcWithFee(500)     // 컬처에 지급 (500원/인)
        const mazeProfit = mazeFromSkp - mazeToCulture
        
        response.mazeDetails = {
          revenue: mazeFromSkp,
          culturePayment: mazeToCulture,
          profit: mazeProfit,
          profitRate: mazeFromSkp > 0 ? Math.round((mazeProfit / mazeFromSkp) * 100) : 0,
          visitorBreakdown: { online: totalOnline, offline: totalOffline },
        }
        break

      case 'CULTURE_ADMIN':
        // 컬처커넥션도 수수료 적용
        const cultureFromSkp = calcWithFee(500)      // SKP에서 받음 (500원/인)
        const cultureFromMaze = calcWithFee(500)     // 메이즈에서 받음 (500원/인)
        const cultureTotalRevenue = cultureFromSkp + cultureFromMaze
        const culturePlatformFee = calcWithFee(200)  // SKP에 플랫폼료 지급 (200원/인)
        const cultureNetProfit = cultureTotalRevenue - culturePlatformFee
        
        response.cultureDetails = {
          revenueFromSkp: cultureFromSkp,
          revenueFromMaze: cultureFromMaze,
          totalRevenue: cultureTotalRevenue,
          platformFeePayout: culturePlatformFee,
          profit: cultureNetProfit,
          profitRate: cultureTotalRevenue > 0 ? Math.round((cultureNetProfit / cultureTotalRevenue) * 100) : 0,
        }
        break

      case 'AGENCY_ADMIN':
        const skpForAgency = settlementCompanies.find(s => s.code === 'SKP')
        const agencyFee = Math.round((skpForAgency?.profit || 0) * 0.2)
        response.agencyDetails = {
          basedOn: 'SKP 티켓 순이익의 20%',
          skpProfit: canViewAll ? skpForAgency?.profit : '****',
          agencyFeeRate: 20,
          agencyFee,
          topChannels: channelDetails
            .sort((a, b) => b.count - a.count)
            .slice(0, 5)
            .map(ch => ({ name: ch.name, count: ch.count })),
        }
        break
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Dashboard API error:', error)
    return NextResponse.json({ error: '대시보드 데이터 조회 중 오류' }, { status: 500 })
  }
}
