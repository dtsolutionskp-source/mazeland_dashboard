import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import OpenAI from 'openai'

// OpenAI 클라이언트 (API 키가 있는 경우에만 사용)
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null

interface InsightRequest {
  type: 'weekly' | 'monthly' | 'channel' | 'custom'
  startDate?: string
  endDate?: string
  customPrompt?: string
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
    const { type, startDate, endDate, customPrompt } = body

    // 캐시 확인
    const cacheKey = `${type}-${startDate || 'default'}-${endDate || 'default'}`
    const cachedInsight = await prisma.aIInsight.findFirst({
      where: {
        insightType: cacheKey,
        expiresAt: { gt: new Date() },
      },
    })

    if (cachedInsight) {
      return NextResponse.json({
        insight: cachedInsight.content,
        cached: true,
      })
    }

    // 데이터 수집 (실제로는 DB에서 가져옴)
    const salesData = await getSalesDataSummary(startDate, endDate)
    const marketingLogs = await getMarketingLogsSummary(startDate, endDate)

    // AI 프롬프트 생성
    const prompt = generatePrompt(type, salesData, marketingLogs, customPrompt)

    let insight: string

    if (openai) {
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
    } else {
      // OpenAI API 키가 없는 경우 기본 인사이트
      insight = generateDefaultInsight(type, salesData, marketingLogs)
    }

    // 캐시 저장 (1시간)
    const now = new Date()
    await prisma.aIInsight.upsert({
      where: {
        periodStart_periodEnd_insightType: {
          periodStart: startDate ? new Date(startDate) : now,
          periodEnd: endDate ? new Date(endDate) : now,
          insightType: cacheKey,
        },
      },
      update: {
        content: insight,
        expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
      },
      create: {
        periodStart: startDate ? new Date(startDate) : now,
        periodEnd: endDate ? new Date(endDate) : now,
        insightType: cacheKey,
        content: insight,
        expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
      },
    })

    return NextResponse.json({
      insight,
      cached: false,
    })
  } catch (error) {
    console.error('Generate insight error:', error)
    return NextResponse.json(
      { error: 'AI 인사이트 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// 판매 데이터 요약 (실제로는 DB에서 가져옴)
async function getSalesDataSummary(startDate?: string, endDate?: string) {
  // 임시 데이터
  return {
    totalVisitors: 2287,
    onlineCount: 830,
    offlineCount: 1457,
    avgDaily: 99,
    peakDay: { date: '11/17', count: 155 },
    lowDay: { date: '11/30', count: 78 },
    channelBreakdown: [
      { name: '네이버 메이즈랜드25년', count: 300, ratio: 36.1 },
      { name: '메이즈랜드 입장권', count: 200, ratio: 24.1 },
      { name: '메이즈랜드 입장권(단품)', count: 180, ratio: 21.7 },
      { name: '일반채널 입장권', count: 150, ratio: 18.1 },
    ],
    weekdayAvg: 95,
    weekendAvg: 132,
    growthRate: 12.5,
  }
}

// 마케팅 로그 요약
async function getMarketingLogsSummary(startDate?: string, endDate?: string) {
  return [
    { date: '11/11', type: 'CAMPAIGN', title: '네이버 쿠폰 이벤트 시작' },
    { date: '11/17', type: 'EVENT', title: '제주 마라톤 대회' },
    { date: '11/24', type: 'WEATHER', title: '기온 급강하' },
  ]
}

// 프롬프트 생성
function generatePrompt(
  type: string,
  salesData: any,
  marketingLogs: any[],
  customPrompt?: string
) {
  const baseContext = `
## 판매 데이터 요약
- 전체 방문객: ${salesData.totalVisitors}명
- 인터넷 판매: ${salesData.onlineCount}명 (${((salesData.onlineCount / salesData.totalVisitors) * 100).toFixed(1)}%)
- 현장 판매: ${salesData.offlineCount}명 (${((salesData.offlineCount / salesData.totalVisitors) * 100).toFixed(1)}%)
- 일 평균: ${salesData.avgDaily}명
- 최고 기록: ${salesData.peakDay.date} (${salesData.peakDay.count}명)
- 최저 기록: ${salesData.lowDay.date} (${salesData.lowDay.count}명)
- 주중 평균: ${salesData.weekdayAvg}명 / 주말 평균: ${salesData.weekendAvg}명
- 전월 대비 성장률: ${salesData.growthRate}%

## 채널별 현황
${salesData.channelBreakdown.map((c: any) => `- ${c.name}: ${c.count}명 (${c.ratio}%)`).join('\n')}

## 마케팅 이벤트
${marketingLogs.map((l: any) => `- ${l.date}: [${l.type}] ${l.title}`).join('\n')}
`

  switch (type) {
    case 'weekly':
      return `${baseContext}\n\n위 데이터를 바탕으로 이번 주 핵심 인사이트와 다음 주 마케팅 제안을 작성해주세요.`
    case 'monthly':
      return `${baseContext}\n\n위 데이터를 바탕으로 이번 달 종합 분석과 다음 달 전략 방향을 제시해주세요.`
    case 'channel':
      return `${baseContext}\n\n채널별 성과를 분석하고, 채널 최적화 전략을 제안해주세요.`
    case 'custom':
      return `${baseContext}\n\n${customPrompt || '전반적인 인사이트를 제공해주세요.'}`
    default:
      return `${baseContext}\n\n위 데이터를 분석하고 인사이트를 제공해주세요.`
  }
}

// 기본 인사이트 생성 (API 키 없을 때)
function generateDefaultInsight(type: string, salesData: any, marketingLogs: any[]) {
  return `## ${type === 'weekly' ? '주간' : type === 'monthly' ? '월간' : type === 'channel' ? '채널별' : ''} 인사이트

### 📈 핵심 지표
- **전체 방문객**: ${salesData.totalVisitors.toLocaleString()}명
- **전월 대비**: ${salesData.growthRate > 0 ? '↑' : '↓'} ${Math.abs(salesData.growthRate)}%
- **인터넷/현장 비율**: ${((salesData.onlineCount / salesData.totalVisitors) * 100).toFixed(0)}% / ${((salesData.offlineCount / salesData.totalVisitors) * 100).toFixed(0)}%

### 🎯 주요 발견
1. **주말 집중 현상**: 주말(${salesData.weekendAvg}명) 평일(${salesData.weekdayAvg}명) 대비 약 ${Math.round((salesData.weekendAvg / salesData.weekdayAvg - 1) * 100)}% 높음
2. **네이버 채널 강세**: 전체 온라인 판매의 36%를 차지하며 1위
3. **최고/최저 분석**: 
   - 최고일(${salesData.peakDay.date}): ${salesData.peakDay.count}명 - 제주 마라톤 대회 영향
   - 최저일(${salesData.lowDay.date}): ${salesData.lowDay.count}명 - 월말 효과

### 💡 추천 액션
1. 네이버 쿠폰 이벤트 효과 검증 후 12월 연장 검토
2. 평일 방문객 유치를 위한 평일 전용 프로모션 기획
3. 날씨 변수 대응을 위한 실내 컨텐츠 강화

### ⚠️ 주의사항
- OpenAI API 키가 설정되지 않아 기본 템플릿 인사이트가 제공됩니다.
- 더 정교한 AI 분석을 원하시면 OPENAI_API_KEY를 설정해주세요.`
}



