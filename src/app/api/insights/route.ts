import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getAllDailyDataForMonth } from '@/lib/daily-data-store'
import { getMarketingLogs } from '@/lib/marketing-log-store'
import prisma from '@/lib/prisma'
import OpenAI from 'openai'

// OpenAI 클라이언트 (API 키가 있는 경우에만 사용)
let openai: OpenAI | null = null
try {
  if (process.env.OPENAI_API_KEY) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
} catch (e) {
  console.log('OpenAI initialization skipped')
}

interface InsightRequest {
  type: 'weekly' | 'monthly' | 'channel' | 'custom' | 'ai'
  startDate?: string
  endDate?: string
  customPrompt?: string
  useAI?: boolean
}

// AI 인사이트 생성
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    const body: InsightRequest = await request.json()
    const { type, customPrompt, startDate: reqStartDate, endDate: reqEndDate } = body

    // 클라이언트에서 전달한 날짜 사용 또는 기본값 계산
    let startDate: Date
    let endDate: Date
    let periodLabel: string
    
    if (reqStartDate && reqEndDate) {
      // 클라이언트에서 전달한 날짜 사용
      startDate = new Date(reqStartDate)
      endDate = new Date(reqEndDate)
      periodLabel = calculatePeriodLabel(type, startDate, endDate)
    } else {
      // 기본값: 현재 날짜 기준
      const calculated = calculatePeriod(type)
      startDate = calculated.startDate
      endDate = calculated.endDate
      periodLabel = calculated.periodLabel
    }

    // 데이터 수집
    const salesData = await getSalesDataSummary(startDate, endDate, type)
    const marketingLogs = await getMarketingLogsSummary(startDate, endDate)

    // 데이터가 없는 경우
    if (salesData.totalVisitors === 0) {
      return NextResponse.json({
        insight: generateNoDataInsight(periodLabel, type),
        cached: false,
        period: periodLabel,
      })
    }

    let insight: string

    if (openai && process.env.OPENAI_API_KEY) {
      try {
        // AI 프롬프트 생성
        const prompt = generatePrompt(type, salesData, marketingLogs, periodLabel, customPrompt)
        
        // OpenAI API 호출
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `당신은 메이즈랜드(제주도 테마파크) 마케팅 분석 전문가입니다.
              데이터를 기반으로 인사이트를 도출하고, 실행 가능한 마케팅 제안을 합니다.
              응답은 항상 한국어로 작성하며, 마크다운 형식으로 깔끔하게 정리합니다.`,
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          max_tokens: 1500,
          temperature: 0.7,
        })

        insight = completion.choices[0]?.message?.content || '인사이트를 생성할 수 없습니다.'
      } catch (aiError: any) {
        console.error('OpenAI API error:', aiError)
        
        // 크레딧/쿼터 문제 확인
        const code = aiError?.code || aiError?.error?.code
        const status = aiError?.status
        
        if (status === 429 || code === 'insufficient_quota') {
          insight = generateDefaultInsight(type, salesData, marketingLogs, periodLabel, true)
        } else {
          insight = generateDefaultInsight(type, salesData, marketingLogs, periodLabel, false)
        }
      }
    } else {
      // OpenAI API 키가 없는 경우 기본 인사이트
      insight = generateDefaultInsight(type, salesData, marketingLogs, periodLabel, true)
    }

    return NextResponse.json({
      insight,
      cached: false,
      period: periodLabel,
    })
  } catch (error) {
    console.error('Generate insight error:', error)
    
    // 에러 타입별 분기 처리
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: '잘못된 요청 형식입니다.' },
        { status: 400 }
      )
    }
    
    if (error instanceof TypeError) {
      return NextResponse.json(
        { error: '필수 데이터가 누락되었습니다.' },
        { status: 400 }
      )
    }

    // OpenAI 관련 에러
    if (error && typeof error === 'object' && 'status' in error) {
      const apiError = error as { status: number; message?: string }
      if (apiError.status === 401) {
        return NextResponse.json(
          { error: 'OpenAI API 키가 유효하지 않습니다.' },
          { status: 500 }
        )
      }
      if (apiError.status === 429) {
        return NextResponse.json(
          { error: 'API 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.' },
          { status: 429 }
        )
      }
    }

    return NextResponse.json(
      { error: 'AI 인사이트 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// 클라이언트에서 전달한 날짜로 기간 라벨 생성
function calculatePeriodLabel(type: string, startDate: Date, endDate: Date): string {
  if (type === 'weekly' || type === 'ai') {
    const weekNum = Math.ceil((startDate.getDate() + new Date(startDate.getFullYear(), startDate.getMonth(), 1).getDay()) / 7)
    return `${startDate.getFullYear()}년 ${startDate.getMonth() + 1}월 ${weekNum}주차 (${startDate.getMonth() + 1}/${startDate.getDate()} ~ ${endDate.getMonth() + 1}/${endDate.getDate()})`
  } else if (type === 'monthly' || type === 'channel') {
    return `${startDate.getFullYear()}년 ${startDate.getMonth() + 1}월`
  } else {
    return `${startDate.getMonth() + 1}/${startDate.getDate()} ~ ${endDate.getMonth() + 1}/${endDate.getDate()}`
  }
}

// 분석 유형에 따른 기간 계산 (기본값)
function calculatePeriod(type: string): { startDate: Date; endDate: Date; periodLabel: string } {
  const now = new Date()
  
  if (type === 'weekly') {
    // 이번 주 (일요일~토요일)
    const dayOfWeek = now.getDay()
    const startDate = new Date(now)
    startDate.setDate(now.getDate() - dayOfWeek) // 이번 주 일요일
    startDate.setHours(0, 0, 0, 0)
    
    const endDate = new Date(startDate)
    endDate.setDate(startDate.getDate() + 6) // 이번 주 토요일
    endDate.setHours(23, 59, 59, 999)
    
    const weekNum = Math.ceil((startDate.getDate() + new Date(startDate.getFullYear(), startDate.getMonth(), 1).getDay()) / 7)
    const periodLabel = `${startDate.getFullYear()}년 ${startDate.getMonth() + 1}월 ${weekNum}주차`
    
    return { startDate, endDate, periodLabel }
  } else if (type === 'monthly') {
    // 이번 달
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1)
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
    const periodLabel = `${now.getFullYear()}년 ${now.getMonth() + 1}월`
    
    return { startDate, endDate, periodLabel }
  } else {
    // 채널/맞춤: 최근 30일
    const endDate = new Date(now)
    endDate.setHours(23, 59, 59, 999)
    
    const startDate = new Date(now)
    startDate.setDate(now.getDate() - 30)
    startDate.setHours(0, 0, 0, 0)
    
    const periodLabel = `최근 30일 (${startDate.getMonth() + 1}/${startDate.getDate()} ~ ${endDate.getMonth() + 1}/${endDate.getDate()})`
    
    return { startDate, endDate, periodLabel }
  }
}

// 실제 판매 데이터 조회 (DB 우선, 파일 시스템 fallback)
async function getSalesDataSummary(startDate: Date, endDate: Date, type: string) {
  try {
    // 먼저 DB에서 조회 시도
    const dbResult = await getSalesDataFromDB(startDate, endDate)
    if (dbResult && dbResult.totalVisitors > 0) {
      console.log('[Insights] Data loaded from DB:', dbResult.totalVisitors, 'visitors')
      return dbResult
    }
    
    // DB에 없으면 파일 시스템에서 조회
    console.log('[Insights] Trying file system fallback...')
    return await getSalesDataFromFileSystem(startDate, endDate)
  } catch (e) {
    console.error('Failed to fetch sales data:', e)
    return getEmptySalesData()
  }
}

// DB에서 판매 데이터 조회
async function getSalesDataFromDB(startDate: Date, endDate: Date) {
  try {
    // 해당 기간의 온라인 판매 데이터 조회
    const onlineSales = await prisma.onlineSale.findMany({
      where: {
        saleDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        saleDate: true,
        channel: true,
        channelCode: true,
        quantity: true,
      },
    })

    // 해당 기간의 오프라인 판매 데이터 조회
    const offlineSales = await prisma.offlineSale.findMany({
      where: {
        saleDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        saleDate: true,
        category: true,
        quantity: true,
      },
    })

    if (onlineSales.length === 0 && offlineSales.length === 0) {
      // MonthlySummary에서도 확인
      const year = startDate.getFullYear()
      const month = startDate.getMonth() + 1
      const summary = await prisma.monthlySummary.findFirst({
        where: { year, month },
      })
      
      if (summary) {
        const channelBreakdown = (summary.onlineByChannel as Record<string, number>) || {}
        return {
          totalVisitors: summary.grandTotal,
          onlineCount: summary.onlineTotal,
          offlineCount: summary.offlineTotal,
          avgDaily: Math.round(summary.grandTotal / 30),
          peakDay: { date: '-', count: 0 },
          lowDay: { date: '-', count: 0 },
          channelBreakdown: Object.entries(channelBreakdown)
            .sort((a, b) => (b[1] as number) - (a[1] as number))
            .slice(0, 5)
            .map(([name, count]) => ({
              name,
              count: count as number,
              ratio: summary.grandTotal > 0 ? Math.round(((count as number) / summary.grandTotal) * 1000) / 10 : 0,
            })),
          weekdayAvg: 0,
          weekendAvg: 0,
          growthRate: 0,
          dataCount: 1,
        }
      }
      
      return null
    }

    // 일별 집계
    const dailyData: Record<string, { online: number; offline: number; date: Date }> = {}
    const channelCounts: Record<string, number> = {}

    // 온라인 판매 집계
    for (const sale of onlineSales) {
      const dateKey = sale.saleDate.toISOString().split('T')[0]
      if (!dailyData[dateKey]) {
        dailyData[dateKey] = { online: 0, offline: 0, date: sale.saleDate }
      }
      dailyData[dateKey].online += sale.quantity
      
      const channelName = sale.channel || sale.channelCode
      if (!channelCounts[channelName]) {
        channelCounts[channelName] = 0
      }
      channelCounts[channelName] += sale.quantity
    }

    // 오프라인 판매 집계
    for (const sale of offlineSales) {
      const dateKey = sale.saleDate.toISOString().split('T')[0]
      if (!dailyData[dateKey]) {
        dailyData[dateKey] = { online: 0, offline: 0, date: sale.saleDate }
      }
      dailyData[dateKey].offline += sale.quantity
    }

    // 집계 계산
    let totalOnline = 0
    let totalOffline = 0
    let peakDay = { date: '-', count: 0 }
    let lowDay = { date: '-', count: Infinity }
    let weekdayTotal = 0
    let weekdayDays = 0
    let weekendTotal = 0
    let weekendDays = 0

    for (const [dateKey, data] of Object.entries(dailyData)) {
      const dayTotal = data.online + data.offline
      totalOnline += data.online
      totalOffline += data.offline

      const dayOfWeek = data.date.getDay()
      const dateStr = `${data.date.getMonth() + 1}/${data.date.getDate()}`

      if (dayTotal > peakDay.count) {
        peakDay = { date: dateStr, count: dayTotal }
      }
      if (dayTotal < lowDay.count && dayTotal > 0) {
        lowDay = { date: dateStr, count: dayTotal }
      }

      if (dayOfWeek === 0 || dayOfWeek === 6) {
        weekendTotal += dayTotal
        weekendDays++
      } else {
        weekdayTotal += dayTotal
        weekdayDays++
      }
    }

    const totalVisitors = totalOnline + totalOffline
    const dataCount = Object.keys(dailyData).length

    if (lowDay.count === Infinity) {
      lowDay = { date: '-', count: 0 }
    }

    const channelBreakdown = Object.entries(channelCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({
        name,
        count,
        ratio: totalVisitors > 0 ? Math.round((count / totalVisitors) * 1000) / 10 : 0,
      }))

    return {
      totalVisitors,
      onlineCount: totalOnline,
      offlineCount: totalOffline,
      avgDaily: dataCount > 0 ? Math.round(totalVisitors / dataCount) : 0,
      peakDay,
      lowDay,
      channelBreakdown,
      weekdayAvg: weekdayDays > 0 ? Math.round(weekdayTotal / weekdayDays) : 0,
      weekendAvg: weekendDays > 0 ? Math.round(weekendTotal / weekendDays) : 0,
      growthRate: 0,
      dataCount,
    }
  } catch (dbError) {
    console.error('[Insights] DB query failed:', dbError)
    return null
  }
}

// 파일 시스템에서 판매 데이터 조회 (fallback)
async function getSalesDataFromFileSystem(startDate: Date, endDate: Date) {
  try {
    // 조회해야 할 년월 목록 생성
    const monthsToQuery: { year: number; month: number }[] = []
    const current = new Date(startDate.getFullYear(), startDate.getMonth(), 1)
    const endMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 1)
    
    while (current <= endMonth) {
      monthsToQuery.push({ year: current.getFullYear(), month: current.getMonth() + 1 })
      current.setMonth(current.getMonth() + 1)
    }
    
    // 각 월별 일자 데이터 조회
    const allDailyData: any[] = []
    for (const { year, month } of monthsToQuery) {
      const dailyData = await getAllDailyDataForMonth(year, month)
      allDailyData.push(...dailyData)
    }
    
    // 해당 기간의 데이터만 필터링
    const filteredData = allDailyData.filter(item => {
      const itemDate = new Date(item.date)
      return itemDate >= startDate && itemDate <= endDate
    })
    
    if (filteredData.length === 0) {
      return getEmptySalesData()
    }
    
    // 집계
    let onlineCount = 0
    let offlineCount = 0
    const channelCounts: Record<string, number> = {}
    let peakDay = { date: '', count: 0 }
    let lowDay = { date: '', count: Infinity }
    let weekdayTotal = 0
    let weekdayDays = 0
    let weekendTotal = 0
    let weekendDays = 0
    
    filteredData.forEach(item => {
      const itemDate = new Date(item.date)
      const dayOfWeek = itemDate.getDay()
      const dateStr = `${itemDate.getMonth() + 1}/${itemDate.getDate()}`
      
      // 채널별 집계 (channelSales 배열 사용)
      if (item.channelSales && Array.isArray(item.channelSales)) {
        item.channelSales.forEach((sale: any) => {
          const count = sale.count || 0
          const channelName = sale.channelName || sale.channelCode
          onlineCount += count
          
          if (!channelCounts[channelName]) {
            channelCounts[channelName] = 0
          }
          channelCounts[channelName] += count
        })
      }
      
      // 오프라인 집계 (categorySales 배열 사용)
      if (item.categorySales && Array.isArray(item.categorySales)) {
        item.categorySales.forEach((sale: any) => {
          offlineCount += sale.count || 0
        })
      }
      
      // 일일 합계
      const dayTotal = item.summary?.totalCount || 0
      
      // 최고/최저일
      if (dayTotal > peakDay.count) {
        peakDay = { date: dateStr, count: dayTotal }
      }
      if (dayTotal < lowDay.count && dayTotal > 0) {
        lowDay = { date: dateStr, count: dayTotal }
      }
      
      // 주중/주말 평균
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        weekendTotal += dayTotal
        weekendDays++
      } else {
        weekdayTotal += dayTotal
        weekdayDays++
      }
    })
    
    const totalVisitors = onlineCount + offlineCount
    
    if (lowDay.count === Infinity) {
      lowDay = { date: '-', count: 0 }
    }
    
    // 채널별 정렬
    const channelBreakdown = Object.entries(channelCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({
        name,
        count,
        ratio: totalVisitors > 0 ? Math.round((count / totalVisitors) * 1000) / 10 : 0,
      }))
    
    return {
      totalVisitors,
      onlineCount,
      offlineCount,
      avgDaily: filteredData.length > 0 ? Math.round(totalVisitors / filteredData.length) : 0,
      peakDay,
      lowDay,
      channelBreakdown,
      weekdayAvg: weekdayDays > 0 ? Math.round(weekdayTotal / weekdayDays) : 0,
      weekendAvg: weekendDays > 0 ? Math.round(weekendTotal / weekendDays) : 0,
      growthRate: 0,
      dataCount: filteredData.length,
    }
  } catch (e) {
    console.error('File system fallback failed:', e)
    return getEmptySalesData()
  }
}

