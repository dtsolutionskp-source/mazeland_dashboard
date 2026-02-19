import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { 
  getMarketingLogs, 
  createMarketingLog,
  getMarketingLogsByDateRange 
} from '@/lib/marketing-log-store'
import { z } from 'zod'

const createLogSchema = z.object({
  logType: z.enum(['CAMPAIGN', 'PERFORMANCE', 'HOLIDAY']),
  startDate: z.string(),
  endDate: z.string(),
  // 캠페인/연휴용
  title: z.string().optional(),
  content: z.string().optional(),
  // 퍼포먼스용
  subType: z.string().optional(),
  impressions: z.number().optional().default(0),
  clicks: z.number().optional().default(0),
})

// 마케팅 로그 목록 조회
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const logTypeParam = searchParams.get('logType')
    const logType = (logTypeParam === 'CAMPAIGN' || logTypeParam === 'PERFORMANCE' || logTypeParam === 'HOLIDAY') ? logTypeParam : null

    let logs
    if (startDate && endDate) {
      logs = await getMarketingLogsByDateRange(
        new Date(startDate),
        new Date(endDate),
        logType ?? undefined
      )
    } else {
      logs = await getMarketingLogs()
      if (logType) {
        logs = logs.filter(l => l.logType === logType)
      }
    }

    // startDate 기준 내림차순 정렬
    logs.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())

    return NextResponse.json({ logs })
  } catch (error) {
    console.error('Get marketing logs error:', error)
    return NextResponse.json(
      { error: '마케팅 로그 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// 마케팅 로그 생성
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const validatedData = createLogSchema.parse(body)

    const log = await createMarketingLog(
      {
        logType: validatedData.logType,
        startDate: validatedData.startDate,
        endDate: validatedData.endDate,
        title: validatedData.title || undefined,
        content: validatedData.content || undefined,
        subType: validatedData.subType || undefined,
        impressions: validatedData.impressions || 0,
        clicks: validatedData.clicks || 0,
        createdById: user.id,
      },
      { id: user.id, name: user.name, email: user.email }
    )

    return NextResponse.json({ 
      log, 
      message: '마케팅 로그가 등록되었습니다.' 
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }
    
    console.error('Create marketing log error:', error)
    return NextResponse.json(
      { error: '마케팅 로그 등록 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
