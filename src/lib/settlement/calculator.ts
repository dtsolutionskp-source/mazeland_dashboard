/**
 * 메이즈랜드 정산 시스템 - 계산기
 * 
 * 정산 구조 (인당 기준):
 * 
 * [기본 (수수료 0%, 현장 판매)]
 * - SKP 매출: 3,000원
 * - SKP → 메이즈랜드: 1,000원
 * - SKP → 컬처커넥션: 500원
 * - 메이즈랜드 → 컬처커넥션: 500원
 * - SKP → FMC: (3,000 - 1,000 - 500) × 20% = 300원
 * - 컬처커넥션 → SKP: 200원 (플랫폼 이용료)
 * 
 * [수수료 10% 채널]
 * - 모든 금액에 (1 - 수수료율) 적용
 * - SKP 매출: 2,700원
 * - SKP → 메이즈랜드: 900원
 * - SKP → 컬처커넥션: 450원
 * - 메이즈랜드 → 컬처커넥션: 450원
 * - SKP → FMC: (2,700 - 900 - 450) × 20% = 270원
 * - 컬처커넥션 → SKP: 180원 (플랫폼 이용료)
 */

import { DEFAULT_SETTLEMENT_CONFIG, getChannelFeeRate, CHANNEL_CODE_TO_NAME } from './config';
import {
  ChannelCode,
  SalesInput,
  SettlementConfig,
  SettlementResult,
  CompanySettlement,
} from './types';

// 회사별 단가 (수수료 차감 전 기준)
const SKP_UNIT_PRICE = 3000           // SKP 매출 단가
const MAZE_UNIT_PRICE = 1000          // SKP → 메이즈랜드 지급
const SKP_TO_CULTURE_UNIT = 500       // SKP → 컬처커넥션 지급
const MAZE_TO_CULTURE_UNIT = 500      // 메이즈랜드 → 컬처커넥션 지급
const PLATFORM_FEE_UNIT = 200         // 컬처커넥션 → SKP 플랫폼 이용료
const AGENCY_FEE_RATE = 0.20          // FMC 수수료 20%

/**
 * 정산 계산
 */
