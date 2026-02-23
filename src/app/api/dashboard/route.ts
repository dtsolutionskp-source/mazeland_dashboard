import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, getViewableCompanyCodes, canViewAllData } from '@/lib/auth'
import { calculateSettlement } from '@/lib/settlement'
import { getUploadData, getUploadDataByMonth, StoredUploadData } from '@/lib/data-store'
import { getMonthlyAggData, getAvailableMonthsV2 } from '@/lib/daily-data-store'
import { ComparisonData } from '@/types/dashboard'
import { getMarketingLogsByDateRange } from '@/lib/marketing-log-store'

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

    console.log('[Dashboard API] hasDataForMonth:', hasDataForMonth)

    // 데이터가 availableMonths에 없으면 직접 확인
    if (!hasDataForMonth) {
      console.log('[Dashboard API] Month not in available list, checking upload data directly')
      
      // 해당 월의 upload-data에서 확인
      const uploadedData = await getUploadDataByMonth(requestedYear, requestedMonth)
      if (!uploadedData) {
        console.log('[Dashboard API] No upload data found for:', requestedYear, requestedMonth)
        return NextResponse.json(createEmptyResponse(requestedYear, requestedMonth, user, viewableCompanies, canViewAll, availableMonths))
      }
      console.log('[Dashboard API] Found upload data directly:', {
        dailyDataLength: uploadedData.dailyData?.length,
        onlineCount: uploadedData.summary?.onlineCount,
        offlineCount: uploadedData.summary?.offlineCount,
      })
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

    // *** 누적 모드 처리 ***
    if (viewMode === 'cumulative') {
      console.log('[Dashboard API] Cumulative mode: loading 1~', requestedMonth, 'months')
      dataSource = 'cumulative'
      
      // 1월부터 해당 월까지 모든 데이터 합산
      for (let m = 1; m <= requestedMonth; m++) {
        const monthData = await getUploadDataByMonth(requestedYear, m)
        if (monthData) {
          // 일별 데이터 추가
          monthData.dailyData.forEach(d => dailyData.push(d))
          
          // 채널 합산
          Object.entries(monthData.channels).forEach(([code, ch]) => {
            if (!channels[code]) {
              channels[code] = { name: ch.name, count: 0, feeRate: ch.feeRate }
            }
            channels[code].count += ch.count
          })
          
          // 카테고리 합산
          Object.entries(monthData.categories).forEach(([code, cat]) => {
            if (!categories[code]) {
              categories[code] = { name: cat.name, count: 0 }
            }
            categories[code].count += cat.count
          })
          
          if (!uploadedAt) uploadedAt = monthData.uploadedAt
          if (!fileName) fileName = monthData.fileName
        }
      }
      
      // 합계 계산
      totalOnline = Object.values(channels).reduce((sum, ch) => sum + (ch.count || 0), 0)
      totalOffline = Object.values(categories).reduce((sum, cat) => sum + (cat.count || 0), 0)
      totalVisitors = totalOnline + totalOffline
      
      console.log('[Dashboard API] Cumulative totals:', { totalOnline, totalOffline, totalVisitors })
    } else {
      // *** 단일 월 데이터 로드 ***
      const uploadedData = await getUploadDataByMonth(requestedYear, requestedMonth)
      
      if (uploadedData) {
        console.log('[Dashboard API] Using upload data for:', requestedYear, requestedMonth, 'from:', uploadedData.uploadedAt)
        dataSource = 'uploaded'
        uploadedAt = uploadedData.uploadedAt
        fileName = uploadedData.fileName
        
        dailyData = uploadedData.dailyData
        channels = uploadedData.channels
        categories = uploadedData.categories
        settlementCompanies = uploadedData.settlement.companies
        
        // 채널/카테고리 합계를 우선 사용 (월 계 데이터가 더 정확함)
        const channelSum = Object.values(channels).reduce((sum, ch) => sum + (ch.count || 0), 0)
        const categorySum = Object.values(categories).reduce((sum, cat) => sum + (cat.count || 0), 0)
        
        // 일별 데이터에서 합계 계산 (백업용)
        const dailyOnlineSum = dailyData.reduce((sum, d) => sum + (d.online || 0), 0)
        const dailyOfflineSum = dailyData.reduce((sum, d) => sum + (d.offline || 0), 0)
        
        console.log('[Dashboard API] Data sums:', { 
          channelSum, categorySum, 
          dailyOnlineSum, dailyOfflineSum,
          summaryOnline: uploadedData.summary.onlineCount,
          summaryOffline: uploadedData.summary.offlineCount
        })
        
        // 채널/카테고리 합계 > summary > dailyData 순으로 우선순위
        totalOnline = channelSum > 0 ? channelSum : 
                      uploadedData.summary.onlineCount > 0 ? uploadedData.summary.onlineCount : 
                      dailyOnlineSum
        totalOffline = categorySum > 0 ? categorySum : 
                       uploadedData.summary.offlineCount > 0 ? uploadedData.summary.offlineCount : 
                       dailyOfflineSum
        totalVisitors = totalOnline + totalOffline
        
        console.log('[Dashboard API] Final totals:', { totalOnline, totalOffline, totalVisitors })
      }
    }

    // 데이터가 여전히 없으면 빈 응답 (단, dailyData가 있으면 그래프는 표시)
    if (totalVisitors === 0 && dailyData.length === 0) {
      console.log('[Dashboard API] No data found, returning empty response')
      return NextResponse.json(createEmptyResponse(requestedYear, requestedMonth, user, viewableCompanies, canViewAll, availableMonths))
    }
    
    // totalVisitors가 0이어도 dailyData가 있으면 그래프 표시를 위해 계속 진행
    if (totalVisitors === 0 && dailyData.length > 0) {
      console.log('[Dashboard API] totalVisitors is 0 but dailyData exists, continuing with graph data')
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
      // getUploadDataByMonth 사용 (실제 저장된 데이터 사용)
      const prevMonthUploadData = await getUploadDataByMonth(prevYear, prevMonth)
      if (prevMonthUploadData) {
        prevDailyData = prevMonthUploadData.dailyData.map(d => ({
          date: d.date,
          online: d.online,
          offline: d.offline,
          total: d.total,
        }))
        
        // 전월 채널/카테고리에서 합계 계산
        const prevChannelSum = Object.values(prevMonthUploadData.channels).reduce((sum, ch) => sum + (ch.count || 0), 0)
        const prevCategorySum = Object.values(prevMonthUploadData.categories).reduce((sum, cat) => sum + (cat.count || 0), 0)
        const prevTotalOnline = prevChannelSum > 0 ? prevChannelSum : prevMonthUploadData.summary.onlineCount
        const prevTotalOffline = prevCategorySum > 0 ? prevCategorySum : prevMonthUploadData.summary.offlineCount
        
        // 전월 채널별 수수료 계산하여 순매출 계산
        let prevOnlineNetRevenue = 0
        Object.entries(prevMonthUploadData.channels).forEach(([code, ch]) => {
          const revenue = ch.count * 3000
          const fee = Math.round(revenue * ((ch.feeRate || 0) / 100))
          prevOnlineNetRevenue += revenue - fee
        })
        const prevOfflineRevenue = prevTotalOffline * 3000
        
        prevSummary = {
          totalVisitors: prevTotalOnline + prevTotalOffline,
          onlineCount: prevTotalOnline,
          offlineCount: prevTotalOffline,
          totalRevenue: prevOnlineNetRevenue + prevOfflineRevenue,
        }
        console.log('[Dashboard API] Prev month data loaded:', { prevYear, prevMonth, prevSummary })
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

    // 구분별 상세 (매출 정보 포함)
    const categoryDetails = Object.entries(categories).map(([code, data]) => {
      const revenue = data.count * 3000
      return {
        code,
        name: CATEGORY_NAMES[code] || data.name || code,
        count: data.count,
        revenue,
      }
    })

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
      marketingLogs: [], // 아래에서 채움
      settlement: filteredSettlement,
    }

    // 마케팅 로그 불러오기 (해당 월 기준) - JSON 파일 기반
    try {
      const startOfMonth = new Date(requestedYear, requestedMonth - 1, 1)
      const endOfMonth = new Date(requestedYear, requestedMonth, 0, 23, 59, 59)
      
      const marketingLogs = await getMarketingLogsByDateRange(startOfMonth, endOfMonth)
      
      response.marketingLogs = marketingLogs.map(log => ({
        id: log.id,
        logType: log.logType,
        startDate: log.startDate,
        endDate: log.endDate,
        title: log.title,
        content: log.content,
        subType: log.subType,
        impressions: log.impressions,
        clicks: log.clicks,
      }))
      
      console.log('[Dashboard API] Marketing logs loaded:', response.marketingLogs.length)
    } catch (marketingError) {
      console.log('[Dashboard API] Marketing log fetch error:', marketingError)
      // 마케팅 로그 파일이 없어도 진행
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
