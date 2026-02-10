import prisma from '@/lib/prisma'
import { LogType } from '@prisma/client'

export interface MarketingLog {
  id: string
  logType: 'CAMPAIGN' | 'PERFORMANCE'
  startDate: string
  endDate: string
  title?: string
  content?: string
  subType?: string
  impressions: number
  clicks: number
  createdById: string
  createdBy?: {
    name: string
    email: string
  }
  createdAt: string
  updatedAt: string
}

// DB 모델을 인터페이스로 변환
function toMarketingLog(dbLog: any): MarketingLog {
  return {
    id: dbLog.id,
    logType: dbLog.logType as 'CAMPAIGN' | 'PERFORMANCE',
    startDate: dbLog.startDate.toISOString(),
    endDate: dbLog.endDate.toISOString(),
    title: dbLog.title || undefined,
    content: dbLog.content || undefined,
    subType: dbLog.subType || undefined,
    impressions: dbLog.impressions,
    clicks: dbLog.clicks,
    createdById: dbLog.createdById,
    createdBy: dbLog.createdBy ? {
      name: dbLog.createdBy.name,
      email: dbLog.createdBy.email,
    } : undefined,
    createdAt: dbLog.createdAt.toISOString(),
    updatedAt: dbLog.updatedAt.toISOString(),
  }
}

// 마케팅 로그 목록 조회
export async function getMarketingLogs(): Promise<MarketingLog[]> {
  try {
    const logs = await prisma.marketingLog.findMany({
      include: { createdBy: true },
      orderBy: { startDate: 'desc' },
    })
    return logs.map(toMarketingLog)
  } catch (error) {
    console.error('Get marketing logs error:', error)
    return []
  }
}

// 마케팅 로그 생성
export async function createMarketingLog(
  data: Omit<MarketingLog, 'id' | 'createdAt' | 'updatedAt'>,
  user: { id: string; name: string; email: string }
): Promise<MarketingLog> {
  const log = await prisma.marketingLog.create({
    data: {
      logType: data.logType as LogType,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      title: data.title,
      content: data.content,
      subType: data.subType,
      impressions: data.impressions || 0,
      clicks: data.clicks || 0,
      createdById: user.id,
    },
    include: { createdBy: true },
  })
  
  return toMarketingLog(log)
}

// 마케팅 로그 수정
export async function updateMarketingLog(
  id: string,
  data: Partial<Omit<MarketingLog, 'id' | 'createdAt' | 'createdById' | 'createdBy'>>
): Promise<MarketingLog | null> {
  try {
    const log = await prisma.marketingLog.update({
      where: { id },
      data: {
        ...(data.logType && { logType: data.logType as LogType }),
        ...(data.startDate && { startDate: new Date(data.startDate) }),
        ...(data.endDate && { endDate: new Date(data.endDate) }),
        ...(data.title !== undefined && { title: data.title }),
        ...(data.content !== undefined && { content: data.content }),
        ...(data.subType !== undefined && { subType: data.subType }),
        ...(data.impressions !== undefined && { impressions: data.impressions }),
        ...(data.clicks !== undefined && { clicks: data.clicks }),
      },
      include: { createdBy: true },
    })
    return toMarketingLog(log)
  } catch (error) {
    console.error('Update marketing log error:', error)
    return null
  }
}

// 마케팅 로그 삭제
export async function deleteMarketingLog(id: string): Promise<boolean> {
  try {
    await prisma.marketingLog.delete({ where: { id } })
    return true
  } catch (error) {
    console.error('Delete marketing log error:', error)
    return false
  }
}

// 마케팅 로그 단일 조회
export async function getMarketingLogById(id: string): Promise<MarketingLog | null> {
  try {
    const log = await prisma.marketingLog.findUnique({
      where: { id },
      include: { createdBy: true },
    })
    return log ? toMarketingLog(log) : null
  } catch (error) {
    console.error('Get marketing log by id error:', error)
    return null
  }
}

// 기간별 마케팅 로그 조회
export async function getMarketingLogsByDateRange(
  startDate: Date,
  endDate: Date,
  logType?: 'CAMPAIGN' | 'PERFORMANCE'
): Promise<MarketingLog[]> {
  try {
    const logs = await prisma.marketingLog.findMany({
      where: {
        AND: [
          { startDate: { lte: endDate } },
          { endDate: { gte: startDate } },
          ...(logType ? [{ logType: logType as LogType }] : []),
        ],
      },
      include: { createdBy: true },
      orderBy: { startDate: 'desc' },
    })
    return logs.map(toMarketingLog)
  } catch (error) {
    console.error('Get marketing logs by date range error:', error)
    return []
  }
}
