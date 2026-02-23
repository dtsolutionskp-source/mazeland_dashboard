/**
 * 일자별/월별 데이터 저장소
 * - DailyAgg: 일자별 상세 데이터
 * - MonthlyAgg: 월별 집계 (DailyAgg 기반으로 자동 계산)
 */

import { promises as fs } from 'fs'
import path from 'path'
import {
  DailyAggData,
  DailyChannelSale,
  DailyCategorySale,
  DailyAggSummary,
  MonthlyAggData,
  MonthlyChannelAgg,
  MonthlyCategoryAgg,
  DataSource,
  MonthlyFeeSettings,
} from '@/types/sales-data'
import { getMonthlyFeeSettings, getFeeRateForDate, createDefaultFeeSettings } from './fee-policy'
import { CHANNEL_MASTER, CATEGORY_MASTER, BASE_PRICE } from './master-data'
import prisma from '@/lib/prisma'

// Vercel 환경 감지 - 서버리스에서는 /tmp만 쓰기 가능
const isVercel = process.env.VERCEL === '1'
const BASE_DATA_PATH = isVercel ? '/tmp' : process.cwd()

// 데이터 저장 경로
const DATA_DIR = path.join(BASE_DATA_PATH, '.data')
const DAILY_DATA_DIR = path.join(DATA_DIR, 'daily')
const MONTHLY_DATA_DIR = path.join(DATA_DIR, 'monthly-v2')

/**
 * 디렉토리 확인/생성
 */
async function ensureDailyDir(year: number, month: number): Promise<string> {
  const monthDir = path.join(DAILY_DATA_DIR, `${year}-${String(month).padStart(2, '0')}`)
  try {
    await fs.access(monthDir)
  } catch {
    await fs.mkdir(monthDir, { recursive: true })
  }
  return monthDir
}

async function ensureMonthlyDir(): Promise<void> {
  try {
    await fs.access(MONTHLY_DATA_DIR)
  } catch {
    await fs.mkdir(MONTHLY_DATA_DIR, { recursive: true })
  }
}

// ==========================================
// 일자별 데이터 저장/조회
// ==========================================

/**
 * 일자별 데이터 파일 경로
 */
function getDailyDataPath(year: number, month: number, date: string): string {
  return path.join(DAILY_DATA_DIR, `${year}-${String(month).padStart(2, '0')}`, `${date}.json`)
}

/**
 * 일자별 데이터 저장
 */
export async function saveDailyData(
  year: number,
  month: number,
  data: DailyAggData
): Promise<void> {
  await ensureDailyDir(year, month)
  const filePath = getDailyDataPath(year, month, data.date)
  
  // 요약 계산
  const enrichedData = enrichDailyData(data)
  
  await fs.writeFile(filePath, JSON.stringify(enrichedData, null, 2), 'utf-8')
  
  // 월별 집계 재계산
  await recalculateMonthlyAgg(year, month)
}

/**
 * 일자별 데이터 조회
 */
export async function getDailyData(
  year: number,
  month: number,
  date: string
): Promise<DailyAggData | null> {
  try {
    const filePath = getDailyDataPath(year, month, date)
    const content = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(content)
  } catch {
    return null
  }
}

/**
 * 월 전체 일자별 데이터 조회
 */
export async function getAllDailyDataForMonth(
  year: number,
  month: number
): Promise<DailyAggData[]> {
  try {
    const monthDir = await ensureDailyDir(year, month)
    const files = await fs.readdir(monthDir)
    
    const dailyDataList: DailyAggData[] = []
    
    for (const file of files.filter(f => f.endsWith('.json'))) {
      const content = await fs.readFile(path.join(monthDir, file), 'utf-8')
      dailyDataList.push(JSON.parse(content))
    }
    
    // 날짜순 정렬
    return dailyDataList.sort((a, b) => a.date.localeCompare(b.date))
  } catch {
    return []
  }
}

/**
 * 여러 일자 데이터 일괄 저장
 */
export async function saveBulkDailyData(
  year: number,
  month: number,
  dataList: DailyAggData[]
): Promise<void> {
  await ensureDailyDir(year, month)
  
  for (const data of dataList) {
    const filePath = getDailyDataPath(year, month, data.date)
    const enrichedData = enrichDailyData(data)
    await fs.writeFile(filePath, JSON.stringify(enrichedData, null, 2), 'utf-8')
  }
  
  // 월별 집계 재계산
  await recalculateMonthlyAgg(year, month)
}

