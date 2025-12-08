import * as XLSX from 'xlsx'

// ==========================================
// 타입 정의
// ==========================================

export interface OnlineSaleRecord {
  saleDate: Date
  vendor: string
  channel: string
  channelCode: string
  feeRate: number
  ageGroup: string
  unitPrice: number
  quantity: number
  totalAmount: number
  feeAmount: number
  netAmount: number
}

export interface OfflineSaleRecord {
  saleDate: Date
  category: string
  categoryCode: string
  quantity: number
  unitPrice: number
  totalAmount: number
}

export interface MonthlySummaryData {
  year: number
  month: number
  onlineTotal: number
  onlineByChannel: Record<string, number>
  onlineByAge: Record<string, number>
  offlineTotal: number
  offlineByCategory: Record<string, number>
  grandTotal: number
  onlineRevenue: number
  onlineFee: number
  onlineNet: number
  offlineRevenue: number
  totalRevenue: number
  totalNet: number
}

export interface ParseResult {
  success: boolean
  periodStart: Date
  periodEnd: Date
  onlineSales: OnlineSaleRecord[]
  offlineSales: OfflineSaleRecord[]
  monthlySummary: MonthlySummaryData
  errors: string[]
}

// ==========================================
// 상수 및 매핑
// ==========================================

// 기본 티켓 가격
const BASE_PRICE = 3000

// 채널 수수료율
const CHANNEL_FEE_RATES: Record<string, number> = {
  'NAVER_MAZE_25': 10,
  'MAZE_TICKET': 12,
  'MAZE_TICKET_SINGLE': 12,
  'GENERAL_TICKET': 15,
  'OTHER': 15,
}

// 구분 코드 매핑
const CATEGORY_MAP: Record<string, string> = {
  '개인': 'INDIVIDUAL',
  '여행사': 'TRAVEL_AGENCY',
  '택시': 'TAXI',
  '도민': 'RESIDENT',
  '올패스': 'ALL_PASS',
  '순환버스할인': 'SHUTTLE_DISCOUNT',
  '학단': 'SCHOOL_GROUP',
}

// ==========================================
// 유틸리티 함수
// ==========================================

/**
 * 채널명에서 채널코드 추출
 */
function getChannelCode(channelName: string): string {
  const normalized = channelName.replace(/\r?\n/g, ' ').trim()
  
  if (normalized.includes('네이버')) return 'NAVER_MAZE_25'
  if (normalized.includes('일반채널')) return 'GENERAL_TICKET'
  if (normalized.includes('단품')) return 'MAZE_TICKET_SINGLE'
  if (normalized.includes('메이즈랜드')) return 'MAZE_TICKET'
  
  return 'OTHER'
}

/**
 * 구분명에서 구분코드 추출
 */
function getCategoryCode(category: string): string {
  const trimmed = category.trim()
  return CATEGORY_MAP[trimmed] || 'OTHER'
}

/**
 * 엑셀 시리얼 날짜 → JS Date 변환
 */
function excelSerialToDate(serial: number): Date {
  // 엑셀 시리얼 날짜 (1900년 1월 1일 기준)
  return new Date((serial - 25569) * 86400 * 1000)
}

// ==========================================
// 메인 파서
// ==========================================

/**
 * 엑셀 파일 파싱 메인 함수
 */
