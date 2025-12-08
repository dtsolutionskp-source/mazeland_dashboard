import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createLogSchema = z.object({
  logDate: z.string().transform(s => new Date(s)),
  logType: z.enum(['CAMPAIGN', 'WEATHER', 'EVENT', 'MAINTENANCE', 'OTHER']),
  title: z.string().min(1, '제목을 입력해주세요'),
  content: z.string().min(1, '내용을 입력해주세요'),
  impact: z.string().optional(),
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
    const logType = searchParams.get('logType')

    const where: any = {}
    
    if (startDate && endDate) {
      where.logDate = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      }
    }
    
    if (logType && logType !== 'ALL') {
      where.logType = logType
    }

    const logs = await prisma.marketingLog.findMany({
      where,
      orderBy: { logDate: 'desc' },
      include: {
        createdBy: {
          select: { name: true, email: true },
        },
      },
    })

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

    const log = await prisma.marketingLog.create({
      data: {
        ...validatedData,
        createdById: user.id,
      },
      include: {
        createdBy: {
          select: { name: true, email: true },
        },
      },
    })

    return NextResponse.json({ log, message: '마케팅 로그가 등록되었습니다.' })
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



