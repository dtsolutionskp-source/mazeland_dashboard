/**
 * 수수료 정책 관리 모듈
 * - 채널 × 월 기준 기본 수수료율
 * - 기간별 예외 (Override)
 * - 특정 일자의 실제 적용 수수료율 조회
 */

import { promises as fs } from 'fs'
import path from 'path'
import {
  ChannelMonthlyFee,
  ChannelFeeOverride,
  MonthlyFeeSettings,
} from '@/types/sales-data'
import { CHANNEL_MASTER } from './master-data'

// Vercel 환경 감지 - 서버리스에서는 /tmp만 쓰기 가능
const isVercel = process.env.VERCEL === '1'
const BASE_DATA_PATH = isVercel ? '/tmp' : process.cwd()

// 데이터 저장 경로
const DATA_DIR = path.join(BASE_DATA_PATH, '.data')
const FEE_POLICY_DIR = path.join(DATA_DIR, 'fee-policy')

/**
 * 디렉토리 확인/생성
 */
async function ensureFeePolicyDir(): Promise<void> {
  try {
    await fs.access(FEE_POLICY_DIR)
  } catch {
    await fs.mkdir(FEE_POLICY_DIR, { recursive: true })
  }
}

/**
 * 수수료 설정 파일 경로
 */
function getFeeSettingsPath(year: number, month: number): string {
  return path.join(FEE_POLICY_DIR, `${year}-${String(month).padStart(2, '0')}.json`)
}

// ==========================================
// 수수료 설정 조회/저장
// ==========================================

/**
 * 월간 수수료 설정 조회
 */
export async function getMonthlyFeeSettings(
  year: number,
  month: number
): Promise<MonthlyFeeSettings> {
  try {
    await ensureFeePolicyDir()
    const filePath = getFeeSettingsPath(year, month)
    const content = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(content)
  } catch {
    // 파일이 없으면 기본값 생성
    return createDefaultFeeSettings(year, month)
  }
}

/**
 * 월간 수수료 설정 저장
 */
export async function saveMonthlyFeeSettings(
  settings: MonthlyFeeSettings
): Promise<void> {
  await ensureFeePolicyDir()
  const filePath = getFeeSettingsPath(settings.year, settings.month)
  await fs.writeFile(filePath, JSON.stringify(settings, null, 2), 'utf-8')
}

/**
 * 기본 수수료 설정 생성
 */
export function createDefaultFeeSettings(
  year: number,
  month: number
): MonthlyFeeSettings {
  const channels: ChannelMonthlyFee[] = CHANNEL_MASTER
    .filter(ch => ch.active)
    .map(ch => ({
      channelCode: ch.code,
      channelName: ch.name,
      year,
      month,
      feeRate: ch.defaultFeeRate,
      source: 'default' as const,
    }))

  return {
    year,
    month,
    channels,
    overrides: [],
    updatedAt: new Date().toISOString(),
  }
}

// ==========================================
// 수수료율 조회 (특정 일자)
// ==========================================

/**
 * 특정 일자에 적용되는 채널별 수수료율 조회
 * - 기간별 override가 있으면 해당 값 사용
 * - 없으면 월간 기본값 사용
 */
export function getFeeRateForDate(
  settings: MonthlyFeeSettings,
  channelCode: string,
  date: string
): number {
  // 1. Override 확인
  const override = settings.overrides.find(
    o => o.channelCode === channelCode &&
        date >= o.startDate &&
        date <= o.endDate
  )
  if (override) {
    return override.feeRate
  }

  // 2. 월간 기본값
  const channelFee = settings.channels.find(c => c.channelCode === channelCode)
  if (channelFee) {
    return channelFee.feeRate
  }

  // 3. 마스터 데이터 기본값
  const masterChannel = CHANNEL_MASTER.find(c => c.code === channelCode)
  return masterChannel?.defaultFeeRate ?? 15
}

/**
 * 특정 일자의 모든 채널 수수료율 조회
 */
