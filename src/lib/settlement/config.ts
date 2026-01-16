/**
 * 메이즈랜드 정산 시스템 - 설정
 * 
 * 정산 계산에 사용되는 모든 파라미터를 중앙 관리합니다.
 * 계산식이 변경되면 이 파일만 수정하면 됩니다.
 */

import { SettlementConfig, ChannelCode } from './types';

/**
 * 기본 정산 설정
 */
export const DEFAULT_SETTLEMENT_CONFIG: SettlementConfig = {
  // 기본 1인당 판매 가격
  basePrice: 3000,
  
  // 채널별 수수료율 (%)
  // 인터넷 판매분만 적용, 현장 판매는 수수료 없음
  channelFeeRates: {
    'NAVER_MAZE_25': 10,       // 네이버 메이즈랜드25년: 10%
    'MAZE_TICKET': 12,         // 메이즈랜드 입장권: 12%
    'MAZE_TICKET_SINGLE': 12,  // 메이즈랜드 입장권(단품): 12%
    'MAZE_25_SPECIAL': 10,     // 25특가: 10%
    'GENERAL_TICKET': 15,      // 일반채널 입장권: 15%
    'OTHER': 15,               // 기타 채널: 15% (기본값)
  },
  
  // 회사별 정산 파라미터
  company: {
    // 메이즈랜드 지급 단가 (SKP → 메이즈랜드)
    mazePaymentPerPerson: 1000,
    
    // 컬처커넥션 관련
    culturePaymentFromSkp: 500,   // SKP가 컬처커넥션에 지급하는 금액 (1인당)
    culturePaymentFromMaze: 500,  // 메이즈랜드가 컬처커넥션에 지급하는 금액 (1인당)
    platformFeeToSkp: 200,        // 컬처커넥션이 SKP에 지급하는 플랫폼 이용료 (1인당)
    
    // 운영대행사 관련
    // 수수료 = SKP의 "티켓 판매 순이익"의 20%
    // 주의: 플랫폼 이용료(200원)는 수수료 계산 베이스에서 제외
    agencyFeeRate: 20,            // 운영대행사 수수료율 (%)
    agencyFeeBase: 'SKP_TICKET_PROFIT', // 수수료 계산 기준 (티켓 순이익)
  },
};

/**
 * 채널명 → 채널코드 매핑
 * 엑셀 파일의 채널명을 시스템 채널코드로 변환
 */
export const CHANNEL_NAME_MAP: Record<string, ChannelCode> = {
  // 네이버 메이즈랜드25년 관련
  '네이버 메이즈랜드25년': 'NAVER_MAZE_25',
  '네이버 메이즈랜드 25년': 'NAVER_MAZE_25',
  '네이버메이즈랜드25년': 'NAVER_MAZE_25',
  'NAVER_MAZE_25': 'NAVER_MAZE_25',
  
  // 메이즈랜드 입장권 관련
  '메이즈랜드 입장권': 'MAZE_TICKET',
  '메이즈랜드입장권': 'MAZE_TICKET',
  'MAZE_TICKET': 'MAZE_TICKET',
  
  // 메이즈랜드 입장권(단품) 관련
  '메이즈랜드 입장권(단품)': 'MAZE_TICKET_SINGLE',
  '메이즈랜드입장권(단품)': 'MAZE_TICKET_SINGLE',
  '메이즈랜드 입장권 (단품)': 'MAZE_TICKET_SINGLE',
  'MAZE_TICKET_SINGLE': 'MAZE_TICKET_SINGLE',
  
  // 일반채널 입장권 관련
  '일반채널 입장권': 'GENERAL_TICKET',
  '일반채널입장권': 'GENERAL_TICKET',
  '일반채널': 'GENERAL_TICKET',
  'GENERAL_TICKET': 'GENERAL_TICKET',
  
  // 25특가 관련
  '25특가': 'MAZE_25_SPECIAL',
  'MAZE_25_SPECIAL': 'MAZE_25_SPECIAL',
};

/**
 * 채널코드 → 한글명 매핑
 */
export const CHANNEL_CODE_TO_NAME: Record<ChannelCode, string> = {
  'NAVER_MAZE_25': '네이버 메이즈랜드25년',
  'MAZE_TICKET': '메이즈랜드 입장권',
  'MAZE_TICKET_SINGLE': '메이즈랜드 입장권(단품)',
  'MAZE_25_SPECIAL': '25특가',
  'GENERAL_TICKET': '일반채널 입장권',
  'OTHER': '기타 채널',
};

/**
 * 회사코드 → 한글명 매핑
 */
export const COMPANY_CODE_TO_NAME: Record<string, string> = {
  'SKP': 'SKP',
  'MAZE': '메이즈랜드',
  'CULTURE': '컬처커넥션',
  'AGENCY': 'FMC',
};

/**
 * 채널명을 채널코드로 변환
 * @param channelName 채널명 (엑셀에서 읽은 값)
 * @returns 채널코드
 */
export function getChannelCode(channelName: string): ChannelCode {
  const normalized = channelName.trim();
  return CHANNEL_NAME_MAP[normalized] || 'OTHER';
}

/**
 * 채널코드의 수수료율 조회
 * @param channelCode 채널코드
 * @param config 정산 설정 (선택)
 * @returns 수수료율 (%)
 */
export function getChannelFeeRate(
  channelCode: ChannelCode,
  config: SettlementConfig = DEFAULT_SETTLEMENT_CONFIG
): number {
  return config.channelFeeRates[channelCode] ?? config.channelFeeRates['OTHER'];
}
