import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canUploadData } from '@/lib/auth'
import { parseExcelFile, ParseResult } from '@/lib/excel-parser'
import { calculateSettlement } from '@/lib/settlement'
import { prisma } from '@/lib/prisma'
import { saveUploadData, getUploadData, getUploadDataByMonth, StoredUploadData } from '@/lib/data-store'

// 청크 사이즈 (bulk insert 시 한 번에 처리할 레코드 수)
const CHUNK_SIZE = 500

// 기본 티켓 가격
const BASE_PRICE = 3000

// 채널별 수수료율
function getChannelFeeRate(channelCode: string): number {
  const rates: Record<string, number> = {
    'NAVER_MAZE_25': 10,
    'MAZE_TICKET': 12,
    'MAZE_TICKET_SINGLE': 12,
    'MAZE_25_SPECIAL': 10,  // 25특가
    'GENERAL_TICKET': 15,
    'OTHER': 15,
  }
  return rates[channelCode] || 15
}

/**
 * 배열을 청크로 분할
 */
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}

/**
 * 엑셀 파일 업로드 및 처리
 */
export async function POST(request: NextRequest) {
  try {
    // 1. 인증 확인
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    // 2. 권한 확인
    if (!canUploadData(user.role)) {
      return NextResponse.json(
        { error: '데이터 업로드 권한이 없습니다.' },
        { status: 403 }
      )
    }

    // 3. 파일 받기
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json(
        { error: '파일이 제공되지 않았습니다.' },
        { status: 400 }
      )
    }

    // 4. 파일 타입 검증
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ]
    if (!validTypes.includes(file.type) && !file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      return NextResponse.json(
        { error: '엑셀 파일(.xlsx, .xls)만 업로드 가능합니다.' },
        { status: 400 }
      )
    }

    // 5. 파일 읽기 및 파싱
    const buffer = await file.arrayBuffer()
    const parseResult = parseExcelFile(buffer)
    
    if (!parseResult.success) {
      return NextResponse.json(
        { 
          error: '파일 파싱 실패',
          details: parseResult.errors,
        },
        { status: 400 }
      )
    }

    // 6. DB 저장 시도
    let uploadHistoryId: string | null = null
    let dbSaveSuccess = false

    try {
      // DB 연결 테스트
      if (prisma && typeof prisma.uploadHistory?.create === 'function') {
        // 트랜잭션으로 처리
        const result = await saveToDatabase(parseResult, file, user.id)
        uploadHistoryId = result.uploadHistoryId
        dbSaveSuccess = true
      }
    } catch (dbError) {
      console.log('DB 저장 실패, 파싱 결과만 반환:', dbError)
    }

    // 7. 파서 결과에서 데이터 추출 (이제 파서가 일별 데이터에서 직접 계산함)
    console.log('[Upload] Step 7: Extracting parser results')
    const { monthlySummary, onlineSales, offlineSales } = parseResult
    
    console.log('[Upload] Parser results:')
    console.log('  - Online total:', monthlySummary.onlineTotal)
    console.log('  - Online by channel:', JSON.stringify(monthlySummary.onlineByChannel))
    console.log('  - Offline total:', monthlySummary.offlineTotal)
    console.log('  - Offline by category:', JSON.stringify(monthlySummary.offlineByCategory))
    console.log('  - Online sales records:', onlineSales.length)
    console.log('  - Offline sales records:', offlineSales.length)

    // 7.5. 기존 데이터 로드하여 겹치는 날짜 확인 (해당 월만)
    console.log('[Upload] Step 7.5: Loading existing data for target month')
    let existingData = null
    let existingDates: string[] = []
    let overlappingDates: string[] = []
    
    // 파싱된 데이터의 연/월 추출
    const targetYear = monthlySummary.year
    const targetMonth = monthlySummary.month
    console.log('[Upload] Target year/month:', targetYear, targetMonth)
    
    try {
      // 해당 월의 데이터만 확인
      existingData = await getUploadDataByMonth(targetYear, targetMonth)
      if (existingData && existingData.dailyData) {
        existingDates = existingData.dailyData.map(d => d.date)
        console.log('[Upload] Existing dates count for', targetYear, targetMonth, ':', existingDates.length)
      } else {
        console.log('[Upload] No existing data found for', targetYear, targetMonth)
      }
    } catch (e) {
      console.log('[Upload] Error loading existing data (continuing without):', e)
    }

    // 8. 일별 데이터 집계 (대시보드용 + 일자별 채널/카테고리별 상세)
    interface DailyDataWithDetails {
      date: string
      online: number
      offline: number
      total: number
      channelData?: Record<string, { count: number; feeRate: number }>
      categoryData?: Record<string, { count: number }>
    }
    
    const dailyDataMap = new Map<string, DailyDataWithDetails>()
    
    for (const sale of onlineSales) {
      const dateKey = sale.saleDate.toISOString().split('T')[0]
      const existing = dailyDataMap.get(dateKey) || { 
        date: dateKey, 
        online: 0, 
        offline: 0, 
        total: 0,
        channelData: {},
        categoryData: {},
      }
      existing.online += sale.quantity
      existing.total += sale.quantity
      
      // 채널별 일별 집계
      if (!existing.channelData) existing.channelData = {}
      if (!existing.channelData[sale.channelCode]) {
        existing.channelData[sale.channelCode] = { count: 0, feeRate: sale.feeRate }
      }
      existing.channelData[sale.channelCode].count += sale.quantity
      
      dailyDataMap.set(dateKey, existing)
    }
    
    for (const sale of offlineSales) {
      const dateKey = sale.saleDate.toISOString().split('T')[0]
      const existing = dailyDataMap.get(dateKey) || { 
        date: dateKey, 
        online: 0, 
        offline: 0, 
        total: 0,
        channelData: {},
        categoryData: {},
      }
      existing.offline += sale.quantity
      existing.total += sale.quantity
      
      // 카테고리별 일별 집계
      if (!existing.categoryData) existing.categoryData = {}
      if (!existing.categoryData[sale.categoryCode]) {
        existing.categoryData[sale.categoryCode] = { count: 0 }
      }
      existing.categoryData[sale.categoryCode].count += sale.quantity
      
      dailyDataMap.set(dateKey, existing)
    }
    
    console.log('[Upload] Daily data with channel/category details:', 
      Array.from(dailyDataMap.entries()).slice(0, 3).map(([date, data]) => ({
        date,
        online: data.online,
        offline: data.offline,
        channels: data.channelData,
        categories: data.categoryData,
      }))
    )
    
    // 겹치는 날짜 확인
    const newDates = Array.from(dailyDataMap.keys())
    overlappingDates = newDates.filter(d => existingDates.includes(d))
    console.log('[Upload] New dates:', newDates)
    console.log('[Upload] Overlapping dates:', overlappingDates)
    
    const dailyData = Array.from(dailyDataMap.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(d => ({
        date: d.date,
        online: d.online,
        offline: d.offline,
        total: d.total,
        channelData: d.channelData || {},
        categoryData: d.categoryData || {},
      }))

    // 9. 정산 계산 - 파서 결과를 그대로 사용
    const settlementInput = {
      onlineSales: Object.entries(monthlySummary.onlineByChannel).map(
        ([channelCode, count]) => ({
          channelCode: channelCode as any,
          channelName: channelCode,
          count,
        })
      ),
      offlineCount: monthlySummary.offlineTotal,
    }

    console.log('[Upload] Settlement input:', settlementInput)

    const settlement = calculateSettlement(
      settlementInput,
      undefined,
      parseResult.periodStart,
      parseResult.periodEnd
    )
    
    console.log('[Upload] Settlement result:', settlement.settlements.map(s => ({ 
      name: s.companyName, 
      revenue: s.revenue 
    })))

    // 10. 파일 저장소에 데이터 저장
    const storedData: StoredUploadData = {
      uploadedAt: new Date().toISOString(),
      fileName: file.name,
      periodStart: parseResult.periodStart.toISOString(),
      periodEnd: parseResult.periodEnd.toISOString(),
      summary: {
        onlineCount: monthlySummary.onlineTotal,
        offlineCount: monthlySummary.offlineTotal,
        totalCount: monthlySummary.grandTotal,
      },
      dailyData,
      channels: Object.fromEntries(
        Object.entries(monthlySummary.onlineByChannel).map(([code, count]) => [
          code,
          { 
            name: parseResult.channelNames[code] || code,  // 중분류명 사용
            count, 
            feeRate: parseResult.channelFeeRates[code] ?? getChannelFeeRate(code) 
          }
        ])
      ),
      categories: Object.fromEntries(
        Object.entries(monthlySummary.offlineByCategory).map(([code, count]) => [
          code,
          { name: parseResult.categoryNames[code] || code, count }
        ])
      ),
      monthly: {
        onlineByChannel: monthlySummary.onlineByChannel,
        onlineByAge: monthlySummary.onlineByAge,
        offlineByCategory: monthlySummary.offlineByCategory,
        revenue: {
          online: monthlySummary.onlineRevenue,
          onlineFee: monthlySummary.onlineFee,
          onlineNet: monthlySummary.onlineNet,
          offline: monthlySummary.offlineRevenue,
          total: monthlySummary.totalRevenue,
          totalNet: monthlySummary.totalNet,
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
    
    // 파싱된 데이터 (저장은 save API에서 처리)
    console.log('[Upload] Parsed data ready for save')

    // 11. 응답 (저장하지 않고 파싱 결과만 반환)
    return NextResponse.json({
      success: true,
      uploadId: uploadHistoryId,
      dbSaved: dbSaveSuccess,
      
      // 파싱 결과 요약
      summary: {
        periodStart: parseResult.periodStart,
        periodEnd: parseResult.periodEnd,
        onlineCount: monthlySummary.onlineTotal,
        offlineCount: monthlySummary.offlineTotal,
        totalCount: monthlySummary.grandTotal,
        onlineRecords: onlineSales.length,
        offlineRecords: offlineSales.length,
      },
      
      // 일별 데이터 (수정 가능하도록)
      dailyData,
      
      // 채널별 데이터
      channels: storedData.channels,
      
      // 구분별 데이터
      categories: storedData.categories,
      
      // 월간 집계
      monthly: {
        onlineByChannel: monthlySummary.onlineByChannel,
        onlineByAge: monthlySummary.onlineByAge,
        offlineByCategory: monthlySummary.offlineByCategory,
        revenue: {
          online: monthlySummary.onlineRevenue,
          onlineFee: monthlySummary.onlineFee,
          onlineNet: monthlySummary.onlineNet,
          offline: monthlySummary.offlineRevenue,
          total: monthlySummary.totalRevenue,
          totalNet: monthlySummary.totalNet,
        },
      },
      
      // 정산 결과
      settlement: {
        totalCount: settlement.totalCount,
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
      
      // 기존 데이터 정보 (병합용)
      existingData: existingData ? {
        periodStart: existingData.periodStart,
        periodEnd: existingData.periodEnd,
        dates: existingDates,
        summary: existingData.summary,
      } : null,
      
      // 겹치는 날짜
      overlappingDates,
      hasOverlap: overlappingDates.length > 0,
      
      message: overlappingDates.length > 0
        ? `파싱 완료 - ${monthlySummary.grandTotal}명. ⚠️ 기존 데이터와 ${overlappingDates.length}일 겹침`
        : `파싱 완료 - 인터넷 ${monthlySummary.onlineTotal}명, 현장 ${monthlySummary.offlineTotal}명, 총 ${monthlySummary.grandTotal}명`,
    })
  } catch (error) {
    console.error('[Upload] Error:', error)
    console.error('[Upload] Error stack:', error instanceof Error ? error.stack : 'No stack')
    console.error('[Upload] Error message:', error instanceof Error ? error.message : String(error))
    return NextResponse.json(
      { 
        error: '업로드 처리 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}

/**
 * 데이터베이스에 저장
 */
async function saveToDatabase(parseResult: ParseResult, file: File, userId: string) {
  // 트랜잭션으로 처리
  const result = await prisma.$transaction(async (tx: typeof prisma) => {
    // 1. 업로드 기록 생성
    const uploadHistory = await tx.uploadHistory.create({
      data: {
        userId,
        fileName: file.name,
        fileSize: file.size,
        periodStart: parseResult.periodStart,
        periodEnd: parseResult.periodEnd,
        status: 'PROCESSING',
      },
    })

    // 2. 온라인 판매 데이터 저장 (청크 단위로)
    const onlineChunks = chunkArray(parseResult.onlineSales, CHUNK_SIZE)
    for (const chunk of onlineChunks) {
      await tx.onlineSale.createMany({
        data: chunk.map(sale => ({
          uploadHistoryId: uploadHistory.id,
          saleDate: sale.saleDate,
          vendor: sale.vendor,
          channel: sale.channel,
          channelCode: sale.channelCode,
          feeRate: sale.feeRate,
          ageGroup: sale.ageGroup,
          unitPrice: sale.unitPrice,
          quantity: sale.quantity,
          totalAmount: sale.totalAmount,
          feeAmount: sale.feeAmount,
          netAmount: sale.netAmount,
        })),
        skipDuplicates: true,
      })
    }

    // 3. 오프라인 판매 데이터 저장 (청크 단위로)
    const offlineChunks = chunkArray(parseResult.offlineSales, CHUNK_SIZE)
    for (const chunk of offlineChunks) {
      await tx.offlineSale.createMany({
        data: chunk.map(sale => ({
          uploadHistoryId: uploadHistory.id,
          saleDate: sale.saleDate,
          category: sale.category,
          categoryCode: sale.categoryCode,
          quantity: sale.quantity,
          unitPrice: sale.unitPrice,
          totalAmount: sale.totalAmount,
        })),
        skipDuplicates: true,
      })
    }

    // 4. 월간 집계 저장
    const { monthlySummary } = parseResult
    await tx.monthlySummary.create({
      data: {
        uploadHistoryId: uploadHistory.id,
        year: monthlySummary.year,
        month: monthlySummary.month,
        onlineTotal: monthlySummary.onlineTotal,
        offlineTotal: monthlySummary.offlineTotal,
        grandTotal: monthlySummary.grandTotal,
        onlineRevenue: monthlySummary.onlineRevenue,
        onlineFee: monthlySummary.onlineFee,
        onlineNet: monthlySummary.onlineNet,
        offlineRevenue: monthlySummary.offlineRevenue,
        totalRevenue: monthlySummary.totalRevenue,
        totalNet: monthlySummary.totalNet,
        onlineByChannel: monthlySummary.onlineByChannel,
        onlineByAge: monthlySummary.onlineByAge,
        offlineByCategory: monthlySummary.offlineByCategory,
      },
    })

    // 5. 업로드 상태 업데이트
    await tx.uploadHistory.update({
      where: { id: uploadHistory.id },
      data: {
        status: 'COMPLETED',
        recordCount: parseResult.onlineSales.length + parseResult.offlineSales.length,
      },
    })

    return { uploadHistoryId: uploadHistory.id }
  }, {
    timeout: 60000, // 60초 타임아웃
  })

  return result
}