export function calculateSettlement(
  input: SalesInput,
  config: SettlementConfig = DEFAULT_SETTLEMENT_CONFIG,
  periodStart?: Date,
  periodEnd?: Date
): SettlementResult {
  const { onlineSales, offlineCount } = input;
  
  // 1. 인원 집계
  const onlineCount = onlineSales.reduce((sum, ch) => sum + ch.count, 0);
  const totalCount = onlineCount + offlineCount;
  
  // 2. 채널별 상세 계산 (수수료율 적용)
  const channelBreakdown = onlineSales.map(ch => {
    const feeRate = getChannelFeeRate(ch.channelCode, config);
    const multiplier = 1 - feeRate / 100;  // 수수료 차감 후 비율
    
    return {
      channelCode: ch.channelCode,
      channelName: ch.channelName || CHANNEL_CODE_TO_NAME[ch.channelCode],
      count: ch.count,
      feeRate,
      multiplier,
      // 각 항목별 금액 (수수료 적용)
      skpRevenue: Math.round(SKP_UNIT_PRICE * multiplier * ch.count),
      skpToMaze: Math.round(MAZE_UNIT_PRICE * multiplier * ch.count),
      skpToCulture: Math.round(SKP_TO_CULTURE_UNIT * multiplier * ch.count),
      mazeToCulture: Math.round(MAZE_TO_CULTURE_UNIT * multiplier * ch.count),
      platformFee: Math.round(PLATFORM_FEE_UNIT * multiplier * ch.count),
    };
  });
  
  // 3. 인터넷 판매 합계
  const onlineSkpRevenue = channelBreakdown.reduce((sum, ch) => sum + ch.skpRevenue, 0);
  const onlineSkpToMaze = channelBreakdown.reduce((sum, ch) => sum + ch.skpToMaze, 0);
  const onlineSkpToCulture = channelBreakdown.reduce((sum, ch) => sum + ch.skpToCulture, 0);
  const onlineMazeToCulture = channelBreakdown.reduce((sum, ch) => sum + ch.mazeToCulture, 0);
  const onlinePlatformFee = channelBreakdown.reduce((sum, ch) => sum + ch.platformFee, 0);
  
  // 4. 현장 판매 (수수료 없음, multiplier = 1)
  const offlineSkpRevenue = SKP_UNIT_PRICE * offlineCount;
  const offlineSkpToMaze = MAZE_UNIT_PRICE * offlineCount;
  const offlineSkpToCulture = SKP_TO_CULTURE_UNIT * offlineCount;
  const offlineMazeToCulture = MAZE_TO_CULTURE_UNIT * offlineCount;
  const offlinePlatformFee = PLATFORM_FEE_UNIT * offlineCount;
  
  // 5. 전체 합계
  const totalSkpRevenue = onlineSkpRevenue + offlineSkpRevenue;
  const totalSkpToMaze = onlineSkpToMaze + offlineSkpToMaze;
  const totalSkpToCulture = onlineSkpToCulture + offlineSkpToCulture;
  const totalMazeToCulture = onlineMazeToCulture + offlineMazeToCulture;
  const totalPlatformFee = onlinePlatformFee + offlinePlatformFee;
  
  // 6. FMC 운영 수수료: (SKP매출 - 메이즈지급 - SKP컬처지급) × 20%
  const skpNetBeforeAgency = totalSkpRevenue - totalSkpToMaze - totalSkpToCulture;
  const agencyRevenue = Math.round(skpNetBeforeAgency * AGENCY_FEE_RATE);
  
  // 7. 회사별 정산
  
  // === SKP ===
  const skpTotalIncome = totalSkpRevenue + totalPlatformFee;  // 티켓 매출 + 플랫폼료 수입
  const skpTotalCost = totalSkpToMaze + totalSkpToCulture + agencyRevenue;  // 메이즈 + 컬처 + FMC
  const skpProfit = skpTotalIncome - skpTotalCost;
  
  // === 메이즈랜드 ===
  const mazeIncome = totalSkpToMaze;  // SKP로부터 받음
  const mazeCost = totalMazeToCulture;  // 컬처에 지급
  const mazeProfit = mazeIncome - mazeCost;
  
  // === 컬처커넥션 ===
  const cultureIncome = totalSkpToCulture + totalMazeToCulture;  // SKP + 메이즈로부터 받음
  const cultureCost = totalPlatformFee;  // SKP에 플랫폼료 지급
  const cultureProfit = cultureIncome - cultureCost;
  
  // === FMC ===
  const fmcIncome = agencyRevenue;
  const fmcProfit = fmcIncome;
  
  console.log('[Settlement] Calculation:');
  console.log('  Total Count:', totalCount, '(Online:', onlineCount, '/ Offline:', offlineCount, ')');
  console.log('  === SKP ===');
  console.log('    Revenue (티켓):', totalSkpRevenue);
  console.log('    Platform Fee Income:', totalPlatformFee);
  console.log('    Total Income:', skpTotalIncome);
  console.log('    → Maze Payment:', totalSkpToMaze);
  console.log('    → Culture Payment:', totalSkpToCulture);
  console.log('    → FMC Payment:', agencyRevenue);
  console.log('    Profit:', skpProfit);
  console.log('  === 메이즈랜드 ===');
  console.log('    Income (from SKP):', mazeIncome);
  console.log('    → Culture Payment:', mazeCost);
  console.log('    Profit:', mazeProfit);
  console.log('  === 컬처커넥션 ===');
  console.log('    Income (from SKP):', totalSkpToCulture);
  console.log('    Income (from Maze):', totalMazeToCulture);
  console.log('    Total Income:', cultureIncome);
  console.log('    → Platform Fee to SKP:', cultureCost);
  console.log('    Profit:', cultureProfit);
  console.log('  === FMC ===');
  console.log('    Income:', fmcIncome);
  
  // 9. 정산 결과 생성
  const skpSettlement: CompanySettlement = {
    companyCode: 'SKP',
    companyName: 'SKP',
    revenue: totalSkpRevenue,
    income: skpTotalIncome,
    cost: skpTotalCost,
    profit: skpProfit,
    profitRate: skpTotalIncome > 0 ? Math.round((skpProfit / skpTotalIncome) * 10000) / 100 : 0,
    details: {
      ticketRevenue: totalSkpRevenue,
      platformFeeIncome: totalPlatformFee,
      mazePayment: totalSkpToMaze,
      culturePayment: totalSkpToCulture,
      agencyPayment: agencyRevenue,
    },
  };
  
  const mazeSettlement: CompanySettlement = {
    companyCode: 'MAZE',
    companyName: '메이즈랜드',
    revenue: mazeIncome,
    income: mazeIncome,
    cost: mazeCost,
    profit: mazeProfit,
    profitRate: mazeIncome > 0 ? Math.round((mazeProfit / mazeIncome) * 10000) / 100 : 0,
    details: {
      fromSkp: totalSkpToMaze,
      toCulture: totalMazeToCulture,
      onlineFromSkp: onlineSkpToMaze,
      offlineFromSkp: offlineSkpToMaze,
    },
  };
  
  const cultureSettlement: CompanySettlement = {
    companyCode: 'CULTURE',
    companyName: '컬처커넥션',
    revenue: cultureIncome,
    income: cultureIncome,
    cost: cultureCost,
    profit: cultureProfit,
    profitRate: cultureIncome > 0 ? Math.round((cultureProfit / cultureIncome) * 10000) / 100 : 0,
    details: {
      fromSkp: totalSkpToCulture,
      fromMaze: totalMazeToCulture,
      platformFeeCost: cultureCost,
      onlineFromSkp: onlineSkpToCulture,
      offlineFromSkp: offlineSkpToCulture,
      onlineFromMaze: onlineMazeToCulture,
      offlineFromMaze: offlineMazeToCulture,
    },
  };
  
  const agencySettlement: CompanySettlement = {
    companyCode: 'AGENCY',
    companyName: 'FMC',
    revenue: fmcIncome,
    income: fmcIncome,
    cost: 0,
    profit: fmcProfit,
    profitRate: 100,
    details: {
      feeRate: AGENCY_FEE_RATE * 100,
      basedOn: skpNetBeforeAgency,
      calculation: `(${totalSkpRevenue} - ${totalSkpToMaze} - ${totalSkpToCulture}) × 20%`,
    },
  };
  
  return {
    periodStart: periodStart || new Date(),
    periodEnd: periodEnd || new Date(),
    totalCount,
    onlineCount,
    offlineCount,
    settlements: [skpSettlement, mazeSettlement, cultureSettlement, agencySettlement],
    channelBreakdown,
    calculatedAt: new Date(),
  };
}