export function parseExcelFile(buffer: ArrayBuffer): ParseResult {
  const errors: string[] = []
  const onlineSales: OnlineSaleRecord[] = []
  const offlineSales: OfflineSaleRecord[] = []
  
  // 집계용 변수 - 일별 데이터에서 직접 계산
  let onlineTotal = 0
  let offlineTotal = 0
  const onlineByChannel: Record<string, number> = {}
  const onlineByAge: Record<string, number> = {}
  const offlineByCategory: Record<string, number> = {}
  
  let onlineRevenue = 0
  let onlineFee = 0
  let onlineNet = 0
  let offlineRevenue = 0
  
  let periodStart: Date | null = null
  let periodEnd: Date | null = null
  
  try {
    // cellDates: false로 설정하여 날짜를 숫자로 유지
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: false })
    const sheetNames = workbook.SheetNames
    
    if (sheetNames.length === 0) {
      return {
        success: false,
        periodStart: new Date(),
        periodEnd: new Date(),
        onlineSales: [],
        offlineSales: [],
        monthlySummary: getEmptySummary(),
        errors: ['엑셀 파일에 시트가 없습니다.'],
      }
    }

    // 현재 연도/월
    const currentYear = new Date().getFullYear()
    let dataMonth = new Date().getMonth() + 1

    // 각 시트 처리
    for (const sheetName of sheetNames) {
      // 시트명에서 날짜 범위 추출 (예: "24~30", "8~16")
      const sheetMatch = sheetName.match(/(\d+)~(\d+)/)
      if (!sheetMatch) continue
      
      const sheet = workbook.Sheets[sheetName]
      const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][]
      
      if (!rawData || rawData.length === 0) continue
      
      // 섹션 파싱
      let currentSection: 'none' | 'online' | 'offline' = 'none'
      let dateColumns: { col: number; date: Date }[] = []
      
      // 현재 업체/채널 정보 (병합 셀 처리용)
      let currentVendor = ''
      let currentChannel = ''
      let currentChannelCode = ''
      let currentFeeRate = 0
      
      for (let rowIndex = 0; rowIndex < rawData.length; rowIndex++) {
        const row = rawData[rowIndex]
        if (!row || row.length === 0) continue
        
        const firstCell = String(row[0] || '').trim()
        
        // 섹션 감지
        if (firstCell.includes('인터넷') && firstCell.includes('판매')) {
          currentSection = 'online'
          
          // 제목에서 월 정보 추출
          const monthMatch = firstCell.match(/(\d+)월/)
          if (monthMatch) {
            dataMonth = parseInt(monthMatch[1], 10)
          }
          continue
        }
        
        if (firstCell.includes('현장') && firstCell.includes('판매')) {
          currentSection = 'offline'
          continue
        }
        
        // 헤더 행 감지
        if ((currentSection === 'online' && firstCell === '업체') ||
            (currentSection === 'offline' && firstCell === '구분')) {
          dateColumns = []
          
          // 날짜 컬럼 인덱스 찾기 (월계/합계 열은 제외)
          for (let col = 0; col < row.length; col++) {
            const cell = row[col]
            
            // "월계", "합계" 등의 텍스트가 있는 열은 스킵
            if (typeof cell === 'string' && (cell.includes('계') || cell.includes('합'))) {
              continue
            }
            
            // 엑셀 시리얼 날짜 (2024년 기준 약 45000대)
            if (typeof cell === 'number' && cell > 43831 && cell < 50000) {
              const date = excelSerialToDate(cell)
              dateColumns.push({ col, date })
              
              // 기간 업데이트
              if (!periodStart || date < periodStart) periodStart = date
              if (!periodEnd || date > periodEnd) periodEnd = date
            }
          }
          
          continue
        }
        
        // 합계 행 스킵
        if (firstCell === '계' || firstCell === '합계' || firstCell.includes('소계')) {
          continue
        }
        
        // 인터넷 판매 데이터 행 처리
        if (currentSection === 'online' && dateColumns.length > 0) {
          // 업체명 업데이트 (빈 셀이면 이전 값 유지 - 병합 셀)
          if (row[0] && String(row[0]).trim()) {
            currentVendor = String(row[0]).replace(/\r?\n/g, ' ').trim()
          }
          
          // 채널 업데이트
          if (row[1] && String(row[1]).trim()) {
            currentChannel = String(row[1]).replace(/\r?\n/g, ' ').trim()
            currentChannelCode = getChannelCode(currentChannel)
            currentFeeRate = CHANNEL_FEE_RATES[currentChannelCode] || 15
          }
          
          // 연령구분 (3번째 컬럼, 인덱스 2)
          const ageGroup = row[2] ? String(row[2]).trim() : ''
          if (!ageGroup || !['성인', '청소년', '어린이'].includes(ageGroup)) continue
          
          // 입금가 (4번째 컬럼, 인덱스 3)
          const unitPrice = typeof row[3] === 'number' ? row[3] : 0
          
          // 일별 데이터만 처리 (월계 열 사용 안함)
          for (const { col, date } of dateColumns) {
            const quantity = typeof row[col] === 'number' ? row[col] : 0
            if (quantity <= 0) continue
            
            const totalAmount = quantity * BASE_PRICE
            const feeAmount = Math.round(totalAmount * (currentFeeRate / 100))
            const netAmount = totalAmount - feeAmount
            
            onlineSales.push({
              saleDate: date,
              vendor: currentVendor,
              channel: currentChannel,
              channelCode: currentChannelCode,
              feeRate: currentFeeRate,
              ageGroup,
              unitPrice,
              quantity,
              totalAmount,
              feeAmount,
              netAmount,
            })
            
            // 집계 (일별 데이터에서 직접 계산)
            onlineTotal += quantity
            onlineByChannel[currentChannelCode] = (onlineByChannel[currentChannelCode] || 0) + quantity
            onlineByAge[ageGroup] = (onlineByAge[ageGroup] || 0) + quantity
            onlineRevenue += totalAmount
            onlineFee += feeAmount
            onlineNet += netAmount
          }
        }
        
        // 현장 판매 데이터 행 처리
        if (currentSection === 'offline' && dateColumns.length > 0) {
          const category = firstCell
          if (!category || category === '계' || category.includes('소계')) continue
          
          const categoryCode = getCategoryCode(category)
          if (categoryCode === 'OTHER' && !CATEGORY_MAP[category]) continue // 알 수 없는 카테고리 스킵
          
          // 일별 데이터만 처리 (월계 열 사용 안함)
          for (const { col, date } of dateColumns) {
            const quantity = typeof row[col] === 'number' ? row[col] : 0
            if (quantity <= 0) continue
            
            const totalAmount = quantity * BASE_PRICE
            
            offlineSales.push({
              saleDate: date,
              category,
              categoryCode,
              quantity,
              unitPrice: BASE_PRICE,
              totalAmount,
            })
            
            // 집계 (일별 데이터에서 직접 계산)
            offlineTotal += quantity
            offlineByCategory[categoryCode] = (offlineByCategory[categoryCode] || 0) + quantity
            offlineRevenue += totalAmount
          }
        }
      }
    }

    // 기간이 없으면 기본값
    if (!periodStart) periodStart = new Date()
    if (!periodEnd) periodEnd = new Date()

    // 디버그 로그
    console.log('[Excel Parser] Online total:', onlineTotal)
    console.log('[Excel Parser] Online by channel:', onlineByChannel)
    console.log('[Excel Parser] Offline total:', offlineTotal)
    console.log('[Excel Parser] Offline by category:', offlineByCategory)

    // 월간 집계 데이터 생성
    const monthlySummary: MonthlySummaryData = {
      year: currentYear,
      month: dataMonth,
      onlineTotal,
      onlineByChannel,
      onlineByAge,
      offlineTotal,
      offlineByCategory,
      grandTotal: onlineTotal + offlineTotal,
      onlineRevenue,
      onlineFee,
      onlineNet,
      offlineRevenue,
      totalRevenue: onlineRevenue + offlineRevenue,
      totalNet: onlineNet + offlineRevenue,
    }

    const success = onlineTotal > 0 || offlineTotal > 0

    return {
      success,
      periodStart,
      periodEnd,
      onlineSales,
      offlineSales,
      monthlySummary,
      errors: success ? [] : ['데이터를 파싱하지 못했습니다. 파일 형식을 확인하세요.'],
    }
  } catch (error) {
    console.error('[Excel Parser] Error:', error)
    return {
      success: false,
      periodStart: new Date(),
      periodEnd: new Date(),
      onlineSales: [],
      offlineSales: [],
      monthlySummary: getEmptySummary(),
      errors: [`파일 파싱 오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}`],
    }
  }
}

/**
 * 빈 월간 집계 데이터
 */
function getEmptySummary(): MonthlySummaryData {
  return {
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    onlineTotal: 0,
    onlineByChannel: {},
    onlineByAge: {},
    offlineTotal: 0,
    offlineByCategory: {},
    grandTotal: 0,
    onlineRevenue: 0,
    onlineFee: 0,
    onlineNet: 0,
    offlineRevenue: 0,
    totalRevenue: 0,
    totalNet: 0,
  }
}
