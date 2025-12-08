/**
 * 정산 계산 로직 단위 테스트
 */

import { calculateSettlement, createSalesInput, getSettlementByCompany } from './calculator';
import { DEFAULT_SETTLEMENT_CONFIG } from './config';
import { ChannelCode, SalesInput, SettlementResult } from './types';

describe('Settlement Calculator', () => {
  // 테스트용 데이터: 실제 엑셀 데이터 기반
  // 인터넷 판매: 830명, 현장 판매: 1,457명, 총: 2,287명
  const testInput: SalesInput = {
    onlineSales: [
      { channelCode: 'NAVER_MAZE_25', channelName: '네이버 메이즈랜드25년', count: 459 },
      { channelCode: 'MAZE_TICKET', channelName: '메이즈랜드 입장권', count: 200 },
      { channelCode: 'MAZE_TICKET_SINGLE', channelName: '메이즈랜드 입장권(단품)', count: 124 },
      { channelCode: 'GENERAL_TICKET', channelName: '일반채널 입장권', count: 47 },
    ],
    offlineCount: 1457,
  };

  describe('인원 집계', () => {
    it('총 인원을 정확히 계산해야 함', () => {
      const result = calculateSettlement(testInput);
      
      expect(result.onlineCount).toBe(830);
      expect(result.offlineCount).toBe(1457);
      expect(result.totalCount).toBe(2287);
    });
  });

  describe('채널별 수수료 계산', () => {
    it('네이버 채널(10% 수수료)을 정확히 계산해야 함', () => {
      const result = calculateSettlement(testInput);
      const naverChannel = result.channelBreakdown.find(ch => ch.channelCode === 'NAVER_MAZE_25');
      
      expect(naverChannel).toBeDefined();
      expect(naverChannel!.count).toBe(459);
      expect(naverChannel!.revenue).toBe(459 * 3000); // 1,377,000
      expect(naverChannel!.fee).toBe(Math.round(459 * 3000 * 0.10)); // 137,700
      expect(naverChannel!.netRevenue).toBe(459 * 3000 - Math.round(459 * 3000 * 0.10)); // 1,239,300
    });

    it('일반채널(15% 수수료)을 정확히 계산해야 함', () => {
      const result = calculateSettlement(testInput);
      const generalChannel = result.channelBreakdown.find(ch => ch.channelCode === 'GENERAL_TICKET');
      
      expect(generalChannel).toBeDefined();
      expect(generalChannel!.fee).toBe(Math.round(47 * 3000 * 0.15)); // 21,150
    });
  });

  describe('SKP 정산', () => {
    it('SKP 티켓 매출을 정확히 계산해야 함', () => {
      const result = calculateSettlement(testInput);
      const skp = getSettlementByCompany(result, 'SKP');
      
      expect(skp).toBeDefined();
      
      // 인터넷 판매 매출 (수수료 차감 후)
      // 네이버: 459 * 3000 * 0.9 = 1,239,300
      // 메이즈입장권: 200 * 3000 * 0.88 = 528,000
      // 메이즈단품: 124 * 3000 * 0.88 = 327,360
      // 일반채널: 47 * 3000 * 0.85 = 119,850
      const expectedOnlineRevenue = 
        459 * 3000 - Math.round(459 * 3000 * 0.10) +
        200 * 3000 - Math.round(200 * 3000 * 0.12) +
        124 * 3000 - Math.round(124 * 3000 * 0.12) +
        47 * 3000 - Math.round(47 * 3000 * 0.15);
      
      // 현장 판매 매출 (수수료 없음)
      const expectedOfflineRevenue = 1457 * 3000; // 4,371,000
      
      expect(skp!.details?.onlineRevenue).toBe(expectedOnlineRevenue);
      expect(skp!.details?.offlineRevenue).toBe(expectedOfflineRevenue);
    });

    it('SKP 지급 비용을 정확히 계산해야 함', () => {
      const result = calculateSettlement(testInput);
      const skp = getSettlementByCompany(result, 'SKP');
      
      // 메이즈랜드 지급: 2287 * 1000 = 2,287,000
      // 컬처커넥션 지급: 2287 * 500 = 1,143,500
      expect(skp!.details?.mazeLandPayment).toBe(2287 * 1000);
      expect(skp!.details?.culturePayment).toBe(2287 * 500);
    });

    it('SKP 티켓 순이익을 정확히 계산해야 함 (운영대행 수수료 베이스)', () => {
      const result = calculateSettlement(testInput);
      const skp = getSettlementByCompany(result, 'SKP');
      
      // 티켓 순이익 = 티켓 매출 - 지급 비용
      // 플랫폼 이용료는 여기에 포함 X
      const ticketRevenue = skp!.details!.onlineRevenue! + skp!.details!.offlineRevenue!;
      const paymentCost = skp!.details!.mazeLandPayment! + skp!.details!.culturePayment!;
      const expectedTicketProfit = ticketRevenue - paymentCost;
      
      expect(skp!.details?.ticketProfit).toBe(expectedTicketProfit);
    });

    it('SKP 플랫폼 이용료 수입을 정확히 계산해야 함', () => {
      const result = calculateSettlement(testInput);
      const skp = getSettlementByCompany(result, 'SKP');
      
      // 플랫폼 이용료: 2287 * 200 = 457,400
      expect(skp!.details?.platformFeeIncome).toBe(2287 * 200);
    });

    it('SKP 운영대행사 지급액을 정확히 계산해야 함', () => {
      const result = calculateSettlement(testInput);
      const skp = getSettlementByCompany(result, 'SKP');
      
      // 운영대행 수수료 = 티켓 순이익 * 20%
      const expectedAgencyPayment = Math.round(skp!.details!.ticketProfit! * 0.20);
      expect(skp!.details?.agencyPayment).toBe(expectedAgencyPayment);
    });

    it('SKP 최종 이익을 정확히 계산해야 함', () => {
      const result = calculateSettlement(testInput);
      const skp = getSettlementByCompany(result, 'SKP');
      
      // 최종 이익 = 티켓 순이익 - 운영대행 지급 + 플랫폼 이용료
      const expectedFinalProfit = 
        skp!.details!.ticketProfit! - 
        skp!.details!.agencyPayment! + 
        skp!.details!.platformFeeIncome!;
      
      expect(skp!.profit).toBe(expectedFinalProfit);
    });
  });

  describe('메이즈랜드 정산', () => {
    it('메이즈랜드 매출을 정확히 계산해야 함', () => {
      const result = calculateSettlement(testInput);
      const maze = getSettlementByCompany(result, 'MAZE');
      
      // 매출: 2287 * 1000 = 2,287,000
      expect(maze!.revenue).toBe(2287 * 1000);
    });

    it('메이즈랜드 비용을 정확히 계산해야 함', () => {
      const result = calculateSettlement(testInput);
      const maze = getSettlementByCompany(result, 'MAZE');
      
      // 비용 (컬처커넥션 지급): 2287 * 500 = 1,143,500
      expect(maze!.cost).toBe(2287 * 500);
    });

    it('메이즈랜드 이익을 정확히 계산해야 함', () => {
      const result = calculateSettlement(testInput);
      const maze = getSettlementByCompany(result, 'MAZE');
      
      // 이익: 2287 * 500 = 1,143,500
      expect(maze!.profit).toBe(2287 * 500);
      expect(maze!.profitRate).toBe(50); // 50% 이익률
    });
  });

  describe('컬처커넥션 정산', () => {
    it('컬처커넥션 매출을 정확히 계산해야 함', () => {
      const result = calculateSettlement(testInput);
      const culture = getSettlementByCompany(result, 'CULTURE');
      
      // 매출: (SKP 500 + 메이즈 500) * 2287 = 2,287,000
      expect(culture!.revenue).toBe(2287 * 1000);
    });

    it('컬처커넥션 비용을 정확히 계산해야 함', () => {
      const result = calculateSettlement(testInput);
      const culture = getSettlementByCompany(result, 'CULTURE');
      
      // 비용 (플랫폼 이용료 지급): 2287 * 200 = 457,400
      expect(culture!.cost).toBe(2287 * 200);
    });

    it('컬처커넥션 이익을 정확히 계산해야 함', () => {
      const result = calculateSettlement(testInput);
      const culture = getSettlementByCompany(result, 'CULTURE');
      
      // 이익: 2287 * 800 = 1,829,600
      expect(culture!.profit).toBe(2287 * 800);
      expect(culture!.profitRate).toBe(80); // 80% 이익률
    });
  });

  describe('운영대행사 정산', () => {
    it('운영대행사 수수료가 SKP 티켓 순이익 기준으로 계산되어야 함', () => {
      const result = calculateSettlement(testInput);
      const agency = getSettlementByCompany(result, 'AGENCY');
      const skp = getSettlementByCompany(result, 'SKP');
      
      // 수수료: SKP 티켓 순이익 * 20%
      // 플랫폼 이용료는 수수료 계산에서 제외됨
      const expectedRevenue = Math.round(skp!.details!.ticketProfit! * 0.20);
      
      expect(agency!.revenue).toBe(expectedRevenue);
      expect(agency!.profit).toBe(expectedRevenue);
      expect(agency!.details?.basedOn).toBe('SKP 티켓 순이익 (플랫폼 이용료 제외)');
    });

    it('운영대행사 수수료에 플랫폼 이용료가 포함되지 않아야 함', () => {
      const result = calculateSettlement(testInput);
      const agency = getSettlementByCompany(result, 'AGENCY');
      const skp = getSettlementByCompany(result, 'SKP');
      
      // 플랫폼 이용료를 포함한 경우의 수수료
      const profitWithPlatformFee = skp!.details!.ticketProfit! + skp!.details!.platformFeeIncome!;
      const wrongAgencyFee = Math.round(profitWithPlatformFee * 0.20);
      
      // 실제 계산된 수수료는 플랫폼 이용료 제외 금액 기준
      expect(agency!.revenue).not.toBe(wrongAgencyFee);
      expect(agency!.revenue).toBe(Math.round(skp!.details!.ticketProfit! * 0.20));
    });
  });

  describe('정합성 검증', () => {
    it('SKP 운영대행 지급액과 운영대행사 수익이 일치해야 함', () => {
      const result = calculateSettlement(testInput);
      const skp = getSettlementByCompany(result, 'SKP');
      const agency = getSettlementByCompany(result, 'AGENCY');
      
      expect(skp!.details?.agencyPayment).toBe(agency!.revenue);
    });

    it('컬처커넥션 지급 플랫폼 이용료와 SKP 수입이 일치해야 함', () => {
      const result = calculateSettlement(testInput);
      const skp = getSettlementByCompany(result, 'SKP');
      const culture = getSettlementByCompany(result, 'CULTURE');
      
      expect(culture!.cost).toBe(skp!.details?.platformFeeIncome);
    });

    it('SKP 메이즈랜드 지급액과 메이즈랜드 매출이 일치해야 함', () => {
      const result = calculateSettlement(testInput);
      const skp = getSettlementByCompany(result, 'SKP');
      const maze = getSettlementByCompany(result, 'MAZE');
      
      expect(skp!.details?.mazeLandPayment).toBe(maze!.revenue);
    });
  });

  describe('엣지 케이스', () => {
    it('인원이 0인 경우 처리', () => {
      const emptyInput: SalesInput = {
        onlineSales: [],
        offlineCount: 0,
      };
      
      const result = calculateSettlement(emptyInput);
      
      expect(result.totalCount).toBe(0);
      expect(result.onlineCount).toBe(0);
      expect(result.offlineCount).toBe(0);
      
      const skp = getSettlementByCompany(result, 'SKP');
      expect(skp!.revenue).toBe(0);
      expect(skp!.profit).toBe(0);
    });

    it('인터넷 판매만 있는 경우', () => {
      const onlineOnlyInput: SalesInput = {
        onlineSales: [
          { channelCode: 'NAVER_MAZE_25', channelName: '네이버', count: 100 },
        ],
        offlineCount: 0,
      };
      
      const result = calculateSettlement(onlineOnlyInput);
      
      expect(result.onlineCount).toBe(100);
      expect(result.offlineCount).toBe(0);
      
      const skp = getSettlementByCompany(result, 'SKP');
      expect(skp!.details?.offlineRevenue).toBe(0);
      expect(skp!.details?.onlineRevenue).toBe(100 * 3000 * 0.9); // 10% 수수료
    });

    it('현장 판매만 있는 경우', () => {
      const offlineOnlyInput: SalesInput = {
        onlineSales: [],
        offlineCount: 100,
      };
      
      const result = calculateSettlement(offlineOnlyInput);
      
      expect(result.onlineCount).toBe(0);
      expect(result.offlineCount).toBe(100);
      
      const skp = getSettlementByCompany(result, 'SKP');
      expect(skp!.details?.onlineRevenue).toBe(0);
      expect(skp!.details?.offlineRevenue).toBe(100 * 3000); // 수수료 없음
    });
  });
});

describe('createSalesInput', () => {
  it('채널 데이터로부터 SalesInput을 생성해야 함', () => {
    const input = createSalesInput(
      [
        { channel: 'NAVER_MAZE_25', count: 100 },
        { channel: 'MAZE_TICKET', count: 50 },
      ],
      200
    );
    
    expect(input.onlineSales).toHaveLength(2);
    expect(input.offlineCount).toBe(200);
  });
});