/**
 * 여러 일자 데이터 일괄 저장 (월별 재집계 없이)
 * - 원본 총계를 유지해야 할 때 사용 (엑셀 업로드 등)
 */
export async function saveDailyDataWithoutRecalc(
  year: number,
  month: number,
  dataList: DailyAggData[]
): Promise<void> {
  await ensureDailyDir(year, month)
  
  for (const data of dataList) {
    const filePath = getDailyDataPath(year, month, data.date)
    // enrichDailyData를 호출하지 않고 그대로 저장
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
  }
  
  console.log(`[Daily Store] Saved ${dataList.length} days without recalculation`)
}

// ==========================================
// 월별 집계 데이터
// ==========================================

/**
 * 월별 집계 파일 경로
 */
function getMonthlyDataPath(year: number, month: number): string {
  return path.join(MONTHLY_DATA_DIR, `${year}-${String(month).padStart(2, '0')}.json`)
}

/**
 * 월별 집계 조회
 */
export async function getMonthlyAggData(
  year: number,
  month: number
): Promise<MonthlyAggData | null> {
  try {
    await ensureMonthlyDir()
    const filePath = getMonthlyDataPath(year, month)
    const content = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(content)
  } catch {
    return null
  }
}

/**
 * 월별 집계 저장
 */
export async function saveMonthlyAggData(data: MonthlyAggData): Promise<void> {
  await ensureMonthlyDir()
  const filePath = getMonthlyDataPath(data.year, data.month)
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
}

/**
 * 일자별 데이터로부터 월별 집계 재계산
 */
export async function recalculateMonthlyAgg(
  year: number,
  month: number
): Promise<MonthlyAggData> {
  const dailyDataList = await getAllDailyDataForMonth(year, month)
  const feeSettings = await getMonthlyFeeSettings(year, month)
  
  // 채널별 집계
  const channelAggMap = new Map<string, MonthlyChannelAgg>()
  for (const ch of CHANNEL_MASTER) {
    channelAggMap.set(ch.code, {
      channelCode: ch.code,
      channelName: ch.name,
      avgFeeRate: 0,
      totalCount: 0,
      grossRevenue: 0,
      totalFee: 0,
      netRevenue: 0,
    })
  }
  
  // 카테고리별 집계
  const categoryAggMap = new Map<string, MonthlyCategoryAgg>()
  for (const cat of CATEGORY_MASTER) {
    categoryAggMap.set(cat.code, {
      categoryCode: cat.code,
      categoryName: cat.name,
      totalCount: 0,
      revenue: 0,
    })
  }
  
  // 일자별 데이터 집계
  let source: DataSource = 'manual'
  
  for (const daily of dailyDataList) {
    if (daily.source === 'file') source = 'file'
    else if (daily.source === 'mixed' && source !== 'file') source = 'mixed'
    
    // 채널 집계
    for (const sale of daily.channelSales) {
      const agg = channelAggMap.get(sale.channelCode)
      if (agg) {
        agg.totalCount += sale.count
        agg.grossRevenue += sale.grossRevenue || (BASE_PRICE * sale.count)
        agg.totalFee += sale.fee || 0
        agg.netRevenue += sale.netRevenue || (BASE_PRICE * sale.count)
      }
    }
    
    // 카테고리 집계
    for (const sale of daily.categorySales) {
      const agg = categoryAggMap.get(sale.categoryCode)
      if (agg) {
        agg.totalCount += sale.count
        agg.revenue += sale.revenue || (BASE_PRICE * sale.count)
      }
    }
  }
  
  // 평균 수수료율 계산
  const channelAggs = Array.from(channelAggMap.values()).map(agg => ({
    ...agg,
    avgFeeRate: agg.grossRevenue > 0
      ? Math.round((agg.totalFee / agg.grossRevenue) * 10000) / 100
      : 0,
  }))
  
  const categoryAggs = Array.from(categoryAggMap.values())
  
  // 요약 계산
  const summary = {
    totalDays: dailyDataList.length,
    onlineCount: channelAggs.reduce((sum, ch) => sum + ch.totalCount, 0),
    offlineCount: categoryAggs.reduce((sum, cat) => sum + cat.totalCount, 0),
    totalCount: 0,
    onlineGrossRevenue: channelAggs.reduce((sum, ch) => sum + ch.grossRevenue, 0),
    onlineFee: channelAggs.reduce((sum, ch) => sum + ch.totalFee, 0),
    onlineNetRevenue: channelAggs.reduce((sum, ch) => sum + ch.netRevenue, 0),
    offlineRevenue: categoryAggs.reduce((sum, cat) => sum + cat.revenue, 0),
    totalGrossRevenue: 0,
    totalNetRevenue: 0,
  }
  summary.totalCount = summary.onlineCount + summary.offlineCount
  summary.totalGrossRevenue = summary.onlineGrossRevenue + summary.offlineRevenue
  summary.totalNetRevenue = summary.onlineNetRevenue + summary.offlineRevenue
  
  const monthlyData: MonthlyAggData = {
    year,
    month,
    source,
    uploadedAt: new Date().toISOString(),
    feeSettings,
    dailyData: dailyDataList,
    channelAggs,
    categoryAggs,
    summary,
  }
  
  await saveMonthlyAggData(monthlyData)
  
  return monthlyData
}