// 빈 데이터 반환
function getEmptySalesData() {
  return {
    totalVisitors: 0,
    onlineCount: 0,
    offlineCount: 0,
    avgDaily: 0,
    peakDay: { date: '-', count: 0 },
    lowDay: { date: '-', count: 0 },
    channelBreakdown: [],
    weekdayAvg: 0,
    weekendAvg: 0,
    growthRate: 0,
    dataCount: 0,
  }
}

// 마케팅 로그 요약
async function getMarketingLogsSummary(startDate: Date, endDate: Date) {
  try {
    const allLogs = await getMarketingLogs()
    
    // 해당 기간의 로그만 필터링
    const filteredLogs = allLogs.filter(log => {
      const logStart = new Date(log.startDate)
      const logEnd = new Date(log.endDate)
      return logStart <= endDate && logEnd >= startDate
    })
    
    return filteredLogs.map(log => {
      const logDate = new Date(log.startDate)
      return {
        date: `${logDate.getMonth() + 1}/${logDate.getDate()}`,
        type: log.logType,
        title: log.title || log.subType || '-',
      }
    })
  } catch (e) {
    console.error('Failed to fetch marketing logs:', e)
    return []
  }
}

// 데이터 없음 인사이트
function generateNoDataInsight(periodLabel: string, type: string) {
  const typeLabel = type === 'weekly' ? '주간' : type === 'monthly' ? '월간' : type === 'channel' ? '채널별' : '맞춤'
  
  return `## ${typeLabel} 인사이트 - ${periodLabel}

### ⚠️ 데이터 없음

**${periodLabel}**에 해당하는 판매 데이터가 없습니다.

### 확인 사항
1. 해당 기간에 데이터가 입력되어 있는지 확인해주세요.
2. 데이터 입력 페이지에서 해당 월의 데이터를 업로드해주세요.

### 현재 시스템 상태
- 분석 요청 기간: **${periodLabel}**
- 데이터 조회 결과: 0건

---
💡 *데이터가 있는 기간(예: 2025년 11월, 12월)의 인사이트를 확인하시려면 해당 기간의 데이터를 먼저 조회해주세요.*`
}

