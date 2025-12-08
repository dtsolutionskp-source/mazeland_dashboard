/**
 * 메이즈랜드 정산 시스템 - 타입 정의
 */

// 채널 코드 타입
export type ChannelCode = 
  | 'NAVER_MAZE_25'      // 네이버 메이즈랜드25년
  | 'MAZE_TICKET'        // 메이즈랜드 입장권
  | 'MAZE_TICKET_SINGLE' // 메이즈랜드 입장권(단품)
  | 'GENERAL_TICKET'     // 일반채널 입장권
  | 'OTHER';             // 기타 채널

// 판매 유형
export type SaleType = 'ONLINE' | 'OFFLINE';

// 회사 코드
export type CompanyCode = 'SKP' | 'MAZE' | 'CULTURE' | 'AGENCY';

// 채널별 인원 데이터
export interface ChannelSalesData {
  channelCode: ChannelCode;
  channelName: string;
  count: number; // 인원 수
}

// 판매 데이터 입력
export interface SalesInput {
  // 인터넷 판매 채널별 인원
  onlineSales: ChannelSalesData[];
  // 현장 판매 인원
  offlineCount: number;
}

// 회사별 정산 결과
export interface CompanySettlement {
  companyCode: CompanyCode;
  companyName: string;
  revenue: number;      // 매출
  income: number;       // 수익 (매출 + 기타 수익)
  cost: number;         // 비용
  profit: number;       // 이익
  profitRate: number;   // 이익률 (%)
  details?: SettlementDetails; // 상세 내역
}

// 정산 상세 내역
export interface SettlementDetails {
  // SKP 전용
  onlineRevenue?: number;       // 인터넷 판매 매출
  offlineRevenue?: number;      // 현장 판매 매출
  channelFees?: number;         // 채널 수수료 총액
  mazeLandPayment?: number;     // 메이즈랜드 지급액
  culturePayment?: number;      // 컬처커넥션 지급액
  platformFeeIncome?: number;   // 플랫폼 이용료 수입 (컬처에서 받음)
  ticketProfit?: number;        // 티켓 판매 순이익 (플랫폼료 제외)
  agencyPayment?: number;       // 운영대행사 지급액
  
  // 메이즈랜드 전용
  skpIncome?: number;           // SKP로부터 받는 금액
  culturePayout?: number;       // 컬처커넥션 지급액
  
  // 컬처커넥션 전용
  skpIncome2?: number;          // SKP로부터 받는 금액
  mazeIncome?: number;          // 메이즈랜드로부터 받는 금액
  platformFeePayout?: number;   // 플랫폼 이용료 지급액
  
  // 운영대행사 전용
  agencyFeeRate?: number;       // 수수료율
  basedOn?: string;             // 계산 기준
  skpTicketProfit?: number;     // SKP 티켓 순이익 (수수료 계산 베이스)
}

// 전체 정산 결과
export interface SettlementResult {
  // 기간 정보
  periodStart: Date;
  periodEnd: Date;
  
  // 인원 요약
  totalCount: number;    // 전체 인원
  onlineCount: number;   // 인터넷 인원
  offlineCount: number;  // 현장 인원
  
  // 회사별 정산
  settlements: CompanySettlement[];
  
  // 채널별 상세
  channelBreakdown: {
    channelCode: ChannelCode;
    channelName: string;
    count: number;
    revenue: number;
    fee: number;
    netRevenue: number;
  }[];
  
  // 계산 시점
  calculatedAt: Date;
}

// 정산 설정 (파라미터화)
export interface SettlementConfig {
  // 기본 가격
  basePrice: number; // 기본 1인당 판매 가격 (기본: 3000)
  
  // 채널별 수수료율 (%)
  channelFeeRates: Record<ChannelCode, number>;
  
  // 회사별 정산 파라미터
  company: {
    // 메이즈랜드 지급 단가
    mazePaymentPerPerson: number; // 기본: 1000
    
    // 컬처커넥션 관련
    culturePaymentFromSkp: number;  // SKP가 컬처커넥션에 지급 (기본: 500)
    culturePaymentFromMaze: number; // 메이즈랜드가 컬처커넥션에 지급 (기본: 500)
    platformFeeToSkp: number;       // 컬처커넥션이 SKP에 지급하는 플랫폼 이용료 (기본: 200)
    
    // 운영대행사 관련
    agencyFeeRate: number;          // 운영대행사 수수료율 (%) (기본: 20)
    agencyFeeBase: 'SKP_TICKET_PROFIT' | 'SKP_REVENUE' | 'SKP_TOTAL_PROFIT'; // 수수료 계산 기준
  };
}
