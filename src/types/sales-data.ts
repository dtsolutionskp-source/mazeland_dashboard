/**
 * 판매 데이터 관련 타입 정의
 * - 일자별 데이터 (DailyAgg)
 * - 월별 집계 (MonthlyAgg)
 * - 수수료 정책 (ChannelFeePolicy)
 */

// ==========================================
// 공통 타입
// ==========================================

export type DataSource = 'file' | 'manual' | 'mixed'
export type SaleType = 'internet' | 'onsite'
export type InputMode = 'monthly' | 'daily'  // 입력 모드: 월 합계 / 일자별

// ==========================================
// 채널/카테고리 마스터
// ==========================================

export interface ChannelMaster {
  code: string
  name: string
  defaultFeeRate: number  // 기본 수수료율 (%)
  order: number
  active: boolean
}

export interface CategoryMaster {
  code: string
  name: string
  order: number
  active: boolean
}

// ==========================================
// 수수료 정책 (채널 × 월 기준)
// ==========================================

/**
 * 채널별 월간 수수료 정책
 * - 특정 연/월에 적용되는 채널별 기본 수수료율
 */
export interface ChannelMonthlyFee {
  channelCode: string
  channelName: string
  year: number
  month: number
  feeRate: number        // 이 달의 기본 수수료율 (%)
  source: 'default' | 'excel' | 'manual'  // 수수료 출처
}

/**
 * 수수료 기간별 예외 (Override)
 * - 특정 기간 동안만 다른 수수료율 적용
 */
export interface ChannelFeeOverride {
  id: string
  channelCode: string
  startDate: string      // YYYY-MM-DD
  endDate: string        // YYYY-MM-DD
  feeRate: number        // 예외 수수료율 (%)
  reason?: string        // 변경 사유
}

/**
 * 월간 수수료 설정 전체
 */
export interface MonthlyFeeSettings {
  year: number
  month: number
  channels: ChannelMonthlyFee[]
  overrides: ChannelFeeOverride[]
  updatedAt: string
}

// ==========================================
// 일자별 집계 데이터 (DailyAgg)
// ==========================================

/**
 * 일자별 채널 판매 데이터 (인터넷)
 */
export interface DailyChannelSale {
  date: string           // YYYY-MM-DD
  channelCode: string
  channelName: string
  count: number
  feeRate: number        // 해당 일자에 적용된 수수료율
  // 자동 계산 필드
  grossRevenue?: number   // 총 매출 (3,000 × count)
  fee?: number            // 수수료 금액
  netRevenue?: number     // 순매출
}

/**
 * 일자별 카테고리 판매 데이터 (현장)
 */
export interface DailyCategorySale {
  date: string           // YYYY-MM-DD
  categoryCode: string
  categoryName: string
  count: number
  // 자동 계산 필드
  revenue?: number        // 매출 (3,000 × count)
}

/**
 * 일자별 집계 요약
 */
export interface DailyAggSummary {
  date: string
  onlineCount: number
  offlineCount: number
  totalCount: number
  onlineNetRevenue: number
  offlineRevenue: number
  totalNetRevenue: number
}

/**
 * 일자별 전체 데이터
 */
export interface DailyAggData {
  date: string
  channelSales: DailyChannelSale[]    // 채널별 인터넷 판매
  categorySales: DailyCategorySale[]  // 구분별 현장 판매
  summary: DailyAggSummary
  source: DataSource
}

// ==========================================
// 월별 집계 데이터 (MonthlyAgg)
// ==========================================

/**
 * 월별 채널 집계
 */
export interface MonthlyChannelAgg {
  channelCode: string
  channelName: string
  avgFeeRate: number      // 평균 수수료율 (기간별 override 고려)
  totalCount: number
  grossRevenue: number
  totalFee: number
  netRevenue: number
}

/**
 * 월별 카테고리 집계
 */
export interface MonthlyCategoryAgg {
  categoryCode: string
  categoryName: string
  totalCount: number
  revenue: number
}

/**
 * 월별 집계 전체
 */
export interface MonthlyAggData {
  year: number
  month: number
  source: DataSource
  uploadedAt: string
  
  // 수수료 설정
  feeSettings: MonthlyFeeSettings
  
  // 일자별 상세 데이터
  dailyData: DailyAggData[]
  
  // 채널별 월 집계
  channelAggs: MonthlyChannelAgg[]
  
  // 카테고리별 월 집계
  categoryAggs: MonthlyCategoryAgg[]
  
  // 월간 요약
  summary: {
    totalDays: number           // 데이터가 있는 일수
    onlineCount: number
    offlineCount: number
    totalCount: number
    onlineGrossRevenue: number
    onlineFee: number
    onlineNetRevenue: number
    offlineRevenue: number
    totalGrossRevenue: number
    totalNetRevenue: number
  }
}

// ==========================================
// API 요청/응답
// ==========================================

export interface GetMonthlyDataRequest {
  year: number
  month: number
}

export interface SaveDailyDataRequest {
  year: number
  month: number
  date: string             // 특정 일자 저장 시
  channelSales: DailyChannelSale[]
  categorySales: DailyCategorySale[]
  source: DataSource
}

export interface SaveMonthlyFeeRequest {
  year: number
  month: number
  channels: ChannelMonthlyFee[]
  overrides?: ChannelFeeOverride[]
}

export interface GetFeeRateRequest {
  channelCode: string
  date: string             // YYYY-MM-DD
  year: number
  month: number
}

// ==========================================
// 마스터 데이터
// ==========================================

export interface MasterData {
  channels: ChannelMaster[]
  categories: CategoryMaster[]
}

