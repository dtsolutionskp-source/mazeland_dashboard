/**
 * 파일 기반 데이터 저장소
 * DB 없이도 업로드된 데이터를 저장하고 대시보드에서 사용할 수 있도록 함
 */

import { promises as fs } from 'fs'
import path from 'path'
import { MonthlyAggData, DataSource, ChannelSalesData, CategorySalesData } from '@/types/sales-input'
import { getMasterData, getChannelFeeRate, BASE_PRICE } from './master-data'

// 데이터 저장 경로
const DATA_DIR = path.join(process.cwd(), '.data')
const UPLOAD_DATA_FILE = path.join(DATA_DIR, 'upload-data.json')
const MONTHLY_DATA_DIR = path.join(DATA_DIR, 'monthly')

// 기존 StoredUploadData 타입 (하위 호환성 유지)
export interface StoredUploadData {
  uploadedAt: string
  fileName: string
  periodStart: string
  periodEnd: string
  source?: DataSource
  summary: {
    onlineCount: number
    offlineCount: number
    totalCount: number
  }
  dailyData: {
    date: string
    online: number
    offline: number
    total: number
  }[]
  channels: Record<string, { name: string; count: number; feeRate: number }>
  categories: Record<string, { name: string; count: number }>
  monthly: {
    onlineByChannel: Record<string, number>
    onlineByAge: Record<string, number>
    offlineByCategory: Record<string, number>
    revenue: {
      online: number
      onlineFee: number
      onlineNet: number
      offline: number
      total: number
      totalNet: number
    }
  }
  settlement: {
    companies: {
      name: string
      code: string
      revenue: number
      income: number
      cost: number
      profit: number
      profitRate: number
    }[]
  }
}

/**
 * 데이터 디렉토리 생성
 */
async function ensureDataDir(): Promise<void> {
  try {
    await fs.access(DATA_DIR)
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true })
  }
}

/**
 * 월별 데이터 디렉토리 생성
 */
async function ensureMonthlyDataDir(): Promise<void> {
  try {
    await fs.access(MONTHLY_DATA_DIR)
  } catch {
    await fs.mkdir(MONTHLY_DATA_DIR, { recursive: true })
  }
}

/**
 * 월별 데이터 파일 경로
 */
function getMonthlyDataPath(year: number, month: number): string {
  return path.join(MONTHLY_DATA_DIR, `${year}-${String(month).padStart(2, '0')}.json`)
}

// ==========================================
// 기존 업로드 데이터 함수 (하위 호환성)
// ==========================================

/**
 * 업로드 데이터 저장 (기존)
 */
export async function saveUploadData(data: StoredUploadData): Promise<void> {
  await ensureDataDir()
  await fs.writeFile(UPLOAD_DATA_FILE, JSON.stringify(data, null, 2), 'utf-8')
}

/**
 * 저장된 업로드 데이터 불러오기 (기존)
 */
export async function getUploadData(): Promise<StoredUploadData | null> {
  try {
    await ensureDataDir()
    const content = await fs.readFile(UPLOAD_DATA_FILE, 'utf-8')
    return JSON.parse(content)
  } catch {
    return null
  }
}

/**
 * 저장된 데이터 존재 여부 확인
 */
export async function hasUploadData(): Promise<boolean> {
  try {
    await fs.access(UPLOAD_DATA_FILE)
    return true
  } catch {
    return false
  }
}

/**
 * 저장된 데이터 삭제
 */
export async function clearUploadData(): Promise<void> {
  try {
    await fs.unlink(UPLOAD_DATA_FILE)
  } catch {
    // 파일이 없어도 에러 무시
  }
}

// ==========================================
// 월별 집계 데이터 함수 (신규)
// ==========================================

/**
 * 월별 집계 데이터 저장
 */
export async function saveMonthlyData(data: MonthlyAggData): Promise<void> {
  await ensureMonthlyDataDir()
  const filePath = getMonthlyDataPath(data.year, data.month)
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
  
  // 기존 upload-data.json도 동시 업데이트 (하위 호환성)
  await syncToUploadData(data)
}

/**
 * 월별 집계 데이터 조회
 */
export async function getMonthlyData(year: number, month: number): Promise<MonthlyAggData | null> {
  try {
    await ensureMonthlyDataDir()
    const filePath = getMonthlyDataPath(year, month)
    const content = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(content)
  } catch {
    return null
  }
}

/**
 * 사용 가능한 월 목록 조회
 */
export async function getAvailableMonths(): Promise<{ year: number; month: number }[]> {
  try {
    await ensureMonthlyDataDir()
    const files = await fs.readdir(MONTHLY_DATA_DIR)
    
    return files
      .filter(f => f.endsWith('.json'))
      .map(f => {
        const match = f.match(/(\d{4})-(\d{2})\.json/)
        if (match) {
          return { year: parseInt(match[1]), month: parseInt(match[2]) }
        }
        return null
      })
      .filter((m): m is { year: number; month: number } => m !== null)
      .sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year
        return b.month - a.month
      })
  } catch {
    return []
  }
}

