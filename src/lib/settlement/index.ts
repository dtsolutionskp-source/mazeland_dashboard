/**
 * 메이즈랜드 정산 시스템 - 모듈 진입점
 * 
 * 정산 관련 모든 기능을 이 파일에서 export합니다.
 */

// 타입 정의
export * from './types';

// 설정 및 상수
export {
  DEFAULT_SETTLEMENT_CONFIG,
  CHANNEL_NAME_MAP,
  CHANNEL_CODE_TO_NAME,
  COMPANY_CODE_TO_NAME,
  getChannelCode,
  getChannelFeeRate,
} from './config';

// 계산 함수들
export {
  calculateSettlement,
  createSalesInput,
  getSettlementByCompany,
  maskSettlementForCompany,
} from './calculator';
