/**
 * 마스터 데이터 관리
 * - 채널 목록 (인터넷 판매)
 * - 카테고리 목록 (현장 판매)
 */

import { ChannelMaster, CategoryMaster, MasterData } from '@/types/sales-data'

// 채널 마스터 데이터 (인터넷 판매)
export const CHANNEL_MASTER: ChannelMaster[] = [
  { code: 'NAVER_MAZE_25', name: '네이버 메이즈랜드25년', defaultFeeRate: 10, order: 1, active: true },
  { code: 'GENERAL_TICKET', name: '일반채널 입장권', defaultFeeRate: 15, order: 2, active: true },
  { code: 'MAZE_TICKET', name: '메이즈랜드 입장권', defaultFeeRate: 12, order: 3, active: true },
  { code: 'MAZE_TICKET_SINGLE', name: '메이즈랜드 입장권(단품)', defaultFeeRate: 12, order: 4, active: true },
  { code: 'OTHER', name: '기타', defaultFeeRate: 15, order: 99, active: true },
]

// 카테고리 마스터 데이터 (현장 판매)
export const CATEGORY_MASTER: CategoryMaster[] = [
  { code: 'INDIVIDUAL', name: '개인', order: 1, active: true },
  { code: 'TRAVEL_AGENCY', name: '여행사', order: 2, active: true },
  { code: 'TAXI', name: '택시', order: 3, active: true },
  { code: 'RESIDENT', name: '도민', order: 4, active: true },
  { code: 'ALL_PASS', name: '올패스', order: 5, active: true },
  { code: 'SHUTTLE_DISCOUNT', name: '순환버스할인', order: 6, active: true },
  { code: 'SCHOOL_GROUP', name: '학단', order: 7, active: true },
  { code: 'OTHER', name: '기타', order: 99, active: true },
]

/**
 * 전체 마스터 데이터 조회
 */
export function getMasterData(): MasterData {
  return {
    channels: CHANNEL_MASTER.filter(c => c.active).sort((a, b) => a.order - b.order),
    categories: CATEGORY_MASTER.filter(c => c.active).sort((a, b) => a.order - b.order),
  }
}

/**
 * 채널 코드로 채널 정보 조회
 */
export function getChannelByCode(code: string): ChannelMaster | undefined {
  return CHANNEL_MASTER.find(c => c.code === code)
}

/**
 * 카테고리 코드로 카테고리 정보 조회
 */
export function getCategoryByCode(code: string): CategoryMaster | undefined {
  return CATEGORY_MASTER.find(c => c.code === code)
}

/**
 * 채널 수수료율 조회
 */
export function getChannelFeeRate(code: string): number {
  const channel = getChannelByCode(code)
  return channel?.defaultFeeRate ?? 15 // 기본값 15%
}

/**
 * 채널명 조회
 */
export function getChannelName(code: string): string {
  const channel = getChannelByCode(code)
  return channel?.name ?? code
}

/**
 * 카테고리명 조회
 */
export function getCategoryName(code: string): string {
  const category = getCategoryByCode(code)
  return category?.name ?? code
}

// 상수 내보내기
export const BASE_PRICE = 3000  // 기본 티켓 가격
export const MAZE_UNIT = 1000   // 메이즈랜드 단가
export const CULTURE_UNIT = 1000 // 컬처커넥션 단가
export const PLATFORM_FEE_UNIT = 200 // 플랫폼 이용료
export const AGENCY_FEE_RATE = 0.20  // FMC 수수료율
