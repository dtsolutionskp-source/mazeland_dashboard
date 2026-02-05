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

export interface DataValidation {
  // 엑셀 "계" 행에 표시된 값
  excelOnlineTotal: number
  excelOfflineTotal: number
  // 개별 행 합산 값
  calculatedOnlineTotal: number
  calculatedOfflineTotal: number
  // 불일치 여부
  hasOnlineMismatch: boolean
  hasOfflineMismatch: boolean
  hasMismatch: boolean
}

export interface ParseResult {
  success: boolean
  periodStart: Date
  periodEnd: Date
  onlineSales: OnlineSaleRecord[]
  offlineSales: OfflineSaleRecord[]
  monthlySummary: MonthlySummaryData
  // 채널명/카테고리명 매핑 (코드 -> 표시명)
  channelNames: Record<string, string>
  channelFeeRates: Record<string, number>
  categoryNames: Record<string, string>
  errors: string[]
  // 데이터 검증 결과
  validation?: DataValidation
}

// ==========================================
// 상수 및 매핑
// ==========================================

// 기본 티켓 가격
const BASE_PRICE = 3000

// 채널 수수료율 (채널명에서 추출하거나 기본값 사용)
const CHANNEL_FEE_RATES: Record<string, number> = {
  'NAVER_MAZE_25': 10,
  'MAZE_TICKET': 12,
  'MAZE_TICKET_SINGLE': 12,
  'MAZE_25_SPECIAL': 10,
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
 * 중분류(종류)에서 채널 정보 추출
 * - 대분류(업체) + 중분류(종류)가 동일하면 같은 채널로 처리
 * - 수수료율이 달라도 같은 채널로 합산 (수수료 변동은 수기 처리)
 * - 수수료율은 끝 괄호 (00%)에서 추출, 없으면 0%
 */
function parseChannelInfo(vendor: string, channelName: string): { code: string; name: string; feeRate: number } {
  const normalizedChannel = channelName.replace(/\r?\n/g, ' ').trim()
  const normalizedVendor = vendor.replace(/\r?\n/g, ' ').trim()
  
  // 수수료율 추출 (예: "네이버 메이즈랜드 25년 (10%)" -> 10)
  // 끝 괄호에서 추출
  const feeMatch = normalizedChannel.match(/\((\d+(?:\.\d+)?)\s*%?\)\s*$/)
  let feeRate = 0  // 기본값 0% (없으면 0)
  if (feeMatch) {
    feeRate = parseFloat(feeMatch[1])
  }
  
  // 종류명에서 수수료율 부분 제거 -> 중분류명
  const channelNameClean = normalizedChannel.replace(/\s*\(\d+(?:\.\d+)?%?\)\s*$/, '').trim()
  
  // 채널코드: 업체_종류로 생성 (수수료율 제외)
  // 대분류 + 중분류가 동일하면 같은 채널로 처리
  const vendorPart = normalizedVendor.replace(/[^가-힣a-zA-Z0-9]/g, '').slice(0, 15)
  const channelPart = channelNameClean.replace(/[^가-힣a-zA-Z0-9]/g, '').slice(0, 20)
  
  const code = `${vendorPart}_${channelPart}`.toUpperCase() || 'OTHER'
  
  // 표시명: 중분류만 (수수료율 제외)
  const displayName = channelNameClean
  
  return { 
    code, 
    name: displayName,
    feeRate 
  }
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
  return new Date((serial - 25569) * 86400 * 1000)
}

/**
 * 시트명에서 날짜 파싱 (예: "12.14" -> 1214)
 */
function parseSheetDate(sheetName: string): number {
  const parts = sheetName.split('.')
  if (parts.length === 2) {
    const month = parseInt(parts[0], 10) || 0
    const day = parseInt(parts[1], 10) || 0
    return month * 100 + day
  }
  return 0
}

// ==========================================
// 메인 파서
// ==========================================

/**
 * 엑셀 파일 파싱 메인 함수
 * 
 * 파일 구조:
 * - 시트별 주간 데이터, 시트명은 해당 주의 마지막 날짜 (예: "12.14", "12.21")
 * - 인터넷 판매: 업체 | 종류 | 연령대 | 입금가 | 일자1~7 | 주계 | 월계
 * - 종류(채널): 성인/청소년/어린이 행이 있지만, 같은 채널은 모두 합산
 * - 월계는 가장 마지막 시트의 값이 전체 월 누적
 */
export function parseExcelFile(buffer: ArrayBuffer): ParseResult {
  const errors: string[] = []
  const onlineSales: OnlineSaleRecord[] = []
  const offlineSales: OfflineSaleRecord[] = []
  
  // 일별 집계
  const dailyOnlineByDate: Record<string, number> = {}  // date -> count
  const dailyOfflineByDate: Record<string, number> = {}
  
  // 일별 채널별 집계
  const dailyChannelData: Record<string, Record<string, number>> = {}  // date -> { channelCode: count }
  const dailyCategoryData: Record<string, Record<string, number>> = {}  // date -> { categoryCode: count }
  
  // 월계 (가장 마지막 시트에서만 읽음)
  const monthlyOnlineByChannel: Record<string, number> = {}
  const monthlyOfflineByCategory: Record<string, number> = {}
  
  // 엑셀 "계" 행의 월계 값 (검증용)
  let excelOnlineTotal = 0
  let excelOfflineTotal = 0
  
  // 채널명 저장 (코드 -> 이름)
  const channelNames: Record<string, string> = {}
  const channelFeeRates: Record<string, number> = {}
  const categoryNames: Record<string, string> = {}
  
  let periodStart: Date | null = null
  let periodEnd: Date | null = null
  let dataYear = new Date().getFullYear()
  let dataMonth = new Date().getMonth() + 1
  
  try {
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: false })
    const sheetNames = workbook.SheetNames
    
    console.log('[Excel Parser] All sheet names:', sheetNames)
    
    if (sheetNames.length === 0) {
      return {
        success: false,
        periodStart: new Date(),
        periodEnd: new Date(),
        onlineSales: [],
        offlineSales: [],
        monthlySummary: getEmptySummary(),
        channelNames: {},
        channelFeeRates: {},
        categoryNames: {},
        errors: ['엑셀 파일에 시트가 없습니다.'],
      }
    }

    // 시트 정렬 (날짜 기준 오름차순 - 가장 나중 날짜가 마지막)
    const sortedSheets = sheetNames
      .filter(name => {
        // "Sheet1" 등 기본 시트 제외
        if (name.toLowerCase().includes('sheet')) return false
        // 날짜 형식인지 확인 (월.일)
        return parseSheetDate(name) > 0
      })
      .sort((a, b) => parseSheetDate(a) - parseSheetDate(b))
    
    console.log('[Excel Parser] Sorted sheets:', sortedSheets)
    
    if (sortedSheets.length === 0) {
      // 날짜 형식이 아닌 시트만 있는 경우, 전체 시트 사용
      sortedSheets.push(...sheetNames.filter(n => !n.toLowerCase().includes('sheet')))
    }
    
    // 가장 마지막 시트 (월계 데이터 소스)
    const latestSheet = sortedSheets[sortedSheets.length - 1]
    console.log('[Excel Parser] Latest sheet for monthly totals:', latestSheet)
    
    // 각 시트 처리
    for (const sheetName of sortedSheets) {
      const isLatestSheet = (sheetName === latestSheet)
      console.log(`[Excel Parser] Processing sheet: "${sheetName}" (latest: ${isLatestSheet})`)
      
      const sheet = workbook.Sheets[sheetName]
      const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][]
      
      if (!rawData || rawData.length === 0) continue
      
      let currentSection: 'none' | 'online' | 'offline' = 'none'
      let headerRowIndex = -1
      let dateColumns: { col: number; date: Date }[] = []
      let monthlyTotalCol = -1
      
      // 병합 셀용 - 현재 채널 정보
      let currentVendor = ''
      let currentChannel = ''
      let currentChannelCode = ''
      let currentFeeRate = 0
      
      // 1차 스캔: 섹션 및 헤더 찾기
      for (let rowIndex = 0; rowIndex < rawData.length; rowIndex++) {
        const row = rawData[rowIndex]
        if (!row || row.length === 0) continue
        
        const firstCell = String(row[0] || '').trim()
        const rowStr = row.map(c => String(c || '')).join(' ')
        
        // 인터넷 판매 섹션 감지
        if (rowStr.includes('인터넷') && rowStr.includes('판매')) {
          currentSection = 'online'
          headerRowIndex = -1
          dateColumns = []
          monthlyTotalCol = -1
          
          // 연/월 추출
          const yearMonthMatch = rowStr.match(/(\d{2,4})년\s*(\d+)월/)
          if (yearMonthMatch) {
            const yr = parseInt(yearMonthMatch[1], 10)
            dataYear = yr < 100 ? 2000 + yr : yr
            dataMonth = parseInt(yearMonthMatch[2], 10)
          }
          console.log(`[Excel Parser] Online section found at row ${rowIndex}, year: ${dataYear}, month: ${dataMonth}`)
          continue
        }
        
        // 현장 판매 섹션 감지
        if (rowStr.includes('현장') && rowStr.includes('판매')) {
          currentSection = 'offline'
          headerRowIndex = -1
          dateColumns = []
          monthlyTotalCol = -1
          console.log(`[Excel Parser] Offline section found at row ${rowIndex}`)
          continue
        }
        
        // 헤더 행 감지 (업체/구분)
        if ((currentSection === 'online' && firstCell === '업체') ||
            (currentSection === 'offline' && firstCell === '구분')) {
          headerRowIndex = rowIndex
          dateColumns = []
          monthlyTotalCol = -1
          
          // 컬럼 분석
          for (let col = 0; col < row.length; col++) {
            const cell = row[col]
            const cellStr = String(cell || '').trim()
            
            // 월 계 컬럼
            if (cellStr.includes('월') && cellStr.includes('계')) {
              monthlyTotalCol = col
              console.log(`[Excel Parser] "월 계" column at ${col}`)
              continue
            }
            
            // 주 계, 합계 등 스킵
            if (cellStr.includes('계') || cellStr.includes('합')) continue
            
            // 날짜 컬럼 (엑셀 시리얼 날짜)
            if (typeof cell === 'number' && cell > 43831 && cell < 50000) {
              const date = excelSerialToDate(cell)
              dateColumns.push({ col, date })
              
              if (!periodStart || date < periodStart) periodStart = date
              if (!periodEnd || date > periodEnd) periodEnd = date
            }
          }
          
          console.log(`[Excel Parser] Header at row ${rowIndex}, ${dateColumns.length} date columns, monthlyCol: ${monthlyTotalCol}`)
          continue
        }
        
        // 합계 행 처리 - 월계 값 추출 (가장 마지막 시트에서만)
        if (firstCell === '계' || firstCell === '합계' || firstCell.includes('소계')) {
          if (isLatestSheet && monthlyTotalCol >= 0) {
            const totalVal = typeof row[monthlyTotalCol] === 'number' ? row[monthlyTotalCol] : 0
            if (currentSection === 'online') {
              excelOnlineTotal = totalVal
              console.log(`[Excel Parser] 인터넷 판매 "계" 행 월계: ${totalVal}`)
            } else if (currentSection === 'offline') {
              excelOfflineTotal = totalVal
              console.log(`[Excel Parser] 현장 판매 "계" 행 월계: ${totalVal}`)
            }
          }
          continue
        }
        
        // 데이터 행 처리 - 인터넷 판매
        if (currentSection === 'online' && headerRowIndex >= 0) {
          // 업체 업데이트 (병합 셀 처리)
          if (row[0] && String(row[0]).trim()) {
            currentVendor = String(row[0]).replace(/\r?\n/g, ' ').trim()
          }
          
          // 종류(채널/중분류) 업데이트
          if (row[1] && String(row[1]).trim()) {
            currentChannel = String(row[1]).replace(/\r?\n/g, ' ').trim()
            // 업체명과 종류명을 함께 사용하여 채널 정보 추출
            const channelInfo = parseChannelInfo(currentVendor, currentChannel)
            currentChannelCode = channelInfo.code
            currentFeeRate = channelInfo.feeRate
            
            // 채널명(종류 원본)/수수료율 저장
            channelNames[currentChannelCode] = channelInfo.name
            channelFeeRates[currentChannelCode] = currentFeeRate
            
            console.log(`[Excel Parser] Channel: ${currentVendor} > ${currentChannel} -> code: ${currentChannelCode}, name: ${channelInfo.name}, fee: ${currentFeeRate}%`)
          }
          
          // 연령대 (성인/청소년/어린이) - 무시하고 모든 행 처리
          const ageGroup = row[2] ? String(row[2]).trim() : ''
          // 연령대가 없거나 숫자가 있는 행은 데이터 행이 아닐 수 있음
          if (!ageGroup || !['성인', '청소년', '어린이'].includes(ageGroup)) continue
          
          const unitPrice = typeof row[3] === 'number' ? row[3] : 0
          
          // 일별 데이터 처리 (성인+청소년+어린이 합산)
          for (const { col, date } of dateColumns) {
            const qty = typeof row[col] === 'number' ? row[col] : 0
            if (qty <= 0) continue
            
            const dateStr = date.toISOString().split('T')[0]
            
            // 일별 합계
            dailyOnlineByDate[dateStr] = (dailyOnlineByDate[dateStr] || 0) + qty
            
            // 일별 채널별 합계
            if (!dailyChannelData[dateStr]) dailyChannelData[dateStr] = {}
            dailyChannelData[dateStr][currentChannelCode] = 
              (dailyChannelData[dateStr][currentChannelCode] || 0) + qty
            
            // OnlineSaleRecord 저장
            const totalAmount = qty * BASE_PRICE
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
              quantity: qty,
              totalAmount,
              feeAmount,
              netAmount,
            })
          }
          
          // 월계 데이터 (가장 마지막 시트에서만)
          if (isLatestSheet && monthlyTotalCol >= 0) {
            const monthlyQty = typeof row[monthlyTotalCol] === 'number' ? row[monthlyTotalCol] : 0
            if (monthlyQty > 0) {
              monthlyOnlineByChannel[currentChannelCode] = 
                (monthlyOnlineByChannel[currentChannelCode] || 0) + monthlyQty
            }
          }
        }
        
        // 데이터 행 처리 - 현장 판매
        if (currentSection === 'offline' && headerRowIndex >= 0) {
          const category = firstCell
          if (!category || category === '계' || category.includes('소계')) continue
          
          const categoryCode = getCategoryCode(category)
          if (categoryCode === 'OTHER' && !CATEGORY_MAP[category]) continue
          
          categoryNames[categoryCode] = category
          
          // 일별 데이터 처리
          for (const { col, date } of dateColumns) {
            const qty = typeof row[col] === 'number' ? row[col] : 0
            if (qty <= 0) continue
            
            const dateStr = date.toISOString().split('T')[0]
            
            // 일별 합계
            dailyOfflineByDate[dateStr] = (dailyOfflineByDate[dateStr] || 0) + qty
            
            // 일별 카테고리별 합계
            if (!dailyCategoryData[dateStr]) dailyCategoryData[dateStr] = {}
            dailyCategoryData[dateStr][categoryCode] = 
              (dailyCategoryData[dateStr][categoryCode] || 0) + qty
            
            // OfflineSaleRecord 저장
            offlineSales.push({
              saleDate: date,
              category,
              categoryCode,
              quantity: qty,
              unitPrice: BASE_PRICE,
              totalAmount: qty * BASE_PRICE,
            })
          }
          
          // 월계 데이터 (가장 마지막 시트에서만)
          if (isLatestSheet && monthlyTotalCol >= 0) {
            const monthlyQty = typeof row[monthlyTotalCol] === 'number' ? row[monthlyTotalCol] : 0
            if (monthlyQty > 0) {
              monthlyOfflineByCategory[categoryCode] = 
                (monthlyOfflineByCategory[categoryCode] || 0) + monthlyQty
            }
          }
        }
      }
    }

    // 기간 기본값
    if (!periodStart) periodStart = new Date()
    if (!periodEnd) periodEnd = new Date()

    // 최종 집계 계산
    // 1. 일별 데이터에서 합산
    const dailyOnlineTotal = Object.values(dailyOnlineByDate).reduce((sum, v) => sum + v, 0)
    const dailyOfflineTotal = Object.values(dailyOfflineByDate).reduce((sum, v) => sum + v, 0)
    
    // 2. 월계 데이터에서 합산
    const monthlyOnlineTotal = Object.values(monthlyOnlineByChannel).reduce((sum, v) => sum + v, 0)
    const monthlyOfflineTotal = Object.values(monthlyOfflineByCategory).reduce((sum, v) => sum + v, 0)
    
    console.log('[Excel Parser] === 집계 결과 ===')
    console.log('[Excel Parser] 일별 합산 - 인터넷:', dailyOnlineTotal, '현장:', dailyOfflineTotal)
    console.log('[Excel Parser] 월계 - 인터넷:', monthlyOnlineTotal, '현장:', monthlyOfflineTotal)
    console.log('[Excel Parser] 채널별 월계:', monthlyOnlineByChannel)
    console.log('[Excel Parser] 카테고리별 월계:', monthlyOfflineByCategory)
    
    // 3. 최종 합계 결정 (월계 > 일별)
    // 월계가 있으면 월계 사용 (더 정확함)
    const hasMonthlyData = monthlyOnlineTotal > 0 || monthlyOfflineTotal > 0
    
    const finalOnlineByChannel = hasMonthlyData && monthlyOnlineTotal > 0 
      ? monthlyOnlineByChannel 
      : Object.entries(dailyChannelData).reduce((acc, [date, channels]) => {
          for (const [code, count] of Object.entries(channels)) {
            acc[code] = (acc[code] || 0) + count
          }
          return acc
        }, {} as Record<string, number>)
    
    const finalOfflineByCategory = hasMonthlyData && monthlyOfflineTotal > 0
      ? monthlyOfflineByCategory
      : Object.entries(dailyCategoryData).reduce((acc, [date, categories]) => {
          for (const [code, count] of Object.entries(categories)) {
            acc[code] = (acc[code] || 0) + count
          }
          return acc
        }, {} as Record<string, number>)
    
    const finalOnlineTotal = hasMonthlyData && monthlyOnlineTotal > 0 ? monthlyOnlineTotal : dailyOnlineTotal
    const finalOfflineTotal = hasMonthlyData && monthlyOfflineTotal > 0 ? monthlyOfflineTotal : dailyOfflineTotal
    
    // 교차 검증
    if (hasMonthlyData) {
      if (monthlyOnlineTotal !== dailyOnlineTotal) {
        console.log(`[Excel Parser] ⚠️ 인터넷 판매 불일치: 월계=${monthlyOnlineTotal}, 일별합=${dailyOnlineTotal}`)
        // 월계를 신뢰 (최종 누적값)
      }
      if (monthlyOfflineTotal !== dailyOfflineTotal) {
        console.log(`[Excel Parser] ⚠️ 현장 판매 불일치: 월계=${monthlyOfflineTotal}, 일별합=${dailyOfflineTotal}`)
      }
    }
    
    // 매출 계산
    let onlineRevenue = 0
    let onlineFee = 0
    let onlineNet = 0
    
    for (const [channelCode, count] of Object.entries(finalOnlineByChannel)) {
      const feeRate = channelFeeRates[channelCode] || CHANNEL_FEE_RATES[channelCode] || 15
      const revenue = count * BASE_PRICE
      const fee = Math.round(revenue * (feeRate / 100))
      onlineRevenue += revenue
      onlineFee += fee
      onlineNet += revenue - fee
    }
    
    const offlineRevenue = finalOfflineTotal * BASE_PRICE
    
    // 연령대별 집계
    const onlineByAge: Record<string, number> = {}
    for (const sale of onlineSales) {
      onlineByAge[sale.ageGroup] = (onlineByAge[sale.ageGroup] || 0) + sale.quantity
    }

    console.log('[Excel Parser] === 최종 결과 ===')
    console.log('[Excel Parser] 인터넷:', finalOnlineTotal, '현장:', finalOfflineTotal, '총합:', finalOnlineTotal + finalOfflineTotal)
    console.log('[Excel Parser] 채널별:', finalOnlineByChannel)
    console.log('[Excel Parser] 카테고리별:', finalOfflineByCategory)
    console.log('[Excel Parser] 일별 인터넷:', dailyOnlineByDate)
    console.log('[Excel Parser] 일별 현장:', dailyOfflineByDate)

    const monthlySummary: MonthlySummaryData = {
      year: dataYear,
      month: dataMonth,
      onlineTotal: finalOnlineTotal,
      onlineByChannel: finalOnlineByChannel,
      onlineByAge,
      offlineTotal: finalOfflineTotal,
      offlineByCategory: finalOfflineByCategory,
      grandTotal: finalOnlineTotal + finalOfflineTotal,
      onlineRevenue,
      onlineFee,
      onlineNet,
      offlineRevenue,
      totalRevenue: onlineRevenue + offlineRevenue,
      totalNet: onlineNet + offlineRevenue,
    }

    const success = finalOnlineTotal > 0 || finalOfflineTotal > 0

    // 데이터 검증 - 엑셀 "계" 행과 개별 행 합산 비교
    const calculatedOnlineTotal = Object.values(monthlyOnlineByChannel).reduce((sum, v) => sum + v, 0)
    const calculatedOfflineTotal = Object.values(monthlyOfflineByCategory).reduce((sum, v) => sum + v, 0)
    
    const hasOnlineMismatch = excelOnlineTotal > 0 && calculatedOnlineTotal !== excelOnlineTotal
    const hasOfflineMismatch = excelOfflineTotal > 0 && calculatedOfflineTotal !== excelOfflineTotal
    const hasMismatch = hasOnlineMismatch || hasOfflineMismatch
    
    if (hasMismatch) {
      console.log(`[Excel Parser] ⚠️ 데이터 불일치 감지!`)
      console.log(`  인터넷: 계행=${excelOnlineTotal}, 합산=${calculatedOnlineTotal}, 불일치=${hasOnlineMismatch}`)
      console.log(`  현장: 계행=${excelOfflineTotal}, 합산=${calculatedOfflineTotal}, 불일치=${hasOfflineMismatch}`)
    }
    
    const validation = {
      excelOnlineTotal,
      excelOfflineTotal,
      calculatedOnlineTotal,
      calculatedOfflineTotal,
      hasOnlineMismatch,
      hasOfflineMismatch,
      hasMismatch,
    }

    return {
      success,
      periodStart,
      periodEnd,
      onlineSales,
      offlineSales,
      monthlySummary,
      channelNames,
      channelFeeRates,
      categoryNames,
      errors: success ? [] : ['데이터를 파싱하지 못했습니다. 파일 형식을 확인하세요.'],
      validation,
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
      channelNames: {},
      channelFeeRates: {},
      categoryNames: {},
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
