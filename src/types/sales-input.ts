/**
 * 판매 데이터 입력 관련 타입 정의
 */

// 데이터 소스 (입력 방식)
export type DataSource = 'file' | 'manual' | 'mixed'

// InputMode는 DataSource의 별칭 (하위 호환성)
export type InputMode = DataSource

// 마스터 데이터 타입은 sales-data.ts에서 re-export
export type { ChannelMaster, CategoryMaster, MasterData as MasterDataBase } from './sales-data'

// 확장된 ChannelMaster (feeRate 별칭 지원)
export interface ChannelMasterWithFeeRate {
  code: string
  name: string
  feeRate: number        // 수수료율 (%)
  defaultFeeRate?: number // 기본 수수료율 (하위 호환성)
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

// 마스터 데이터 전체 (sales-data.ts에서 re-export)
import type { MasterData as MasterDataType } from './sales-data'
export type { MasterData } from './sales-data'

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
  masterData: MasterDataType
  error?: string
}

