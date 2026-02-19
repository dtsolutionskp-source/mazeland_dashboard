import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { 
  getMarketingLogById, 
  updateMarketingLog, 
  deleteMarketingLog 
} from '@/lib/marketing-log-store'
import { z } from 'zod'

const updateLogSchema = z.object({
  logType: z.enum(['CAMPAIGN', 'PERFORMANCE', 'HOLIDAY']).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  title: z.string().optional(),
  content: z.string().optional(),
  subType: z.string().optional(),
  impressions: z.number().optional(),
  clicks: z.number().optional(),
})

// 마케팅 로그 상세 조회
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    const log = await getMarketingLogById(params.id)

    if (!log) {
      return NextResponse.json(
        { error: '마케팅 로그를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    return NextResponse.json({ log })
  } catch (error) {
    console.error('Get marketing log error:', error)
    return NextResponse.json(
      { error: '마케팅 로그 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// 마케팅 로그 수정 (PUT)
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    const existingLog = await getMarketingLogById(params.id)

    if (!existingLog) {
      return NextResponse.json(
        { error: '마케팅 로그를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 본인 작성 또는 관리자만 수정 가능
    if (existingLog.createdById !== user.id && 
        user.role !== 'SUPER_ADMIN' && 
        user.role !== 'SKP_ADMIN') {
      return NextResponse.json(
        { error: '수정 권한이 없습니다.' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validatedData = updateLogSchema.parse(body)

    const log = await updateMarketingLog(params.id, {
      logType: validatedData.logType,
      startDate: validatedData.startDate,
      endDate: validatedData.endDate,
      title: validatedData.title,
      content: validatedData.content,
      subType: validatedData.subType,
      impressions: validatedData.impressions,
      clicks: validatedData.clicks,
    })

    return NextResponse.json({ 
      log,
      message: '마케팅 로그가 수정되었습니다.' 
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }
    
    console.error('Update marketing log error:', error)
    return NextResponse.json(
      { error: '마케팅 로그 수정 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// 마케팅 로그 수정 (PATCH - 호환용)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return PUT(request, { params })
}

// 마케팅 로그 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    const existingLog = await getMarketingLogById(params.id)

    if (!existingLog) {
      return NextResponse.json(
        { error: '마케팅 로그를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 본인 작성 또는 관리자만 삭제 가능
    if (existingLog.createdById !== user.id && 
        user.role !== 'SUPER_ADMIN' && 
        user.role !== 'SKP_ADMIN') {
      return NextResponse.json(
        { error: '삭제 권한이 없습니다.' },
        { status: 403 }
      )
    }

    await deleteMarketingLog(params.id)

    return NextResponse.json({ message: '마케팅 로그가 삭제되었습니다.' })
  } catch (error) {
    console.error('Delete marketing log error:', error)
    return NextResponse.json(
      { error: '마케팅 로그 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