// ==========================================
// 데이터 보강 (계산 필드 추가)
// ==========================================

/**
 * 일자별 데이터에 계산 필드 추가
 */
function enrichDailyData(data: DailyAggData): DailyAggData {
  // 채널 판매 계산
  const channelSales = data.channelSales.map(sale => {
    const grossRevenue = BASE_PRICE * sale.count
    const fee = Math.round(grossRevenue * sale.feeRate / 100)
    const netRevenue = grossRevenue - fee
    
    return {
      ...sale,
      grossRevenue,
      fee,
      netRevenue,
    }
  })
  
  // 카테고리 판매 계산
  const categorySales = data.categorySales.map(sale => ({
    ...sale,
    revenue: BASE_PRICE * sale.count,
  }))
  
  // 요약 계산
  const onlineCount = channelSales.reduce((sum, s) => sum + s.count, 0)
  const offlineCount = categorySales.reduce((sum, s) => sum + s.count, 0)
  const onlineNetRevenue = channelSales.reduce((sum, s) => sum + (s.netRevenue || 0), 0)
  const offlineRevenue = categorySales.reduce((sum, s) => sum + (s.revenue || 0), 0)
  
  const summary: DailyAggSummary = {
    date: data.date,
    onlineCount,
    offlineCount,
    totalCount: onlineCount + offlineCount,
    onlineNetRevenue,
    offlineRevenue,
    totalNetRevenue: onlineNetRevenue + offlineRevenue,
  }
  
  return {
    ...data,
    channelSales,
    categorySales,
    summary,
  }
}

// ==========================================
// 초기 데이터 생성 (월 합계 → 일자별 분배)
// ==========================================

/**
 * 월 합계를 일자별로 균등 분배
 */
export function distributeMonthlyToDaily(
  year: number,
  month: number,
  channelTotals: { channelCode: string; count: number }[],
  categoryTotals: { categoryCode: string; count: number }[],
  feeSettings: MonthlyFeeSettings
): DailyAggData[] {
  const daysInMonth = new Date(year, month, 0).getDate()
  const dailyDataList: DailyAggData[] = []
  
  for (let day = 1; day <= daysInMonth; day++) {
    const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    
    // 채널별 일자 데이터 (균등 분배)
    const channelSales: DailyChannelSale[] = channelTotals.map(ch => {
      const dailyCount = Math.floor(ch.count / daysInMonth)
      // 마지막 날에 나머지 추가
      const remainder = day === daysInMonth ? ch.count % daysInMonth : 0
      const count = dailyCount + remainder
      
      const master = CHANNEL_MASTER.find(m => m.code === ch.channelCode)
      const feeRate = getFeeRateForDate(feeSettings, ch.channelCode, date)
      
      return {
        date,
        channelCode: ch.channelCode,
        channelName: master?.name || ch.channelCode,
        count,
        feeRate,
      }
    })
    
    // 카테고리별 일자 데이터 (균등 분배)
    const categorySales: DailyCategorySale[] = categoryTotals.map(cat => {
      const dailyCount = Math.floor(cat.count / daysInMonth)
      const remainder = day === daysInMonth ? cat.count % daysInMonth : 0
      const count = dailyCount + remainder
      
      const master = CATEGORY_MASTER.find(m => m.code === cat.categoryCode)
      
      return {
        date,
        categoryCode: cat.categoryCode,
        categoryName: master?.name || cat.categoryCode,
        count,
      }
    })
    
    dailyDataList.push({
      date,
      channelSales,
      categorySales,
      summary: {
        date,
        onlineCount: 0,
        offlineCount: 0,
        totalCount: 0,
        onlineNetRevenue: 0,
        offlineRevenue: 0,
        totalNetRevenue: 0,
      },
      source: 'manual',
    })
  }
  
  return dailyDataList
}

