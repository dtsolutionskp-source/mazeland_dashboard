import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getUploadDataByMonth, getAvailableUploadMonths } from '@/lib/data-store'

// 정산 데이터 조회 API
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString())
    const month = parseInt(searchParams.get('month') || (new Date().getMonth() + 1).toString())

    // 사용 가능한 월 목록
    const availableMonths = await getAvailableUploadMonths()
    console.log('[Settlement API] Available months:', availableMonths)

    // 해당 월 데이터 로드
    const uploadData = await getUploadDataByMonth(year, month)
    
    if (!uploadData) {
      console.log('[Settlement API] No data for:', year, month)
      return NextResponse.json({ 
        year, 
        month, 
        availableMonths,
        hasData: false,
        totalVisitors: 0,
        onlineCount: 0,
        offlineCount: 0,
        amounts: {},
        netTransfers: {},
      })
    }

    // 채널별 데이터 가져오기
    const channels = uploadData.channels || {}
    const onlineCount = uploadData.summary?.onlineCount || 0
    const offlineCount = uploadData.summary?.offlineCount || 0
    const totalVisitors = onlineCount + offlineCount
    
    console.log('[Settlement API] Raw data:', { onlineCount, offlineCount, totalVisitors })
    console.log('[Settlement API] Channels:', channels)

    // ============================================
    // 정산 금액 계산 (수수료율 반영)
    // ============================================
    
    // 채널별 수수료 적용 금액 계산
    let onlineRevenue_3000 = 0      // SKP→메이즈 총매출 (3,000원 기준)
    let onlineRevenue_1000 = 0      // 컬처 관련 (1,000원 기준)
    let onlineRevenue_500_maze = 0  // 메이즈→SKP 컬처분담금 (500원 기준)
    
    // 채널별 계산
    Object.values(channels).forEach((ch: any) => {
      const count = ch.count || 0
      const feeRate = (ch.feeRate || 0) / 100  // 수수료율 (예: 10% → 0.1)
      
      // 1. SKP→메이즈 총매출: 3,000원 - (3,000원 × 수수료율)
      const perPerson_3000 = 3000 * (1 - feeRate)
      onlineRevenue_3000 += count * perPerson_3000
      
      // 2. 컬처 관련 1,000원: 1,000원 - (1,000원 × 수수료율)
      const perPerson_1000 = 1000 * (1 - feeRate)
      onlineRevenue_1000 += count * perPerson_1000
      
      // 3. 메이즈→SKP 컬처분담금 500원: 500원 - (500원 × 수수료율)
      const perPerson_500 = 500 * (1 - feeRate)
      onlineRevenue_500_maze += count * perPerson_500
    })
    
    // 오프라인은 수수료 없음 (100% 적용)
    const offlineRevenue_3000 = offlineCount * 3000
    const offlineRevenue_1000 = offlineCount * 1000
    const offlineRevenue_500 = offlineCount * 500
    
    // 총합계
    const total_3000 = Math.round(onlineRevenue_3000 + offlineRevenue_3000)
    const total_1000 = Math.round(onlineRevenue_1000 + offlineRevenue_1000)
    const total_500_maze = Math.round(onlineRevenue_500_maze + offlineRevenue_500)
    
    console.log('[Settlement API] Calculated revenues:', { 
      onlineRevenue_3000, offlineRevenue_3000, total_3000,
      onlineRevenue_1000, offlineRevenue_1000, total_1000,
      total_500_maze
    })
    
    // ============================================
    // 정산 항목별 금액
    // ============================================
    
    // 1. SKP → 메이즈랜드 (총매출 건): 인당 3,000원 (수수료 차감)
    const SKP_TO_MAZE_REVENUE = total_3000
    
    // 2. 메이즈랜드 → SKP (운영 수수료): 인당 1,000원 (수수료 차감)
    const MAZE_TO_SKP_OPERATION = total_1000
    
    // 3. SKP → 컬처커넥션 (플랫폼 이용료): 1,000원의 20% = 200원 (수수료 차감 후)
    //    즉, (1,000원 - 1,000원×수수료율) × 20%
    const SKP_TO_CULTURE_PLATFORM = Math.round(total_1000 * 0.2)
    
    // 4. 컬처커넥션 → SKP: 1,000원 (수수료 차감 후) 
    //    메이즈와 SKP 5:5 부담하여 SKP가 컬처에 전달
    const CULTURE_TO_SKP = total_1000
    
    // 5. SKP → 메이즈랜드 (컬처 분담금): 500원 (수수료 차감)
    //    SKP가 메이즈에 인보이스 청구 (세금계산서 아님, 수익 건)
    //    컬처 1,000원의 50%를 메이즈가 부담
    const SKP_TO_MAZE_CULTURE_SHARE = total_500_maze
    
    // 6. FMC → SKP (운영대행 수수료): SKP 수익의 20%
    //    FMC는 SKP의 대행사이므로, FMC가 SKP에 대행수수료를 청구
    //    SKP 수익 = SKP매출 - 메이즈R/S - 컬처R/S + 메이즈비용분담금
    //    = 3,000 - 1,000 - 1,000 + 500 = 1,500원 (인당, 수수료 없을 시)
    //    ※ 플랫폼 이용료(SKP→컬처)는 수수료 계산에 포함하지 않음
    
    // 수수료 적용된 SKP 수익 계산
    let skpProfit = 0
    Object.values(channels).forEach((ch: any) => {
      const count = ch.count || 0
      const feeRate = (ch.feeRate || 0) / 100
      
      // 수수료 적용된 인당 수익
      // SKP매출(3000) - 메이즈R/S(1000) - 컬처R/S(1000) + 메이즈비용분담금(500)
      const skpRevenue = 3000 * (1 - feeRate)           // SKP 매출
      const mazeRS = 1000 * (1 - feeRate)               // 메이즈 R/S (운영수수료)
      const cultureRS = 1000 * (1 - feeRate)            // 컬처 R/S (플랫폼 비용)
      const mazeCultureShare = 500 * (1 - feeRate)      // 메이즈 비용분담금
      
      const profitPerPerson = skpRevenue - mazeRS - cultureRS + mazeCultureShare
      skpProfit += count * profitPerPerson
    })
    // 오프라인 (수수료 없음)
    skpProfit += offlineCount * (3000 - 1000 - 1000 + 500)
    
    const FMC_TO_SKP_AGENCY = Math.round(skpProfit * 0.2)
    
    console.log('[Settlement API] SKP Profit calculation:', { skpProfit, fmcFee: FMC_TO_SKP_AGENCY })
    
    // 금액 맵
    const amounts: Record<string, number> = {
      SKP_TO_MAZE_REVENUE,        // SKP → 메이즈 (총매출)
      MAZE_TO_SKP_OPERATION,      // 메이즈 → SKP (운영수수료)
      CULTURE_TO_SKP,             // 컬처 → SKP (플랫폼 비용 1,000원)
      SKP_TO_CULTURE_PLATFORM,    // SKP → 컬처 (플랫폼 이용료 20%)
      SKP_TO_MAZE_CULTURE_SHARE,  // SKP → 메이즈 (컬처 분담금 인보이스)
      FMC_TO_SKP_AGENCY,          // FMC → SKP (대행 수수료)
    }
    
    // ============================================
    // 상계 입금액 계산
    // 계산서 발행 = 돈을 달라고 청구하는 것
    // SKP → 메이즈 계산서 = SKP가 메이즈에게 돈을 받음 (SKP 매출, 메이즈 비용)
    // 메이즈 → SKP 계산서 = 메이즈가 SKP에게 돈을 받음 (메이즈 매출, SKP 비용)
    // ============================================
    
    // SKP ↔ 메이즈랜드
    // SKP가 메이즈에서 받을 돈: 총매출(세금계산서) + 컬처분담금(인보이스)
    const skpReceiveFromMaze = SKP_TO_MAZE_REVENUE + SKP_TO_MAZE_CULTURE_SHARE
    // 메이즈가 SKP에서 받을 돈: 운영수수료(세금계산서)
    const mazeReceiveFromSkp = MAZE_TO_SKP_OPERATION
    const skpMazeNet = skpReceiveFromMaze - mazeReceiveFromSkp  // 양수면 메이즈가 SKP에 입금, 음수면 SKP가 메이즈에 입금
    
    // SKP ↔ 컬처커넥션
    const cultureReceiveFromSkp = CULTURE_TO_SKP  // 컬처가 SKP에서 받을 돈 (컬처 매출)
    const skpReceiveFromCulture = SKP_TO_CULTURE_PLATFORM  // SKP가 컬처에서 받을 돈 (SKP 매출)
    const skpCultureNet = cultureReceiveFromSkp - skpReceiveFromCulture  // 양수면 SKP가 컬처에 입금, 음수면 컬처가 SKP에 입금
    
    // SKP ↔ FMC (SKP가 FMC에 대행수수료 지급 = FMC가 SKP에 청구)
    const fmcReceiveFromSkp = FMC_TO_SKP_AGENCY  // FMC가 SKP에서 받을 돈
    
    const netTransfers = {
      SKP_MAZE: {
        from: skpMazeNet > 0 ? 'MAZE' : 'SKP',
        to: skpMazeNet > 0 ? 'SKP' : 'MAZE',
        amount: Math.abs(skpMazeNet),
        description: skpMazeNet > 0 
          ? `메이즈랜드가 SKP에 ${Math.abs(skpMazeNet).toLocaleString()}원 입금`
          : `SKP가 메이즈랜드에 ${Math.abs(skpMazeNet).toLocaleString()}원 입금`,
      },
      SKP_CULTURE: {
        from: skpCultureNet > 0 ? 'SKP' : 'CULTURE',
        to: skpCultureNet > 0 ? 'CULTURE' : 'SKP',
        amount: Math.abs(skpCultureNet),
        description: skpCultureNet > 0 
          ? `SKP가 컬처커넥션에 ${Math.abs(skpCultureNet).toLocaleString()}원 입금`
          : `컬처커넥션이 SKP에 ${Math.abs(skpCultureNet).toLocaleString()}원 입금`,
      },
      SKP_FMC: {
        from: 'SKP',
        to: 'FMC',
        amount: fmcReceiveFromSkp,
        description: `SKP가 FMC에 ${fmcReceiveFromSkp.toLocaleString()}원 입금`,
      },
    }
    
    console.log('[Settlement API] Net transfers:', netTransfers)

    return NextResponse.json({
      year,
      month,
      availableMonths,
      hasData: true,
      totalVisitors,
      onlineCount,
      offlineCount,
      amounts,
      netTransfers,
      // 디버그용
      debug: {
        total_3000,
        total_1000,
        total_500_maze,
        skpProfit,
        skpReceiveFromMaze,
        mazeReceiveFromSkp,
        skpMazeNet,
      }
    })
  } catch (error) {
    console.error('Settlement data API error:', error)
    return NextResponse.json(
      { error: '정산 데이터 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
