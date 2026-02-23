import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// 모든 데이터 소스의 현재 상태 확인
export async function GET(request: NextRequest) {
  const result: Record<string, any> = {
    timestamp: new Date().toISOString(),
    database: {},
    summary: {},
  }

  try {
    // 1. DB의 MonthlySummary 목록
    const summaries = await prisma.monthlySummary.findMany({
      select: {
        id: true,
        year: true,
        month: true,
        onlineTotal: true,
        offlineTotal: true,
        grandTotal: true,
        createdAt: true,
        uploadHistoryId: true,
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    })
    result.database.monthlySummaries = summaries
    result.summary.dbSummaryCount = summaries.length

    // 2. DB의 UploadHistory 목록
    const histories = await prisma.uploadHistory.findMany({
      select: {
        id: true,
        fileName: true,
        periodStart: true,
        periodEnd: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })
    result.database.uploadHistories = histories
    result.summary.dbHistoryCount = histories.length

    // 3. DB의 MonthlyAgg 목록
    try {
      const aggs = await prisma.monthlyAgg.findMany({
        select: {
          id: true,
          year: true,
          month: true,
          createdAt: true,
        },
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
      })
      result.database.monthlyAggs = aggs
      result.summary.dbAggCount = aggs.length
    } catch {
      result.database.monthlyAggs = []
      result.summary.dbAggCount = 0
    }

    // 4. DB의 OnlineSale/OfflineSale 수
    const onlineCount = await prisma.onlineSale.count()
    const offlineCount = await prisma.offlineSale.count()
    result.database.onlineSaleCount = onlineCount
    result.database.offlineSaleCount = offlineCount
    
    // 5. 각 UploadHistory별 Sales 개수
    const salesByHistory: Record<string, { online: number; offline: number }> = {}
    for (const history of histories) {
      const historyOnline = await prisma.onlineSale.count({
        where: { uploadHistoryId: history.id },
      })
      const historyOffline = await prisma.offlineSale.count({
        where: { uploadHistoryId: history.id },
      })
      salesByHistory[history.id] = { online: historyOnline, offline: historyOffline }
    }
    result.database.salesByHistory = salesByHistory
    
    // 6. 각 월별 상세 정보 (dailyData 개수 포함)
    const monthlyDetails: any[] = []
    for (const summary of summaries) {
      const history = await prisma.uploadHistory.findUnique({
        where: { id: summary.uploadHistoryId },
        include: {
          onlineSales: { select: { id: true, saleDate: true, quantity: true } },
          offlineSales: { select: { id: true, saleDate: true, quantity: true } },
        },
      })
      
      // 일별 데이터 재구성
      const dailyDates = new Set<string>()
      history?.onlineSales?.forEach(s => dailyDates.add(s.saleDate.toISOString().split('T')[0]))
      history?.offlineSales?.forEach(s => dailyDates.add(s.saleDate.toISOString().split('T')[0]))
      
      monthlyDetails.push({
        year: summary.year,
        month: summary.month,
        onlineTotal: summary.onlineTotal,
        offlineTotal: summary.offlineTotal,
        grandTotal: summary.grandTotal,
        onlineSalesRecords: history?.onlineSales?.length || 0,
        offlineSalesRecords: history?.offlineSales?.length || 0,
        uniqueDates: dailyDates.size,
        sampleDates: Array.from(dailyDates).slice(0, 5),
      })
    }
    result.database.monthlyDetails = monthlyDetails

  } catch (dbError) {
    result.database.error = dbError instanceof Error ? dbError.message : String(dbError)
  }

  return NextResponse.json(result)
}

// 특정 월의 모든 데이터 완전 삭제
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const year = parseInt(searchParams.get('year') || '')
  const month = parseInt(searchParams.get('month') || '')
  const deleteAll = searchParams.get('all') === 'true'

  const result: Record<string, any> = {
    timestamp: new Date().toISOString(),
    deletedItems: [],
    errors: [],
  }

  try {
    if (deleteAll) {
      // 모든 데이터 삭제
      
      // 1. OnlineSale 전체 삭제
      const onlineDeleted = await prisma.onlineSale.deleteMany({})
      result.deletedItems.push({ type: 'OnlineSale', count: onlineDeleted.count })

      // 2. OfflineSale 전체 삭제
      const offlineDeleted = await prisma.offlineSale.deleteMany({})
      result.deletedItems.push({ type: 'OfflineSale', count: offlineDeleted.count })

      // 3. MonthlySummary 전체 삭제
      const summaryDeleted = await prisma.monthlySummary.deleteMany({})
      result.deletedItems.push({ type: 'MonthlySummary', count: summaryDeleted.count })

      // 4. UploadHistory 전체 삭제
      const historyDeleted = await prisma.uploadHistory.deleteMany({})
      result.deletedItems.push({ type: 'UploadHistory', count: historyDeleted.count })

      // 5. MonthlyAgg 전체 삭제
      try {
        const aggDeleted = await prisma.monthlyAgg.deleteMany({})
        result.deletedItems.push({ type: 'MonthlyAgg', count: aggDeleted.count })
      } catch {
        result.deletedItems.push({ type: 'MonthlyAgg', count: 0, note: 'table may not exist' })
      }

      result.message = '모든 DB 데이터가 삭제되었습니다.'
    } else if (year && month) {
      // 특정 월 데이터 삭제
      
      // 1. MonthlySummary 찾기
      const summaries = await prisma.monthlySummary.findMany({
        where: { year, month },
      })

      for (const summary of summaries) {
        // 관련된 OnlineSale 삭제
        const onlineDeleted = await prisma.onlineSale.deleteMany({
          where: { uploadHistoryId: summary.uploadHistoryId },
        })
        result.deletedItems.push({ type: 'OnlineSale', uploadHistoryId: summary.uploadHistoryId, count: onlineDeleted.count })

        // 관련된 OfflineSale 삭제
        const offlineDeleted = await prisma.offlineSale.deleteMany({
          where: { uploadHistoryId: summary.uploadHistoryId },
        })
        result.deletedItems.push({ type: 'OfflineSale', uploadHistoryId: summary.uploadHistoryId, count: offlineDeleted.count })

        // MonthlySummary 삭제
        await prisma.monthlySummary.delete({
          where: { id: summary.id },
        })
        result.deletedItems.push({ type: 'MonthlySummary', id: summary.id })

        // UploadHistory 삭제
        await prisma.uploadHistory.delete({
          where: { id: summary.uploadHistoryId },
        })
        result.deletedItems.push({ type: 'UploadHistory', id: summary.uploadHistoryId })
      }

      // MonthlyAgg 삭제
      try {
        const aggDeleted = await prisma.monthlyAgg.deleteMany({
          where: { year, month },
        })
        result.deletedItems.push({ type: 'MonthlyAgg', count: aggDeleted.count })
      } catch {
        // 테이블이 없을 수 있음
      }

      result.message = `${year}년 ${month}월 DB 데이터가 삭제되었습니다.`
    } else {
      return NextResponse.json({ error: 'year와 month를 지정하거나 all=true를 사용하세요.' }, { status: 400 })
    }
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : String(error))
  }

  return NextResponse.json(result)
}