/**
 * 사용 가능한 월 목록 조회 (DB 우선 - Vercel 서버리스 환경)
 */
export async function getAvailableMonthsV2(): Promise<{ year: number; month: number }[]> {
  const months: { year: number; month: number }[] = []
  const monthSet = new Set<string>()
  
  try {
    // 1. DB에서 먼저 조회 (Vercel 환경에서 신뢰할 수 있는 소스)
    try {
      const summaries = await prisma.monthlySummary.findMany({
        select: { year: true, month: true, grandTotal: true, onlineTotal: true, offlineTotal: true },
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
      })
      
      console.log('[DailyDataStore] DB summaries found:', summaries.length)
      
      for (const s of summaries) {
        // grandTotal, onlineTotal, offlineTotal 중 하나라도 양수면 데이터 있음으로 판단
        const hasData = (s.grandTotal && s.grandTotal > 0) || 
                       (s.onlineTotal && s.onlineTotal > 0) || 
                       (s.offlineTotal && s.offlineTotal > 0)
        if (hasData) {
          const key = `${s.year}-${s.month}`
          if (!monthSet.has(key)) {
            monthSet.add(key)
            months.push({ year: s.year, month: s.month })
          }
        }
      }
    } catch (dbError) {
      console.log('[DailyDataStore] DB query failed:', dbError)
    }
    
    // 2. 로컬 개발 환경에서만 파일 시스템도 확인
    if (!isVercel) {
      // uploads 폴더에서 월 목록 조회
      const uploadsDir = path.join(DATA_DIR, 'uploads')
      try {
        const uploadFiles = await fs.readdir(uploadsDir)
        
        for (const f of uploadFiles) {
          if (f.endsWith('.json')) {
            const match = f.match(/(\d{4})-(\d{2})\.json/)
            if (match) {
              const year = parseInt(match[1])
              const month = parseInt(match[2])
              const key = `${year}-${month}`
              
              if (!monthSet.has(key)) {
                try {
                  const filePath = path.join(uploadsDir, f)
                  const content = await fs.readFile(filePath, 'utf-8')
                  const data = JSON.parse(content)
                  if (data.summary?.totalCount > 0) {
                    months.push({ year, month })
                    monthSet.add(key)
                  }
                } catch {
                  // 파일 읽기 실패 시 무시
                }
              }
            }
          }
        }
      } catch {
        // uploads 폴더가 없으면 무시
      }
    }
    
    // 정렬 (최신순)
    return months.sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year
      return b.month - a.month
    })
  } catch {
    return []
  }
}

/**
 * 월별 일자 데이터 삭제
 */
export async function deleteDailyDataForMonth(year: number, month: number): Promise<void> {
  const monthStr = String(month).padStart(2, '0')
  
  // 1. daily 폴더의 해당 월 폴더 삭제
  try {
    const monthDir = path.join(DAILY_DATA_DIR, `${year}-${monthStr}`)
    const files = await fs.readdir(monthDir)
    
    for (const file of files) {
      await fs.unlink(path.join(monthDir, file))
    }
    await fs.rmdir(monthDir)
    console.log(`[DailyDataStore] Deleted daily folder for ${year}-${monthStr}`)
  } catch (error) {
    console.log('[DailyDataStore] Error deleting daily folder:', error)
  }
  
  // 2. monthly-v2 폴더의 해당 월 데이터 삭제
  try {
    const monthlyFile = path.join(MONTHLY_DATA_DIR, `${year}-${monthStr}.json`)
    await fs.unlink(monthlyFile)
    console.log(`[DailyDataStore] Deleted monthly file for ${year}-${monthStr}`)
  } catch (error) {
    console.log('[DailyDataStore] Error deleting monthly file:', error)
  }
  
  // 3. uploads 폴더의 해당 월 데이터 삭제
  try {
    const uploadsDir = path.join(DATA_DIR, 'uploads')
    const uploadFile = path.join(uploadsDir, `${year}-${monthStr}.json`)
    await fs.unlink(uploadFile)
    console.log(`[DailyDataStore] Deleted upload file for ${year}-${monthStr}`)
  } catch (error) {
    console.log('[DailyDataStore] Error deleting upload file:', error)
  }
}
