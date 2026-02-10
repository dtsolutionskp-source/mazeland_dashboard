import prisma from '@/lib/prisma'

// 정산 항목 ID
export type SettlementItemId = 
  | 'SKP_TO_MAZE_REVENUE'        // SKP → 메이즈랜드 (총매출 3,000원)
  | 'MAZE_TO_SKP_OPERATION'      // 메이즈랜드 → SKP (운영 수수료 1,000원)
  | 'CULTURE_TO_SKP'             // 컬처커넥션 → SKP (플랫폼 비용 1,000원)
  | 'SKP_TO_CULTURE_PLATFORM'    // SKP → 컬처커넥션 (플랫폼 이용료 20%)
  | 'MAZE_TO_SKP_CULTURE_SHARE'  // 메이즈랜드 → SKP (컬처 분담금 500원)
  | 'FMC_TO_SKP_AGENCY'          // FMC → SKP (운영대행 수수료 순이익 20%)

// 정산 항목 정보
export interface SettlementItem {
  id: SettlementItemId
  from: string           // 발행처
  to: string             // 수취처
  fromCode: string       // 발행처 코드
  toCode: string         // 수취처 코드
  description: string    // 설명
  type: 'revenue' | 'expense'  // 매출/비용
}

// 월별 정산 체크 상태
export interface MonthlySettlementCheck {
  yearMonth: string  // "2025-12"
  checks: {
    [key in SettlementItemId]?: {
      checked: boolean
      checkedAt?: string
      checkedBy?: string
      amount: number
    }
  }
  updatedAt: string
}

// 전체 정산 체크 데이터
export interface SettlementCheckData {
  [yearMonth: string]: MonthlySettlementCheck
}

// 정산 항목 정의
export const SETTLEMENT_ITEMS: SettlementItem[] = [
  {
    id: 'SKP_TO_MAZE_REVENUE',
    from: 'SKP',
    to: '메이즈랜드',
    fromCode: 'SKP',
    toCode: 'MAZE',
    description: '총매출 건 (인당 3,000원, 수수료 차감)',
    type: 'revenue',
  },
  {
    id: 'MAZE_TO_SKP_OPERATION',
    from: '메이즈랜드',
    to: 'SKP',
    fromCode: 'MAZE',
    toCode: 'SKP',
    description: '운영 수수료 (인당 1,000원, 수수료 차감)',
    type: 'expense',
  },
  {
    id: 'CULTURE_TO_SKP',
    from: '컬처커넥션',
    to: 'SKP',
    fromCode: 'CULTURE',
    toCode: 'SKP',
    description: '플랫폼 비용 (인당 1,000원, 수수료 차감)',
    type: 'expense',
  },
  {
    id: 'SKP_TO_CULTURE_PLATFORM',
    from: 'SKP',
    to: '컬처커넥션',
    fromCode: 'SKP',
    toCode: 'CULTURE',
    description: '플랫폼 이용료 (1,000원의 20%, 수수료 차감)',
    type: 'revenue',
  },
  {
    id: 'MAZE_TO_SKP_CULTURE_SHARE',
    from: '메이즈랜드',
    to: 'SKP',
    fromCode: 'MAZE',
    toCode: 'SKP',
    description: '컬처 분담금 (인당 500원, 메이즈 부담분)',
    type: 'expense',
  },
  {
    id: 'FMC_TO_SKP_AGENCY',
    from: 'FMC',
    to: 'SKP',
    fromCode: 'FMC',
    toCode: 'SKP',
    description: '운영대행 수수료 (SKP 순이익의 20%)',
    type: 'expense',
  },
]

// 회사별 정산 항목 필터
export function getItemsByCompany(companyCode: string): SettlementItem[] {
  return SETTLEMENT_ITEMS.filter(
    item => item.fromCode === companyCode || item.toCode === companyCode
  )
}

// 정산 체크 데이터 조회
export async function getSettlementChecks(): Promise<SettlementCheckData> {
  try {
    const checks = await prisma.settlementCheck.findMany()
    
    const result: SettlementCheckData = {}
    
    for (const check of checks) {
      const yearMonth = `${check.year}-${check.month.toString().padStart(2, '0')}`
      
      if (!result[yearMonth]) {
        result[yearMonth] = {
          yearMonth,
          checks: {},
          updatedAt: check.updatedAt.toISOString(),
        }
      }
      
      result[yearMonth].checks[check.itemId as SettlementItemId] = {
        checked: check.isChecked,
        checkedAt: check.checkedAt?.toISOString(),
        checkedBy: check.checkedById || undefined,
        amount: 0, // amount는 별도 계산 필요
      }
      
      // 가장 최신 업데이트 시간 사용
      if (new Date(check.updatedAt) > new Date(result[yearMonth].updatedAt)) {
        result[yearMonth].updatedAt = check.updatedAt.toISOString()
      }
    }
    
    return result
  } catch (error) {
    console.error('Get settlement checks error:', error)
    return {}
  }
}

// 특정 월의 정산 체크 조회
export async function getMonthlySettlementCheck(
  year: number, 
  month: number
): Promise<MonthlySettlementCheck | null> {
  try {
    const checks = await prisma.settlementCheck.findMany({
      where: { year, month },
    })
    
    if (checks.length === 0) return null
    
    const yearMonth = `${year}-${month.toString().padStart(2, '0')}`
    const result: MonthlySettlementCheck = {
      yearMonth,
      checks: {},
      updatedAt: new Date().toISOString(),
    }
    
    for (const check of checks) {
      result.checks[check.itemId as SettlementItemId] = {
        checked: check.isChecked,
        checkedAt: check.checkedAt?.toISOString(),
        checkedBy: check.checkedById || undefined,
        amount: 0,
      }
      
      if (new Date(check.updatedAt) > new Date(result.updatedAt)) {
        result.updatedAt = check.updatedAt.toISOString()
      }
    }
    
    return result
  } catch (error) {
    console.error('Get monthly settlement check error:', error)
    return null
  }
}

// 정산 항목 체크/해제
export async function toggleSettlementCheck(
  year: number,
  month: number,
  itemId: SettlementItemId,
  checked: boolean,
  amount: number,
  userName: string
): Promise<MonthlySettlementCheck> {
  try {
    await prisma.settlementCheck.upsert({
      where: {
        year_month_itemId: { year, month, itemId },
      },
      update: {
        isChecked: checked,
        checkedAt: checked ? new Date() : null,
        checkedById: checked ? userName : null,
      },
      create: {
        year,
        month,
        itemId,
        isChecked: checked,
        checkedAt: checked ? new Date() : null,
        checkedById: checked ? userName : null,
      },
    })
    
    // 업데이트된 월 데이터 반환
    const result = await getMonthlySettlementCheck(year, month)
    
    if (result) {
      // amount 설정
      if (result.checks[itemId]) {
        result.checks[itemId]!.amount = amount
      }
      return result
    }
    
    // 새로 생성된 경우
    const yearMonth = `${year}-${month.toString().padStart(2, '0')}`
    return {
      yearMonth,
      checks: {
        [itemId]: {
          checked,
          checkedAt: checked ? new Date().toISOString() : undefined,
          checkedBy: checked ? userName : undefined,
          amount,
        },
      },
      updatedAt: new Date().toISOString(),
    }
  } catch (error) {
    console.error('Toggle settlement check error:', error)
    throw error
  }
}

// 레거시 함수 (호환성)
export async function saveSettlementChecks(data: SettlementCheckData): Promise<void> {
  // DB 기반에서는 개별 upsert로 처리됨
  console.warn('saveSettlementChecks is deprecated, use toggleSettlementCheck instead')
}
