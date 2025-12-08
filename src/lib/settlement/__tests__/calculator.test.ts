/**
 * 정산 계산 로직 단위 테스트
 */

import {
  calculateChannelRevenue,
  calculateOnlineSales,
  calculateOfflineSales,
  calculateSkpSettlement,
  calculateMazeSettlement,
  calculateCultureSettlement,
  calculateAgencySettlement,
  calculateSettlement,
  calculateSimpleSettlement,
  getCompanySettlement,
  formatSettlementSummary,
} from '../calculator';
import { DEFAULT_SETTLEMENT_CONFIG } from '../config';
import { ChannelSalesData, SalesInput, SettlementConfig } from '../types';

describe('정산 계산 로직', () => {
  
  // 테스트용 데이터
  const testOnlineSales: ChannelSalesData[] = [
    { channelCode: 'NAVER_MAZE_25', channelName: '네이버 메이즈랜드25년', count: 300 },
    { channelCode: 'MAZE_TICKET', channelName: '메이즈랜드 입장권', count: 200 },
    { channelCode: 'MAZE_TICKET_SINGLE', channelName: '메이즈랜드 입장권(단품)', count: 180 },
    { channelCode: 'GENERAL_TICKET', channelName: '일반채널 입장권', count: 150 },
  ];
  const testOfflineCount = 1457;
  
  describe('calculateChannelRevenue - 채널별 매출 계산', () => {
    it('네이버 메이즈랜드25년 채널 수수료 10% 적용', () => {
      const result = calculateChannelRevenue({
        channelCode: 'NAVER_MAZE_25',
        channelName: '네이버 메이즈랜드25년',
        count: 100,
      });
      
      expect(result.count).toBe(100);
      expect(result.grossRevenue).toBe(300000); // 3000 * 100
      expect(result.fee).toBe(30000); // 300000 * 10%
      expect(result.netRevenue).toBe(270000); // 300000 - 30000
    });
    
    it('메이즈랜드 입장권 채널 수수료 12% 적용', () => {
      const result = calculateChannelRevenue({
        channelCode: 'MAZE_TICKET',
        channelName: '메이즈랜드 입장권',
        count: 100,
      });
      
      expect(result.fee).toBe(36000); // 300000 * 12%
      expect(result.netRevenue).toBe(264000);
    });
    
    it('일반채널 입장권 수수료 15% 적용', () => {
      const result = calculateChannelRevenue({
        channelCode: 'GENERAL_TICKET',
        channelName: '일반채널 입장권',
        count: 100,
      });
      
      expect(result.fee).toBe(45000); // 300000 * 15%
      expect(result.netRevenue).toBe(255000);
    });
    
    it('인원이 0명일 때', () => {
      const result = calculateChannelRevenue({
        channelCode: 'NAVER_MAZE_25',
        channelName: '네이버 메이즈랜드25년',
        count: 0,
      });
      
      expect(result.grossRevenue).toBe(0);
      expect(result.fee).toBe(0);
      expect(result.netRevenue).toBe(0);
    });
  });
  
  describe('calculateOnlineSales - 인터넷 판매 전체 계산', () => {
    it('여러 채널의 합계가 정확히 계산되어야 함', () => {
      const result = calculateOnlineSales(testOnlineSales);
      
      // 총 인원: 300 + 200 + 180 + 150 = 830
      expect(result.totalCount).toBe(830);
      
      // 총 매출: 830 * 3000 = 2,490,000
      expect(result.totalGrossRevenue).toBe(2490000);
      
      // 채널별 수수료 합계
      // 네이버: 900,000 * 10% = 90,000
      // 메이즈랜드 입장권: 600,000 * 12% = 72,000
      // 메이즈랜드 입장권(단품): 540,000 * 12% = 64,800
      // 일반채널: 450,000 * 15% = 67,500
      // 총 수수료: 294,300
      expect(result.totalFee).toBe(294300);
      
      // 순매출: 2,490,000 - 294,300 = 2,195,700
      expect(result.totalNetRevenue).toBe(2195700);
      
      // 채널별 breakdown 존재 확인
      expect(result.channelBreakdown).toHaveLength(4);
    });
    
    it('빈 배열일 때', () => {
      const result = calculateOnlineSales([]);
      
      expect(result.totalCount).toBe(0);
      expect(result.totalGrossRevenue).toBe(0);
      expect(result.totalFee).toBe(0);
      expect(result.totalNetRevenue).toBe(0);
    });
  });
  
  describe('calculateOfflineSales - 현장 판매 계산', () => {
    it('수수료 없이 전액 매출 인식', () => {
      const result = calculateOfflineSales(1457);
      
      expect(result.count).toBe(1457);
      expect(result.revenue).toBe(4371000); // 1457 * 3000
    });
    
    it('인원이 0명일 때', () => {
      const result = calculateOfflineSales(0);
      
      expect(result.count).toBe(0);
      expect(result.revenue).toBe(0);
    });
  });
  
  describe('calculateSkpSettlement - SKP 정산 계산', () => {
    it('SKP 정산이 정확히 계산되어야 함', () => {
      const onlineResult = calculateOnlineSales(testOnlineSales);
      const offlineResult = calculateOfflineSales(testOfflineCount);
      const totalCount = onlineResult.totalCount + offlineResult.count; // 2287
      
      const result = calculateSkpSettlement(onlineResult, offlineResult);
      
      // SKP 매출 = 인터넷 순매출 + 현장 매출
      // = 2,195,700 + 4,371,000 = 6,566,700
      expect(result.revenue).toBe(6566700);
      
      // SKP 비용 = (1000 * 2287) + (500 * 2287) = 2,287,000 + 1,143,500 = 3,430,500
      expect(result.cost).toBe(3430500);
      
      // SKP 수익 = 매출 + 플랫폼 이용료 = 6,566,700 + (200 * 2287) = 6,566,700 + 457,400 = 7,024,100
      expect(result.income).toBe(7024100);
      
      // SKP 이익 = 수익 - 비용 = 7,024,100 - 3,430,500 = 3,593,600
      expect(result.profit).toBe(3593600);
      
      // 이익률 확인
      expect(result.profitRate).toBeGreaterThan(0);
      
      // 상세 내역 확인
      expect(result.details?.onlineRevenue).toBe(2195700);
      expect(result.details?.offlineRevenue).toBe(4371000);
      expect(result.details?.mazeLandPayment).toBe(2287000);
      expect(result.details?.culturePayment).toBe(1143500);
      expect(result.details?.platformFeeIncome).toBe(457400);
    });
  });
  
  describe('calculateMazeSettlement - 메이즈랜드 정산 계산', () => {
    it('메이즈랜드 정산이 정확히 계산되어야 함', () => {
      const totalCount = 2287;
      const result = calculateMazeSettlement(totalCount);
      
      // 매출 = 1000 * 2287 = 2,287,000
      expect(result.revenue).toBe(2287000);
      expect(result.income).toBe(2287000);
      
      // 비용 = 500 * 2287 = 1,143,500
      expect(result.cost).toBe(1143500);
      
      // 이익 = 500 * 2287 = 1,143,500
      expect(result.profit).toBe(1143500);
      
      // 이익률 = 50%
      expect(result.profitRate).toBe(50);
    });
  });
  
  describe('calculateCultureSettlement - 컬처커넥션 정산 계산', () => {
    it('컬처커넥션 정산이 정확히 계산되어야 함', () => {
      const totalCount = 2287;
      const result = calculateCultureSettlement(totalCount);
      
      // 매출 = (500 + 500) * 2287 = 2,287,000
      expect(result.revenue).toBe(2287000);
      expect(result.income).toBe(2287000);
      
      // 비용 = 200 * 2287 = 457,400
      expect(result.cost).toBe(457400);
      
      // 이익 = 800 * 2287 = 1,829,600
      expect(result.profit).toBe(1829600);
      
      // 이익률 = 80%
      expect(result.profitRate).toBe(80);
    });
  });
  
  describe('calculateAgencySettlement - 운영대행사 정산 계산', () => {
    it('기본 수수료율 0%일 때', () => {
      const onlineResult = calculateOnlineSales(testOnlineSales);
      const offlineResult = calculateOfflineSales(testOfflineCount);
      const skpSettlement = calculateSkpSettlement(onlineResult, offlineResult);
      const totalCount = 2287;
      
      const result = calculateAgencySettlement(skpSettlement, totalCount);
      
      // 기본 수수료율 0%이므로 매출/이익 모두 0
      expect(result.revenue).toBe(0);
      expect(result.profit).toBe(0);
    });
    
    it('수수료율 5% 설정시', () => {
      const customConfig: SettlementConfig = {
        ...DEFAULT_SETTLEMENT_CONFIG,
        company: {
          ...DEFAULT_SETTLEMENT_CONFIG.company,
          agencyFeeRate: 5, // 5%
          agencyFeeBase: 'SKP_REVENUE',
        },
      };
      
      const onlineResult = calculateOnlineSales(testOnlineSales, customConfig);
      const offlineResult = calculateOfflineSales(testOfflineCount, customConfig);
      const skpSettlement = calculateSkpSettlement(onlineResult, offlineResult, customConfig);
      const totalCount = 2287;
      
      const result = calculateAgencySettlement(skpSettlement, totalCount, customConfig);
      
      // SKP 매출의 5%
      expect(result.revenue).toBe(Math.round(skpSettlement.revenue * 0.05));
      expect(result.details?.agencyFeeRate).toBe(5);
    });
  });
  
  describe('calculateSettlement - 전체 정산 계산', () => {
    it('전체 정산 결과가 정확히 반환되어야 함', () => {
      const input: SalesInput = {
        onlineSales: testOnlineSales,
        offlineCount: testOfflineCount,
      };
      
      const periodStart = new Date('2024-11-01');
      const periodEnd = new Date('2024-11-30');
      
      const result = calculateSettlement(input, periodStart, periodEnd);
      
      // 기본 정보 확인
      expect(result.totalCount).toBe(2287);
      expect(result.onlineCount).toBe(830);
      expect(result.offlineCount).toBe(1457);
      
      // 4개 회사 정산 존재
      expect(result.settlements).toHaveLength(4);
      
      // 채널별 breakdown 존재
      expect(result.channelBreakdown).toHaveLength(4);
      
      // 계산 시점 존재
      expect(result.calculatedAt).toBeInstanceOf(Date);
    });
    
    it('인터넷 판매만 있을 때', () => {
      const input: SalesInput = {
        onlineSales: testOnlineSales,
        offlineCount: 0,
      };
      
      const result = calculateSettlement(
        input,
        new Date('2024-11-01'),
        new Date('2024-11-30')
      );
      
      expect(result.totalCount).toBe(830);
      expect(result.onlineCount).toBe(830);
      expect(result.offlineCount).toBe(0);
    });
    
    it('현장 판매만 있을 때', () => {
      const input: SalesInput = {
        onlineSales: [],
        offlineCount: testOfflineCount,
      };
      
      const result = calculateSettlement(
        input,
        new Date('2024-11-01'),
        new Date('2024-11-30')
      );
      
      expect(result.totalCount).toBe(1457);
      expect(result.onlineCount).toBe(0);
      expect(result.offlineCount).toBe(1457);
    });
  });
  
  describe('calculateSimpleSettlement - 간단 정산 계산', () => {
    it('평균 수수료율로 대략적인 정산 계산', () => {
      const result = calculateSimpleSettlement(830, 1457, 12);
      
      expect(result.totalCount).toBe(2287);
      expect(result.onlineCount).toBe(830);
      expect(result.offlineCount).toBe(1457);
      expect(result.settlements).toHaveLength(4);
    });
  });
  
  describe('getCompanySettlement - 특정 회사 정산 조회', () => {
    it('SKP 정산만 조회', () => {
      const input: SalesInput = {
        onlineSales: testOnlineSales,
        offlineCount: testOfflineCount,
      };
      
      const result = calculateSettlement(
        input,
        new Date('2024-11-01'),
        new Date('2024-11-30')
      );
      
      const skp = getCompanySettlement(result, 'SKP');
      expect(skp).toBeDefined();
      expect(skp?.companyCode).toBe('SKP');
    });
    
    it('존재하지 않는 회사 조회시 undefined', () => {
      const input: SalesInput = {
        onlineSales: testOnlineSales,
        offlineCount: testOfflineCount,
      };
      
      const result = calculateSettlement(
        input,
        new Date('2024-11-01'),
        new Date('2024-11-30')
      );
      
      const unknown = getCompanySettlement(result, 'UNKNOWN');
      expect(unknown).toBeUndefined();
    });
  });
  
  describe('formatSettlementSummary - 정산 요약 포맷팅', () => {
    it('한글 요약 문자열 생성', () => {
      const input: SalesInput = {
        onlineSales: testOnlineSales,
        offlineCount: testOfflineCount,
      };
      
      const result = calculateSettlement(
        input,
        new Date('2024-11-01'),
        new Date('2024-11-30')
      );
      
      const summary = formatSettlementSummary(result);
      
      expect(summary).toContain('정산 요약');
      expect(summary).toContain('전체 인원');
      expect(summary).toContain('SKP');
      expect(summary).toContain('메이즈랜드');
      expect(summary).toContain('컬처커넥션');
      expect(summary).toContain('운영대행사');
    });
  });
  
  describe('커스텀 설정 테스트', () => {
    it('기본 가격 변경시 정산 변경', () => {
      const customConfig: SettlementConfig = {
        ...DEFAULT_SETTLEMENT_CONFIG,
        basePrice: 5000, // 기본 가격을 5000원으로
      };
      
      const input: SalesInput = {
        onlineSales: [{ channelCode: 'NAVER_MAZE_25', channelName: '네이버', count: 100 }],
        offlineCount: 100,
      };
      
      const result = calculateSettlement(
        input,
        new Date('2024-11-01'),
        new Date('2024-11-30'),
        customConfig
      );
      
      // 인터넷: 100 * 5000 * 0.9 = 450,000
      // 현장: 100 * 5000 = 500,000
      const skp = getCompanySettlement(result, 'SKP');
      expect(skp?.revenue).toBe(950000);
    });
    
    it('채널 수수료율 변경시 정산 변경', () => {
      const customConfig: SettlementConfig = {
        ...DEFAULT_SETTLEMENT_CONFIG,
        channelFeeRates: {
          ...DEFAULT_SETTLEMENT_CONFIG.channelFeeRates,
          'NAVER_MAZE_25': 5, // 10% → 5%로 변경
        },
      };
      
      const result = calculateChannelRevenue(
        { channelCode: 'NAVER_MAZE_25', channelName: '네이버', count: 100 },
        customConfig
      );
      
      expect(result.fee).toBe(15000); // 300,000 * 5%
      expect(result.netRevenue).toBe(285000);
    });
  });
  
  describe('엣지 케이스', () => {
    it('모든 인원이 0명일 때', () => {
      const input: SalesInput = {
        onlineSales: [],
        offlineCount: 0,
      };
      
      const result = calculateSettlement(
        input,
        new Date('2024-11-01'),
        new Date('2024-11-30')
      );
      
      expect(result.totalCount).toBe(0);
      result.settlements.forEach(s => {
        expect(s.revenue).toBe(0);
        expect(s.profit).toBe(0);
      });
    });
    
    it('매우 큰 인원수 처리', () => {
      const input: SalesInput = {
        onlineSales: [
          { channelCode: 'NAVER_MAZE_25', channelName: '네이버', count: 1000000 },
        ],
        offlineCount: 1000000,
      };
      
      const result = calculateSettlement(
        input,
        new Date('2024-11-01'),
        new Date('2024-11-30')
      );
      
      expect(result.totalCount).toBe(2000000);
      // 큰 숫자도 정확히 계산되는지 확인
      expect(result.settlements[0].revenue).toBeGreaterThan(0);
    });
  });
});

