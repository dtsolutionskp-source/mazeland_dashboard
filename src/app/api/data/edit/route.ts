import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getUploadData, saveUploadData, StoredUploadData } from '@/lib/data-store'
import { calculateSettlement } from '@/lib/settlement'

interface EditedData {
  online: number
  offline: number
  onlineBreakdown: Record<string, number>
  offlineBreakdown: Record<string, number>
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    // 관리자만 수정 가능
    if (!['SUPER_ADMIN', 'SKP_ADMIN'].includes(user.role)) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
    }

    const body = await request.json()
    const { date, data } = body as { date: string; data: EditedData }

    console.log('[Data Edit] Editing data for date:', date, data)

    // 현재 저장된 데이터 불러오기
    const uploadedData = await getUploadData()
    if (!uploadedData) {
      return NextResponse.json({ error: '저장된 데이터가 없습니다.' }, { status: 404 })
    }

    // 해당 날짜 데이터 찾기
    const dayIndex = uploadedData.dailyData.findIndex(d => d.date === date)
    if (dayIndex === -1) {
      return NextResponse.json({ error: '해당 날짜 데이터를 찾을 수 없습니다.' }, { status: 404 })
    }

    // 기존 값
    const oldDay = uploadedData.dailyData[dayIndex]
    const onlineDiff = data.online - oldDay.online
    const offlineDiff = data.offline - oldDay.offline

    console.log('[Data Edit] Changes:', { onlineDiff, offlineDiff })

    // 일별 데이터 업데이트
    uploadedData.dailyData[dayIndex] = {
      date,
      online: data.online,
      offline: data.offline,
      total: data.online + data.offline,
    }

    // 요약 업데이트
    uploadedData.summary.onlineCount += onlineDiff
    uploadedData.summary.offlineCount += offlineDiff
    uploadedData.summary.totalCount = uploadedData.summary.onlineCount + uploadedData.summary.offlineCount

    // 채널별 데이터 업데이트 (온라인)
    for (const [channel, count] of Object.entries(data.onlineBreakdown)) {
      if (uploadedData.channels[channel]) {
        // 기존 채널 카운트에서 오늘 변경분만 반영
        // (단순화: 전체 카운트를 다시 계산하지 않고 증분만 반영)
        uploadedData.channels[channel].count += count - (oldDay.online > 0 ? Math.round(oldDay.online / Object.keys(data.onlineBreakdown).length) : 0)
      } else {
        uploadedData.channels[channel] = {
          name: channel,
          count: count,
          feeRate: 15, // 기본 수수료율
        }
      }
    }

    // 카테고리별 데이터 업데이트 (오프라인)
    for (const [category, count] of Object.entries(data.offlineBreakdown)) {
      if (uploadedData.categories[category]) {
        uploadedData.categories[category].count += count - (oldDay.offline > 0 ? Math.round(oldDay.offline / Object.keys(data.offlineBreakdown).length) : 0)
      } else {
        uploadedData.categories[category] = {
          name: category,
          count: count,
        }
      }
    }

    // 정산 다시 계산
    const totalOnline = uploadedData.summary.onlineCount
    const totalOffline = uploadedData.summary.offlineCount
    
    const settlementInput = {
      onlineSales: Object.entries(uploadedData.channels).map(([code, ch]) => ({
        channelCode: code as any,
        channelName: ch.name,
        count: ch.count,
      })),
      offlineCount: totalOffline,
    }

    const settlement = calculateSettlement(
      settlementInput,
      undefined,
      new Date(uploadedData.periodStart),
      new Date(uploadedData.periodEnd)
    )

    uploadedData.settlement.companies = settlement.settlements.map(s => ({
      name: s.companyName,
      code: s.companyCode,
      revenue: s.revenue,
      income: s.income,
      cost: s.cost,
      profit: s.profit,
      profitRate: s.profitRate,
    }))

    // 매출 데이터 업데이트
    if (uploadedData.monthly) {
      uploadedData.monthly.revenue = {
        online: totalOnline * 3000,
        onlineFee: Math.round(totalOnline * 3000 * 0.1), // 평균 10% 가정
        onlineNet: Math.round(totalOnline * 3000 * 0.9),
        offline: totalOffline * 3000,
        total: (totalOnline + totalOffline) * 3000,
        totalNet: Math.round(totalOnline * 3000 * 0.9) + totalOffline * 3000,
      }
    }

    // 저장
    await saveUploadData(uploadedData)

    console.log('[Data Edit] Data saved successfully')

    return NextResponse.json({ 
      success: true,
      summary: uploadedData.summary,
      settlement: uploadedData.settlement.companies,
    })
  } catch (error) {
    console.error('[Data Edit] Error:', error)
    return NextResponse.json({ error: '데이터 수정 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