// 프롬프트 생성
function generatePrompt(
  type: string,
  salesData: any,
  marketingLogs: any[],
  periodLabel: string,
  customPrompt?: string
) {
  const baseContext = `
## 분석 기간: ${periodLabel}

## 판매 데이터 요약
- 전체 방문객: ${salesData.totalVisitors}명
- 인터넷 판매: ${salesData.onlineCount}명 (${salesData.totalVisitors > 0 ? ((salesData.onlineCount / salesData.totalVisitors) * 100).toFixed(1) : 0}%)
- 현장 판매: ${salesData.offlineCount}명 (${salesData.totalVisitors > 0 ? ((salesData.offlineCount / salesData.totalVisitors) * 100).toFixed(1) : 0}%)
- 일 평균: ${salesData.avgDaily}명
- 최고 기록: ${salesData.peakDay.date} (${salesData.peakDay.count}명)
- 최저 기록: ${salesData.lowDay.date} (${salesData.lowDay.count}명)
- 주중 평균: ${salesData.weekdayAvg}명 / 주말 평균: ${salesData.weekendAvg}명
- 데이터 일수: ${salesData.dataCount}일

## 채널별 현황
${salesData.channelBreakdown.length > 0 
  ? salesData.channelBreakdown.map((c: any) => `- ${c.name}: ${c.count}명 (${c.ratio}%)`).join('\n')
  : '- 채널 데이터 없음'}

## 마케팅 이벤트
${marketingLogs.length > 0 
  ? marketingLogs.map((l: any) => `- ${l.date}: [${l.type}] ${l.title}`).join('\n')
  : '- 해당 기간 마케팅 이벤트 없음'}
`

  switch (type) {
    case 'weekly':
      return `${baseContext}\n\n위 ${periodLabel} 데이터를 바탕으로 이번 주 핵심 인사이트와 다음 주 마케팅 제안을 작성해주세요.`
    case 'monthly':
      return `${baseContext}\n\n위 ${periodLabel} 데이터를 바탕으로 이번 달 종합 분석과 다음 달 전략 방향을 제시해주세요.`
    case 'channel':
      return `${baseContext}\n\n채널별 성과를 분석하고, 채널 최적화 전략을 제안해주세요.`
    case 'custom':
      return `${baseContext}\n\n${customPrompt || '전반적인 인사이트를 제공해주세요.'}`
    default:
      return `${baseContext}\n\n위 데이터를 분석하고 인사이트를 제공해주세요.`
  }
}

