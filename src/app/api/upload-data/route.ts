/**
 * 업로드 데이터 API
 * - 엑셀 업로드로 저장된 데이터 조회
 * - 엑셀 업로드 모드와 일자별 입력 모드에서 동일한 데이터 소스 사용
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getUploadDataByMonth, StoredUploadData } from '@/lib/data-store'
import { getMasterData } from '@/lib/master-data'
import { getMonthlyFeeSettings } from '@/lib/fee-policy'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const yearParam = searchParams.get('year')
    const monthParam = searchParams.get('month')

    if (!yearParam || !monthParam) {
      return NextResponse.json({ error: 'year, month 파라미터가 필요합니다.' }, { status: 400 })
    }

    const year = parseInt(yearParam)
    const month = parseInt(monthParam)

    console.log('[Upload Data API] Loading data for:', year, month)

    // 마스터 데이터
    const masterData = getMasterData()

    // 업로드 데이터 조회
    const uploadData = await getUploadDataByMonth(year, month)

    // 수수료 설정 - 업로드 데이터가 있으면 해당 채널 기반으로 생성
    let feeSettings = await getMonthlyFeeSettings(year, month)
    
    // 업로드 데이터의 채널이 있으면 수수료 설정에 반영
    if (uploadData && uploadData.channels) {
      const uploadChannels = Object.entries(uploadData.channels).map(([code, ch]: [string, any]) => ({
        channelCode: code,
        channelName: ch.name || code,
        year,
        month,
        feeRate: ch.feeRate ?? 0,
        source: 'excel' as const,
      }))
      
      // 업로드 채널이 있으면 기존 설정에 추가/업데이트
      if (uploadChannels.length > 0) {
        const channelMap = new Map(feeSettings.channels.map(c => [c.channelCode, c]))
        for (const uc of uploadChannels) {
          channelMap.set(uc.channelCode, uc)
        }
        feeSettings = {
          ...feeSettings,
          channels: Array.from(channelMap.values()),
        }
      }
    }

    if (!uploadData) {
      console.log('[Upload Data API] No data found for:', year, month)
      return NextResponse.json({
        success: true,
        hasData: false,
        masterData,
        feeSettings,
        uploadData: null,
      })
    }

    console.log('[Upload Data API] Found data:', {
      dailyCount: uploadData.dailyData?.length,
      channelCount: Object.keys(uploadData.channels || {}).length,
      categoryCount: Object.keys(uploadData.categories || {}).length,
      summary: uploadData.summary,
    })

    return NextResponse.json({
      success: true,
      hasData: true,
      masterData,
      feeSettings,
      uploadData: {
        uploadedAt: uploadData.uploadedAt,
        fileName: uploadData.fileName,
        periodStart: uploadData.periodStart,
        periodEnd: uploadData.periodEnd,
        dailyData: uploadData.dailyData,
        channels: uploadData.channels,
        categories: uploadData.categories,
        summary: uploadData.summary,
        settlement: uploadData.settlement,
      },
    })
  } catch (error) {
    console.error('[Upload Data API] Error:', error)
    return NextResponse.json({ error: '데이터 조회 실패' }, { status: 500 })
  }
}