export function getAllFeeRatesForDate(
  settings: MonthlyFeeSettings,
  date: string
): Record<string, number> {
  const rates: Record<string, number> = {}
  
  for (const channel of CHANNEL_MASTER) {
    rates[channel.code] = getFeeRateForDate(settings, channel.code, date)
  }
  
  return rates
}

// ==========================================
// Override 관리
// ==========================================

/**
 * 수수료 Override 추가
 */
export function addFeeOverride(
  settings: MonthlyFeeSettings,
  override: Omit<ChannelFeeOverride, 'id'>
): MonthlyFeeSettings {
  const newOverride: ChannelFeeOverride = {
    ...override,
    id: `${override.channelCode}-${override.startDate}-${Date.now()}`,
  }

  return {
    ...settings,
    overrides: [...settings.overrides, newOverride],
    updatedAt: new Date().toISOString(),
  }
}

/**
 * 수수료 Override 삭제
 */
export function removeFeeOverride(
  settings: MonthlyFeeSettings,
  overrideId: string
): MonthlyFeeSettings {
  return {
    ...settings,
    overrides: settings.overrides.filter(o => o.id !== overrideId),
    updatedAt: new Date().toISOString(),
  }
}

/**
 * 채널 수수료 업데이트
 */
export function updateChannelFee(
  settings: MonthlyFeeSettings,
  channelCode: string,
  feeRate: number,
  source: 'default' | 'excel' | 'manual' = 'manual'
): MonthlyFeeSettings {
  const channels = settings.channels.map(ch => {
    if (ch.channelCode === channelCode) {
      return { ...ch, feeRate, source }
    }
    return ch
  })

  return {
    ...settings,
    channels,
    updatedAt: new Date().toISOString(),
  }
}

// ==========================================
// 엑셀 파싱 관련
// ==========================================

/**
 * 상품명에서 수수료율 파싱
 * 예: "네이버 메이즈랜드25년(10%)" → 10
 */
export function parseFeeRateFromProductName(productName: string): number | null {
  const match = productName.match(/\((\d+(?:\.\d+)?)\s*%?\)/)
  if (match) {
    return parseFloat(match[1])
  }
  return null
}

/**
 * 엑셀 데이터에서 채널별 수수료율 추출
 */
export function extractFeeRatesFromExcel(
  channelData: { channelCode: string; channelName: string; feeRate?: number }[]
): ChannelMonthlyFee[] {
  return channelData.map(ch => ({
    channelCode: ch.channelCode,
    channelName: ch.channelName,
    year: 0,  // 호출 시 설정
    month: 0, // 호출 시 설정
    feeRate: ch.feeRate ?? getDefaultFeeRate(ch.channelCode),
    source: ch.feeRate ? 'excel' : 'default',
  }))
}

/**
 * 채널 코드에서 기본 수수료율 조회
 */
export function getDefaultFeeRate(channelCode: string): number {
  const channel = CHANNEL_MASTER.find(c => c.code === channelCode)
  return channel?.defaultFeeRate ?? 15
}

// ==========================================
// 평균 수수료율 계산
// ==========================================

/**
 * 월간 평균 수수료율 계산 (Override 고려)
 */
export function calculateAverageFeeRate(
  settings: MonthlyFeeSettings,
  channelCode: string
): number {
  const { year, month, overrides } = settings
  
  // 해당 월의 일수
  const daysInMonth = new Date(year, month, 0).getDate()
  
  // 해당 채널의 Override들
  const channelOverrides = overrides.filter(o => o.channelCode === channelCode)
  
  if (channelOverrides.length === 0) {
    // Override 없으면 기본 수수료율 반환
    const channelFee = settings.channels.find(c => c.channelCode === channelCode)
    return channelFee?.feeRate ?? getDefaultFeeRate(channelCode)
  }
  
  // 일자별로 수수료율 계산 후 평균
  let totalRate = 0
  for (let day = 1; day <= daysInMonth; day++) {
    const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    totalRate += getFeeRateForDate(settings, channelCode, date)
  }
  
  return Math.round((totalRate / daysInMonth) * 100) / 100
}

