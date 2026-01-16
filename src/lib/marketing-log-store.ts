import fs from 'fs'
import path from 'path'

const DATA_DIR = path.join(process.cwd(), '.data')
const MARKETING_LOG_FILE = path.join(DATA_DIR, 'marketing-logs.json')

export interface MarketingLog {
  id: string
  logType: 'CAMPAIGN' | 'PERFORMANCE'
  startDate: string
  endDate: string
  title?: string
  content?: string
  subType?: string
  impressions: number
  clicks: number
  createdById: string
  createdBy?: {
    name: string
    email: string
  }
  createdAt: string
  updatedAt: string
}

// 디렉토리 확인 및 생성
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }
}

// 마케팅 로그 목록 조회
export async function getMarketingLogs(): Promise<MarketingLog[]> {
  ensureDataDir()
  
  try {
    if (fs.existsSync(MARKETING_LOG_FILE)) {
      const data = fs.readFileSync(MARKETING_LOG_FILE, 'utf-8')
      return JSON.parse(data) || []
    }
  } catch (error) {
    console.error('Read marketing logs error:', error)
  }
  
  return []
}

// 마케팅 로그 저장
export async function saveMarketingLogs(logs: MarketingLog[]): Promise<void> {
  ensureDataDir()
  fs.writeFileSync(MARKETING_LOG_FILE, JSON.stringify(logs, null, 2))
}

// 마케팅 로그 생성
export async function createMarketingLog(
  data: Omit<MarketingLog, 'id' | 'createdAt' | 'updatedAt'>,
  user: { id: string; name: string; email: string }
): Promise<MarketingLog> {
  const logs = await getMarketingLogs()
  
  const newLog: MarketingLog = {
    ...data,
    id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    createdById: user.id,
    createdBy: { name: user.name, email: user.email },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  
  logs.unshift(newLog) // 최신 것을 앞에 추가
  await saveMarketingLogs(logs)
  
  return newLog
}

// 마케팅 로그 수정
export async function updateMarketingLog(
  id: string,
  data: Partial<Omit<MarketingLog, 'id' | 'createdAt' | 'createdById' | 'createdBy'>>
): Promise<MarketingLog | null> {
  const logs = await getMarketingLogs()
  const index = logs.findIndex(log => log.id === id)
  
  if (index === -1) return null
  
  logs[index] = {
    ...logs[index],
    ...data,
    updatedAt: new Date().toISOString(),
  }
  
  await saveMarketingLogs(logs)
  return logs[index]
}

// 마케팅 로그 삭제
export async function deleteMarketingLog(id: string): Promise<boolean> {
  const logs = await getMarketingLogs()
  const index = logs.findIndex(log => log.id === id)
  
  if (index === -1) return false
  
  logs.splice(index, 1)
  await saveMarketingLogs(logs)
  
  return true
}

// 마케팅 로그 단일 조회
export async function getMarketingLogById(id: string): Promise<MarketingLog | null> {
  const logs = await getMarketingLogs()
  return logs.find(log => log.id === id) || null
}

// 기간별 마케팅 로그 조회
export async function getMarketingLogsByDateRange(
  startDate: Date,
  endDate: Date,
  logType?: 'CAMPAIGN' | 'PERFORMANCE'
): Promise<MarketingLog[]> {
  const logs = await getMarketingLogs()
  
  return logs.filter(log => {
    const logStart = new Date(log.startDate)
    const logEnd = new Date(log.endDate)
    
    // 기간이 겹치는지 확인
    const overlaps = logStart <= endDate && logEnd >= startDate
    
    if (logType && logType !== log.logType) return false
    
    return overlaps
  })
}

