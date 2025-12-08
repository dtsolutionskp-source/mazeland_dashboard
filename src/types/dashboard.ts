/**
 * 대시보드 관련 타입 정의
 */

// 일별 데이터
export interface DailyData {
  date: string
  dateLabel: string
  online: number
  offline: number
  total: number
}

// 요약 데이터
export interface SummaryData {
  totalVisitors: number
  onlineCount: number
  offlineCount: number
  onlineRatio: number
  offlineRatio: number
  totalRevenue: number
  totalFee?: number
  totalNetRevenue?: number
}

// 전월비 데이터
export interface ComparisonData {
  value: number
  type: 'increase' | 'decrease' | 'same'
  percent: number
}

// 월별 데이터 (API 응답)
export interface MonthlyDashboardData {
  current: {
    year: number
    month: number
    summary: SummaryData
    dailyTrend: DailyData[]
    channels: ChannelData[]
    categories: CategoryData[]
    settlement: SettlementData[]
  }
  prev: {
    year: number
    month: number
    summary: SummaryData
    dailyTrend: DailyData[]
  } | null
  comparison: {
    totalVisitors: ComparisonData
    onlineCount: ComparisonData
    offlineCount: ComparisonData
    totalRevenue: ComparisonData
  } | null
  availableMonths: { year: number; month: number }[]
}

// 채널 데이터
export interface ChannelData {
  code: string
  name: string
  count: number
  revenue: number
  feeRate: number
  fee: number
  netRevenue: number
}

// 구분 데이터
export interface CategoryData {
  code: string
  name: string
  count: number
}

// 정산 데이터
export interface SettlementData {
  companyCode: string
  companyName: string
  revenue: number
  income: number
  cost: number
  profit: number
  profitRate: number
}

// 마케팅 로그
export interface MarketingLog {
  id: string
  date: string
  type: 'CAMPAIGN' | 'WEATHER' | 'EVENT' | 'MAINTENANCE' | 'OTHER'
  title: string
  content?: string
}

// 뷰 모드
export type ViewMode = 'single' | 'cumulative'