describe('실제 데이터 시뮬레이션 (11월 8-30일 기준)', () => {
  it('월계 데이터로 정산 계산', () => {
    // 실제 데이터 기준 (월계)
    // 인터넷 판매: 830건
    // 현장 판매: 1,457건
    // 전체: 2,287건
    
    const input: SalesInput = {
      onlineSales: [
        { channelCode: 'NAVER_MAZE_25', channelName: '네이버 메이즈랜드25년', count: 300 },
        { channelCode: 'MAZE_TICKET', channelName: '메이즈랜드 입장권', count: 200 },
        { channelCode: 'MAZE_TICKET_SINGLE', channelName: '메이즈랜드 입장권(단품)', count: 180 },
        { channelCode: 'GENERAL_TICKET', channelName: '일반채널 입장권', count: 150 },
      ],
      offlineCount: 1457,
    };
    
    const result = calculateSettlement(
      input,
      new Date('2024-11-08'),
      new Date('2024-11-30')
    );
    
    console.log('\n' + formatSettlementSummary(result));
    
    // 기본 검증
    expect(result.totalCount).toBe(2287);
    
    // SKP 검증
    const skp = getCompanySettlement(result, 'SKP');
    expect(skp).toBeDefined();
    expect(skp!.profit).toBeGreaterThan(0);
    
    // 메이즈랜드 검증: 이익 = 500 * 2287 = 1,143,500
    const maze = getCompanySettlement(result, 'MAZE');
    expect(maze?.profit).toBe(1143500);
    
    // 컬처커넥션 검증: 이익 = 800 * 2287 = 1,829,600
    const culture = getCompanySettlement(result, 'CULTURE');
    expect(culture?.profit).toBe(1829600);
  });
});



