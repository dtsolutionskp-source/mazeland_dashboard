/**
 * 정산 계산 예제
 * 
 * 이 파일은 정산 모듈의 사용 방법을 보여줍니다.
 * 실행: npx ts-node src/examples/settlement-example.ts
 */

import {
  calculateSettlement,
  calculateSimpleSettlement,
  formatSettlementSummary,
  getCompanySettlement,
  DEFAULT_SETTLEMENT_CONFIG,
  SalesInput,
  SettlementConfig,
} from '../lib/settlement';

console.log('='.repeat(60));
console.log('메이즈랜드 정산 계산 예제');
console.log('='.repeat(60));

// 1. 기본 사용법: 채널별 상세 데이터로 정산 계산
console.log('\n[예제 1] 채널별 상세 데이터로 정산 계산\n');

const salesInput: SalesInput = {
  onlineSales: [
    { channelCode: 'NAVER_MAZE_25', channelName: '네이버 메이즈랜드25년', count: 300 },
    { channelCode: 'MAZE_TICKET', channelName: '메이즈랜드 입장권', count: 200 },
    { channelCode: 'MAZE_TICKET_SINGLE', channelName: '메이즈랜드 입장권(단품)', count: 180 },
    { channelCode: 'GENERAL_TICKET', channelName: '일반채널 입장권', count: 150 },
  ],
  offlineCount: 1457, // 현장 판매
};

const result = calculateSettlement(
  salesInput,
  new Date('2024-11-08'),
  new Date('2024-11-30')
);

console.log(formatSettlementSummary(result));

// 2. 채널별 상세 내역
console.log('\n[예제 2] 채널별 수수료 상세\n');
console.log('채널명\t\t\t\t인원\t매출\t\t수수료\t\t순매출');
console.log('-'.repeat(80));
result.channelBreakdown.forEach(ch => {
  console.log(
    `${ch.channelName.padEnd(20)}\t${ch.count}\t${ch.revenue.toLocaleString()}원\t${ch.fee.toLocaleString()}원\t${ch.netRevenue.toLocaleString()}원`
  );
});

// 3. 특정 회사 정산만 조회
console.log('\n[예제 3] 특정 회사 정산 조회\n');
const skp = getCompanySettlement(result, 'SKP');
if (skp) {
  console.log(`SKP 정산 상세:`);
  console.log(`  - 매출: ${skp.revenue.toLocaleString()}원`);
  console.log(`  - 수익: ${skp.income.toLocaleString()}원`);
  console.log(`  - 비용: ${skp.cost.toLocaleString()}원`);
  console.log(`  - 이익: ${skp.profit.toLocaleString()}원`);
  console.log(`  - 이익률: ${skp.profitRate}%`);
  console.log(`  - 상세:`);
  console.log(`    · 인터넷 매출: ${skp.details?.onlineRevenue?.toLocaleString()}원`);
  console.log(`    · 현장 매출: ${skp.details?.offlineRevenue?.toLocaleString()}원`);
  console.log(`    · 채널 수수료 총액: ${skp.details?.channelFees?.toLocaleString()}원`);
  console.log(`    · 메이즈랜드 지급: ${skp.details?.mazeLandPayment?.toLocaleString()}원`);
  console.log(`    · 컬처커넥션 지급: ${skp.details?.culturePayment?.toLocaleString()}원`);
  console.log(`    · 플랫폼 이용료 수입: ${skp.details?.platformFeeIncome?.toLocaleString()}원`);
}

// 4. 간단한 정산 (인원 수만으로)
console.log('\n[예제 4] 간단 정산 (인원 수만으로 계산)\n');
const simpleResult = calculateSimpleSettlement(830, 1457, 12); // 평균 수수료 12%
console.log(`전체 인원: ${simpleResult.totalCount.toLocaleString()}명`);
console.log(`인터넷: ${simpleResult.onlineCount.toLocaleString()}명`);
console.log(`현장: ${simpleResult.offlineCount.toLocaleString()}명`);
console.log(`\n회사별 이익:`);
simpleResult.settlements.forEach(s => {
  console.log(`  ${s.companyName}: ${s.profit.toLocaleString()}원 (이익률: ${s.profitRate}%)`);
});

// 5. 커스텀 설정으로 계산
console.log('\n[예제 5] 커스텀 설정 (운영대행사 수수료 5% 적용)\n');
const customConfig: SettlementConfig = {
  ...DEFAULT_SETTLEMENT_CONFIG,
  company: {
    ...DEFAULT_SETTLEMENT_CONFIG.company,
    agencyFeeRate: 5, // 운영대행사 수수료 5%
    agencyFeeBase: 'SKP_REVENUE',
  },
};

const customResult = calculateSettlement(
  salesInput,
  new Date('2024-11-08'),
  new Date('2024-11-30'),
  customConfig
);

const agency = getCompanySettlement(customResult, 'AGENCY');
console.log(`운영대행사 정산 (SKP 매출의 5%):`);
console.log(`  - 매출: ${agency?.revenue.toLocaleString()}원`);
console.log(`  - 이익: ${agency?.profit.toLocaleString()}원`);

// 6. 정산 비율 검증
console.log('\n[예제 6] 정산 흐름 검증\n');
const maze = getCompanySettlement(result, 'MAZE');
const culture = getCompanySettlement(result, 'CULTURE');
const skpResult = getCompanySettlement(result, 'SKP');

console.log('자금 흐름:');
console.log(`  1. 총 티켓 판매 수입`);
console.log(`     - 인터넷: ${result.onlineCount} × 3,000원 = ${(result.onlineCount * 3000).toLocaleString()}원`);
console.log(`     - 현장: ${result.offlineCount} × 3,000원 = ${(result.offlineCount * 3000).toLocaleString()}원`);
console.log(`     - 합계: ${(result.totalCount * 3000).toLocaleString()}원`);
console.log(`\n  2. 채널 수수료 (인터넷만): ${result.channelBreakdown.reduce((s, c) => s + c.fee, 0).toLocaleString()}원`);
console.log(`\n  3. SKP 수취:`);
console.log(`     - 순매출: ${skpResult?.revenue.toLocaleString()}원`);
console.log(`     - 플랫폼 이용료: ${skpResult?.details?.platformFeeIncome?.toLocaleString()}원`);
console.log(`\n  4. SKP → 메이즈랜드: ${maze?.revenue.toLocaleString()}원`);
console.log(`\n  5. SKP → 컬처커넥션: ${skpResult?.details?.culturePayment?.toLocaleString()}원`);
console.log(`\n  6. 메이즈랜드 → 컬처커넥션: ${maze?.cost.toLocaleString()}원`);
console.log(`\n  7. 컬처커넥션 → SKP (플랫폼 이용료): ${culture?.cost.toLocaleString()}원`);

console.log('\n' + '='.repeat(60));
console.log('예제 실행 완료');
console.log('='.repeat(60));



