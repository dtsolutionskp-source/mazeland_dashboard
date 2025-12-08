/**
 * 판매 데이터 입력 관련 타입 정의
 */

// 입력 방식
export type InputMode = 'file' | 'manual' | 'mixed'

// 데이터 소스
export type DataSource = 'file' | 'manual' | 'mixed'

// 채널 마스터 데이터
export interface ChannelMaster {
  code: string
  name: string
  feeRate: number  // 수수료율 (%)
  order: number    // 정렬 순서
  active: boolean  // 활성화 여부
}

// 카테고리 마스터 데이터
export interface CategoryMaster {
  code: string
  name: string
  order: number
  active: boolean
}

// 채널별 판매 데이터 (인터넷)
export interface ChannelSalesData {
  channelCode: string
  channelName: string
  feeRate: number
  count: number
  // 자동 계산 필드
  grossRevenue?: number   // 총 매출 (3,000 × count)
  fee?: number            // 수수료
  netRevenue?: number     // 순매출
}

// 카테고리별 판매 데이터 (현장)
export interface CategorySalesData {
  categoryCode: string
  categoryName: string
  count: number
  // 자동 계산 필드
  revenue?: number  // 매출 (3,000 × count)
}

// 월간 집계 데이터
export interface MonthlyAggData {
  id?: string
  year: number
  month: number
  source: DataSource
  uploadedAt: string
  
  // 인터넷 판매 (채널별)
  channels: ChannelSalesData[]
  
  // 현장 판매 (구분별)
  categories: CategorySalesData[]
  
  // 합계
  summary: {
    onlineCount: number
    offlineCount: number
    totalCount: number
    onlineRevenue: number
    onlineFee: number
    onlineNetRevenue: number
    offlineRevenue: number
    totalRevenue: number
    totalNetRevenue: number
  }
  
  // 일별 데이터 (엑셀 업로드 시에만)
  dailyData?: {
    date: string
    online: number
    offline: number
    total: number
  }[]
}

// 마스터 데이터 전체
export interface MasterData {
  channels: ChannelMaster[]
  categories: CategoryMaster[]
}

// API 요청/응답 타입
export interface SaveSalesDataRequest {
  year: number
  month: number
  source: DataSource
  channels: ChannelSalesData[]
  categories: CategorySalesData[]
  dailyData?: MonthlyAggData['dailyData']
}

export interface SaveSalesDataResponse {
  success: boolean
  data?: MonthlyAggData
  error?: string
}

export interface GetSalesDataResponse {
  success: boolean
  data?: MonthlyAggData
  masterData: MasterData
  error?: string
}

