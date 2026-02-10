/**
 * 데이터 저장소 - Supabase/Prisma DB 우선, 파일 시스템 fallback
 */

import { promises as fs } from 'fs'
import path from 'path'
import { MonthlyAggData, DataSource, ChannelSalesData, CategorySalesData } from '@/types/sales-input'
import { getMasterData, getChannelFeeRate, BASE_PRICE } from './master-data'
import prisma from '@/lib/prisma'

// Vercel 환경 감지 - 서버리스에서는 /tmp만 쓰기 가능
const isVercel = process.env.VERCEL === '1'
const BASE_DATA_PATH = isVercel ? '/tmp' : process.cwd()

// 데이터 저장 경로
const DATA_DIR = path.join(BASE_DATA_PATH, '.data')
const UPLOAD_DATA_FILE = path.join(DATA_DIR, 'upload-data.json')  // 레거시 (단일 파일)
const UPLOAD_DATA_DIR = path.join(DATA_DIR, 'uploads')  // 월별 분리 저장
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
    channelData?: Record<string, { count: number; feeRate: number }>
    categoryData?: Record<string, { count: number }>
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
 * 월별 업로드 데이터 디렉토리 생성
 */
async function ensureUploadDataDir(): Promise<void> {
  try {
    await fs.access(UPLOAD_DATA_DIR)
  } catch {
    await fs.mkdir(UPLOAD_DATA_DIR, { recursive: true })
  }
}

/**
 * 월별 업로드 데이터 파일 경로
 */
function getUploadDataPath(year: number, month: number): string {
  return path.join(UPLOAD_DATA_DIR, `${year}-${String(month).padStart(2, '0')}.json`)
}

/**
 * 월별 데이터 파일 경로
 */
function getMonthlyDataPath(year: number, month: number): string {
  return path.join(MONTHLY_DATA_DIR, `${year}-${String(month).padStart(2, '0')}.json`)
}

// ==========================================
// 월별 업로드 데이터 함수 (신규 - 월별 분리)
// ==========================================

/**
 * 월별 업로드 데이터 저장
 */
export async function saveUploadDataByMonth(year: number, month: number, data: StoredUploadData): Promise<void> {
  await ensureUploadDataDir()
  const filePath = getUploadDataPath(year, month)
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
  console.log(`[DataStore] Saved upload data for ${year}-${month}`)
}

/**
 * 월별 업로드 데이터 조회 (DB 우선)
 */
export async function getUploadDataByMonth(year: number, month: number): Promise<StoredUploadData | null> {
  try {
    // DB에서 조회 시도
    const summary = await prisma.monthlySummary.findFirst({
      where: { year, month },
      include: {
        uploadHistory: true,
      },
    })
    
    if (summary) {
      // DB 데이터를 StoredUploadData 형식으로 변환
      const onlineByChannel = summary.onlineByChannel as Record<string, number> || {}
      const offlineByCategory = summary.offlineByCategory as Record<string, number> || {}
      const onlineByAge = summary.onlineByAge as Record<string, number> || {}
      
      // 채널 데이터 변환
      const channels: Record<string, { name: string; count: number; feeRate: number }> = {}
      for (const [code, count] of Object.entries(onlineByChannel)) {
        channels[code] = {
          name: code,
          count: count as number,
          feeRate: getChannelFeeRate(code),
        }
      }
      
      // 카테고리 데이터 변환
      const categories: Record<string, { name: string; count: number }> = {}
      for (const [code, count] of Object.entries(offlineByCategory)) {
        categories[code] = {
          name: code,
          count: count as number,
        }
      }
      
      return {
        uploadedAt: summary.createdAt.toISOString(),
        fileName: summary.uploadHistory?.fileName || `${year}-${month} 데이터`,
        periodStart: summary.uploadHistory?.periodStart.toISOString() || `${year}-${String(month).padStart(2, '0')}-01`,
        periodEnd: summary.uploadHistory?.periodEnd.toISOString() || `${year}-${String(month).padStart(2, '0')}-31`,
        source: 'file',
        summary: {
          onlineCount: summary.onlineTotal,
          offlineCount: summary.offlineTotal,
          totalCount: summary.grandTotal,
        },
        dailyData: [], // 일별 데이터는 별도 쿼리 필요
        channels,
        categories,
        monthly: {
          onlineByChannel,
          onlineByAge,
          offlineByCategory,
          revenue: {
            online: Number(summary.onlineRevenue),
            onlineFee: Number(summary.onlineFee),
            onlineNet: Number(summary.onlineNet),
            offline: Number(summary.offlineRevenue),
            total: Number(summary.totalRevenue),
            totalNet: Number(summary.totalNet),
          },
        },
        settlement: {
          companies: [], // 정산 데이터는 별도 계산 필요
        },
      }
    }
  } catch (error) {
    console.log('[DataStore] DB query failed, falling back to file system:', error)
  }
  
  // 파일 시스템 fallback
  try {
    await ensureUploadDataDir()
    const filePath = getUploadDataPath(year, month)
    const content = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(content)
  } catch {
    return null
  }
}

/**
 * 사용 가능한 업로드 데이터 월 목록 조회 (DB 우선)
 */
export async function getAvailableUploadMonths(): Promise<{ year: number; month: number }[]> {
  try {
    // DB에서 조회 시도
    const summaries = await prisma.monthlySummary.findMany({
      select: { year: true, month: true },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    })
    
    if (summaries.length > 0) {
      return summaries.map(s => ({ year: s.year, month: s.month }))
    }
  } catch (error) {
    console.log('[DataStore] DB query failed, falling back to file system:', error)
  }
  
  // 파일 시스템 fallback
  try {
    await ensureUploadDataDir()
    const files = await fs.readdir(UPLOAD_DATA_DIR)
    
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

// ==========================================
// 기존 업로드 데이터 함수 (하위 호환성 - 레거시)
// ==========================================

/**
 * 업로드 데이터 저장 (레거시 - 단일 파일)
 * @deprecated saveUploadDataByMonth 사용 권장
 */
export async function saveUploadData(data: StoredUploadData): Promise<void> {
  await ensureDataDir()
  await fs.writeFile(UPLOAD_DATA_FILE, JSON.stringify(data, null, 2), 'utf-8')
}

/**
 * 저장된 업로드 데이터 불러오기 (레거시 - 단일 파일)
 * @deprecated getUploadDataByMonth 사용 권장
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
 * 사용 가능한 월 목록 조회 (DB 우선)
 */
export async function getAvailableMonths(): Promise<{ year: number; month: number }[]> {
  // DB 조회는 getAvailableUploadMonths와 동일
  return getAvailableUploadMonths()
}

/**
 * 월별 데이터 삭제 (모든 관련 파일 삭제)
 */
export async function deleteMonthlyData(year: number, month: number): Promise<void> {
  // 1. monthly-data 폴더에서 삭제
  try {
    const monthlyFilePath = getMonthlyDataPath(year, month)
    await fs.unlink(monthlyFilePath)
    console.log(`[DataStore] Deleted monthly-data file: ${year}-${month}`)
  } catch {
    // 파일이 없어도 에러 무시
  }
  
  // 2. uploads 폴더에서도 삭제
  try {
    const uploadFilePath = getUploadDataPath(year, month)
    await fs.unlink(uploadFilePath)
    console.log(`[DataStore] Deleted uploads file: ${year}-${month}`)
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