/**
 * 월별 데이터 삭제
 */
export async function deleteMonthlyData(year: number, month: number): Promise<void> {
  try {
    const filePath = getMonthlyDataPath(year, month)
    await fs.unlink(filePath)
  } catch {
    // 파일이 없어도 에러 무시
  }
}

// ==========================================
// 데이터 변환 및 동기화
// ==========================================

/**
 * MonthlyAggData를 StoredUploadData로 변환 (하위 호환성)
 */
async function syncToUploadData(monthlyData: MonthlyAggData): Promise<void> {
  const { channels, categories, summary, dailyData, source, year, month, uploadedAt } = monthlyData
  
  // channels 배열을 객체로 변환
  const channelsObj: Record<string, { name: string; count: number; feeRate: number }> = {}
  for (const ch of channels) {
    channelsObj[ch.channelCode] = {
      name: ch.channelName,
      count: ch.count,
      feeRate: ch.feeRate,
    }
  }
  
  // categories 배열을 객체로 변환
  const categoriesObj: Record<string, { name: string; count: number }> = {}
  for (const cat of categories) {
    categoriesObj[cat.categoryCode] = {
      name: cat.categoryName,
      count: cat.count,
    }
  }
  
  // onlineByChannel 생성
  const onlineByChannel: Record<string, number> = {}
  for (const ch of channels) {
    onlineByChannel[ch.channelCode] = ch.count
  }
  
  // offlineByCategory 생성
  const offlineByCategory: Record<string, number> = {}
  for (const cat of categories) {
    offlineByCategory[cat.categoryCode] = cat.count
  }
  
  // 기간 계산
  const periodStart = dailyData && dailyData.length > 0 
    ? dailyData[0].date 
    : `${year}-${String(month).padStart(2, '0')}-01`
  const periodEnd = dailyData && dailyData.length > 0 
    ? dailyData[dailyData.length - 1].date 
    : `${year}-${String(month).padStart(2, '0')}-30`
  
  const storedData: StoredUploadData = {
    uploadedAt,
    fileName: source === 'manual' ? `${year}년_${month}월_수기입력` : `${year}년_${month}월_데이터`,
    periodStart,
    periodEnd,
    source,
    summary: {
      onlineCount: summary.onlineCount,
      offlineCount: summary.offlineCount,
      totalCount: summary.totalCount,
    },
    dailyData: dailyData || [],
    channels: channelsObj,
    categories: categoriesObj,
    monthly: {
      onlineByChannel,
      onlineByAge: {},
      offlineByCategory,
      revenue: {
        online: summary.onlineRevenue,
        onlineFee: summary.onlineFee,
        onlineNet: summary.onlineNetRevenue,
        offline: summary.offlineRevenue,
        total: summary.totalRevenue,
        totalNet: summary.totalNetRevenue,
      },
    },
    settlement: {
      companies: [], // 정산은 별도 계산
    },
  }
  
  await saveUploadData(storedData)
}

/**
 * 채널/카테고리 데이터로 요약 계산
 */
export function calculateSummary(
  channels: ChannelSalesData[],
  categories: CategorySalesData[]
): MonthlyAggData['summary'] {
  let onlineCount = 0
  let onlineRevenue = 0
  let onlineFee = 0
  let onlineNetRevenue = 0
  
  for (const ch of channels) {
    const count = ch.count || 0
    const feeRate = ch.feeRate || getChannelFeeRate(ch.channelCode)
    const gross = BASE_PRICE * count
    const fee = Math.round(gross * feeRate / 100)
    const net = gross - fee
    
    onlineCount += count
    onlineRevenue += gross
    onlineFee += fee
    onlineNetRevenue += net
  }
  
  let offlineCount = 0
  let offlineRevenue = 0
  
  for (const cat of categories) {
    const count = cat.count || 0
    offlineCount += count
    offlineRevenue += BASE_PRICE * count
  }
  
  return {
    onlineCount,
    offlineCount,
    totalCount: onlineCount + offlineCount,
    onlineRevenue,
    onlineFee,
    onlineNetRevenue,
    offlineRevenue,
    totalRevenue: onlineRevenue + offlineRevenue,
    totalNetRevenue: onlineNetRevenue + offlineRevenue,
  }
}

/**
 * 채널 데이터에 계산 필드 추가
 */
export function enrichChannelData(channels: ChannelSalesData[]): ChannelSalesData[] {
  return channels.map(ch => {
    const feeRate = ch.feeRate || getChannelFeeRate(ch.channelCode)
    const grossRevenue = BASE_PRICE * ch.count
    const fee = Math.round(grossRevenue * feeRate / 100)
    const netRevenue = grossRevenue - fee
    
    return {
      ...ch,
      feeRate,
      grossRevenue,
      fee,
      netRevenue,
    }
  })
}

/**
 * 카테고리 데이터에 계산 필드 추가
 */
export function enrichCategoryData(categories: CategorySalesData[]): CategorySalesData[] {
  return categories.map(cat => ({
    ...cat,
    revenue: BASE_PRICE * cat.count,
  }))
}