// ============================================
// 유틸리티 함수
// ============================================

/**
 * 인터넷 채널별 인원으로부터 SalesInput 생성
 */
export function createSalesInput(
  channelData: { channel: string | ChannelCode; count: number }[],
  offlineCount: number
): SalesInput {
  const onlineSales = channelData.map(item => {
    const channelCode = typeof item.channel === 'string' && !['NAVER_MAZE_25', 'MAZE_TICKET', 'MAZE_TICKET_SINGLE', 'GENERAL_TICKET', 'OTHER'].includes(item.channel)
      ? (item.channel as ChannelCode)
      : (item.channel as ChannelCode);
    
    return {
      channelCode,
      channelName: CHANNEL_CODE_TO_NAME[channelCode] || item.channel,
      count: item.count,
    };
  });
  
  return { onlineSales, offlineCount };
}

/**
 * 회사 코드로 정산 결과 조회
 */
export function getSettlementByCompany(
  result: SettlementResult,
  companyCode: 'SKP' | 'MAZE' | 'CULTURE' | 'AGENCY'
): CompanySettlement | undefined {
  return result.settlements.find(s => s.companyCode === companyCode);
}

/**
 * 정산 결과를 특정 회사 관점에서 마스킹
 */
export function maskSettlementForCompany(
  result: SettlementResult,
  viewerCompany: 'SKP' | 'MAZE' | 'CULTURE' | 'AGENCY'
): SettlementResult {
  const maskedSettlements = result.settlements.map(settlement => {
    if (settlement.companyCode === viewerCompany) {
      return settlement;
    }
    
    if (viewerCompany === 'SKP') {
      return settlement;
    }
    
    return {
      ...settlement,
      profit: -1,
      profitRate: -1,
      details: undefined,
    };
  });
  
  return {
    ...result,
    settlements: maskedSettlements,
  };
}