// 기본 인사이트 생성 (API 키 없거나 에러 시)
function generateDefaultInsight(
  type: string, 
  salesData: any, 
  marketingLogs: any[], 
  periodLabel: string,
  isQuotaIssue: boolean
) {
  const typeLabel = type === 'weekly' ? '주간' : type === 'monthly' ? '월간' : type === 'channel' ? '채널별' : '맞춤'
  
  const onlineRatio = salesData.totalVisitors > 0 
    ? ((salesData.onlineCount / salesData.totalVisitors) * 100).toFixed(0) 
    : 0
  const offlineRatio = salesData.totalVisitors > 0 
    ? ((salesData.offlineCount / salesData.totalVisitors) * 100).toFixed(0) 
    : 0
  const weekendGrowth = salesData.weekdayAvg > 0 
    ? Math.round((salesData.weekendAvg / salesData.weekdayAvg - 1) * 100) 
    : 0
  
  return `## ${typeLabel} 인사이트 - ${periodLabel}

### 📈 핵심 지표
- **전체 방문객**: ${salesData.totalVisitors.toLocaleString()}명
- **일 평균**: ${salesData.avgDaily}명
- **인터넷/현장 비율**: ${onlineRatio}% / ${offlineRatio}%
- **분석 기간**: ${salesData.dataCount}일

### 🎯 주요 발견
${salesData.weekendAvg > 0 ? `1. **주말 집중 현상**: 주말(${salesData.weekendAvg}명) 평일(${salesData.weekdayAvg}명) 대비 약 ${weekendGrowth}% ${weekendGrowth >= 0 ? '높음' : '낮음'}` : '1. 주중/주말 데이터 분석 필요'}
${salesData.channelBreakdown.length > 0 ? `2. **1위 채널**: ${salesData.channelBreakdown[0]?.name} - 전체의 ${salesData.channelBreakdown[0]?.ratio}% 차지` : '2. 채널 데이터 분석 필요'}
3. **최고/최저 분석**: 
   - 최고일(${salesData.peakDay.date}): ${salesData.peakDay.count}명
   - 최저일(${salesData.lowDay.date}): ${salesData.lowDay.count}명

${salesData.channelBreakdown.length > 0 ? `### 📊 채널별 성과
${salesData.channelBreakdown.map((c: any, i: number) => `${i + 1}. **${c.name}**: ${c.count.toLocaleString()}명 (${c.ratio}%)`).join('\n')}` : ''}

### 💡 추천 액션
1. ${salesData.channelBreakdown.length > 0 ? `${salesData.channelBreakdown[0]?.name} 채널 프로모션 강화` : '주요 채널 파악 후 프로모션 기획'}
2. 평일 방문객 유치를 위한 평일 전용 할인 기획
3. 주말 피크 시간대 운영 인력 보강
4. 시즌별 실내/실외 컨텐츠 균형 조정

${marketingLogs.length > 0 ? `### 📅 해당 기간 마케팅 활동
${marketingLogs.slice(0, 5).map((l: any) => `- **${l.date}** [${l.type}] ${l.title}`).join('\n')}` : '### 📅 마케팅 활동\n- 해당 기간 등록된 마케팅 활동 없음'}

---
⚠️ *OpenAI API 결제/크레딧 부족으로 기본 인사이트를 제공하고 있습니다.*`
}
