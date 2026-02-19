'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { formatNumber } from '@/lib/utils'
import { useDashboardStore } from '@/stores/dashboard-store'

interface SalesData {
  date: string
  online: number
  offline: number
  total: number
  // 전월 데이터 (옵션)
  prevOnline?: number
  prevOffline?: number
  prevTotal?: number
}

interface MarketingMarker {
  date: string // 그래프 매칭용 (02/16 형식)
  endDate?: string
  displayDate?: string // 범례 표시용 (2/16 형식)
  displayEndDate?: string
  type: string
  title: string
  // 새로운 마케팅 로그 구조
  impressions?: number
  clicks?: number
  clickRate?: string
}

interface SalesChartProps {
  data: SalesData[]
  prevData?: SalesData[] // 전월 데이터
  markers?: MarketingMarker[]
  height?: number
  // 외부에서 직접 제어 (store 사용 안 할 때)
  showTotal?: boolean
  showOnline?: boolean
  showOffline?: boolean
  showPrevMonth?: boolean
  // 데이터 클릭 핸들러
  onDataClick?: (date: string) => void
  // 주말/연휴 표시를 위한 년월 (예: "2026-02")
  yearMonth?: string
}

const TYPE_COLORS: Record<string, string> = {
  CAMPAIGN: '#3b82f6',     // 캠페인 - 파란색
  PERFORMANCE: '#f59e0b',  // 퍼포먼스 - 주황색 (캠페인과 구분)
  HOLIDAY: '#ef4444',      // 연휴 - 빨간색
  OTHER: '#6b7280',
}

const TYPE_ICONS: Record<string, string> = {
  CAMPAIGN: '📢',
  PERFORMANCE: '📈',
  HOLIDAY: '🎌',
  OTHER: '📌',
}

const TYPE_NAMES: Record<string, string> = {
  CAMPAIGN: '캠페인',
  PERFORMANCE: '퍼포먼스',
  HOLIDAY: '연휴',
  OTHER: '기타',
}

export function SalesChart({ 
  data, 
  prevData,
  markers = [], 
  height = 400, 
  showTotal: propShowTotal,
  showOnline: propShowOnline,
  showOffline: propShowOffline,
  showPrevMonth: propShowPrevMonth,
  onDataClick,
  yearMonth,
}: SalesChartProps) {
  // Store에서 상태 가져오기 (prop이 없으면 store 값 사용)
  const store = useDashboardStore()
  
  const showTotal = propShowTotal ?? store.showTotal
  const showOnline = propShowOnline ?? store.showOnline
  const showOffline = propShowOffline ?? store.showOffline
  const showPrevMonth = propShowPrevMonth ?? store.showPrevMonthLine

  // 연휴 마커 날짜 집합 (빨간색 표시용)
  const holidayDates = new Set(
    markers.filter(m => m.type === 'HOLIDAY').map(m => m.date)
  )

  // 주말 여부 확인 (yearMonth가 있을 때만)
  const isWeekend = (dateStr: string): boolean => {
    if (!yearMonth) return false
    // dateStr: "02/16" 또는 "2/16" 형식
    const dayMatch = dateStr.match(/(\d+)\/(\d+)/)
    if (!dayMatch) return false
    const month = parseInt(dayMatch[1])
    const day = parseInt(dayMatch[2])
    const [year] = yearMonth.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    const dayOfWeek = date.getDay()
    return dayOfWeek === 0 || dayOfWeek === 6 // 일요일(0) 또는 토요일(6)
  }

  // 날짜가 빨간색이어야 하는지 확인 (주말 또는 연휴)
  const isRedDate = (dateStr: string): boolean => {
    return holidayDates.has(dateStr) || isWeekend(dateStr)
  }

  // 전월 데이터를 현재 데이터에 병합 (날짜의 "일" 기준 매핑)
  // 예: 12/1은 11/1과 비교, 12/8은 11/8과 비교
  const mergedData = data.map((item) => {
    // 날짜에서 "일"만 추출 (예: "12/08" -> 8, "1/15" -> 15)
    const dayMatch = item.date.match(/\/(\d+)$/)
    const currentDay = dayMatch ? parseInt(dayMatch[1]) : null
    
    // 전월 데이터에서 같은 "일"을 찾음
    const prevItem = prevData?.find(p => {
      const prevDayMatch = p.date.match(/\/(\d+)$/)
      const prevDay = prevDayMatch ? parseInt(prevDayMatch[1]) : null
      return prevDay === currentDay
    })
    
    return {
      ...item,
      prevOnline: prevItem?.online,
      prevOffline: prevItem?.offline,
      prevTotal: prevItem?.total,
    }
  })

  // 마커가 있는 날짜 집합
  const markerDates = new Set(markers.map(m => m.date))

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const marker = markers.find(m => m.date === label)
      const currentData = payload.filter((p: any) => !p.dataKey.startsWith('prev'))
      const prevDataItems = payload.filter((p: any) => p.dataKey.startsWith('prev'))
      
      return (
        <div className="bg-dashboard-card border border-dashboard-border rounded-lg p-4 shadow-xl min-w-[220px]">
          <p className="text-dashboard-text font-semibold mb-2 text-base">{label}</p>
          
          {/* 현재 월 데이터 */}
          <div className="space-y-1">
            <p className="text-xs text-maze-500 font-medium mb-1">이번 달</p>
            {currentData.map((entry: any, index: number) => (
              <div key={index} className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="text-sm text-dashboard-muted">{entry.name}</span>
                </div>
                <span className="text-sm font-medium" style={{ color: entry.color }}>
                  {formatNumber(entry.value)}명
                </span>
              </div>
            ))}
          </div>
          
          {/* 전월 데이터 */}
          {showPrevMonth && prevDataItems.length > 0 && (
            <div className="space-y-1 mt-3 pt-3 border-t border-dashboard-border">
              <p className="text-xs text-gray-500 font-medium mb-1">지난 달</p>
              {prevDataItems.map((entry: any, index: number) => (
                <div key={index} className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full opacity-50"
                      style={{ backgroundColor: entry.color }}
                    />
                    <span className="text-sm text-dashboard-muted">{entry.name}</span>
                  </div>
                  <span className="text-sm font-medium opacity-60" style={{ color: entry.color }}>
                    {entry.value ? formatNumber(entry.value) + '명' : '-'}
                  </span>
                </div>
              ))}
            </div>
          )}
          
          {marker && (
            <div className="mt-3 pt-3 border-t border-dashboard-border">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{TYPE_ICONS[marker.type] || '📌'}</span>
                <div>
                  <p className="text-xs text-dashboard-muted">
                    {TYPE_NAMES[marker.type] || '마케팅'}
                  </p>
                  <p className="text-sm font-medium" style={{ color: TYPE_COLORS[marker.type] }}>
                    {marker.title || '마케팅 이벤트'}
                    {marker.endDate && marker.endDate !== marker.date && ` (${marker.date}~${marker.endDate})`}
                  </p>
                </div>
              </div>
              {/* 노출량/클릭수/클릭율 표시 */}
              {(marker.impressions !== undefined && marker.impressions > 0) && (
                <div className="grid grid-cols-3 gap-2 text-center bg-dashboard-bg rounded p-2 mt-2">
                  <div>
                    <p className="text-[10px] text-dashboard-muted">노출량</p>
                    <p className="text-xs font-bold text-dashboard-text">{formatNumber(marker.impressions)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-dashboard-muted">클릭수</p>
                    <p className="text-xs font-bold text-dashboard-text">{formatNumber(marker.clicks || 0)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-dashboard-muted">클릭율</p>
                    <p className="text-xs font-bold text-maze-500">{marker.clickRate}%</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )
    }
    return null
  }

  // 커스텀 도트 (마커가 있는 날짜에 강조)
  const CustomDot = (props: any) => {
    const { cx, cy, payload, dataKey } = props
    const hasMarker = markerDates.has(payload.date)
    
    if (hasMarker && dataKey === 'total') {
      return (
        <g>
          <circle
            cx={cx}
            cy={cy}
            r={12}
            fill="none"
            stroke="#22c55e"
            strokeWidth={2}
            strokeDasharray="4 2"
            opacity={0.5}
          />
          <circle cx={cx} cy={cy} r={5} fill="#f59e0b" stroke="#fff" strokeWidth={2} />
        </g>
      )
    }
    
    return null
  }

  // 차트 클릭 핸들러
  const handleChartClick = (data: any) => {
    if (onDataClick && data?.activeLabel) {
      onDataClick(data.activeLabel)
    }
  }

  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={height}>
        <LineChart 
          data={mergedData} 
          margin={{ top: 30, right: 30, left: 20, bottom: 5 }}
          onClick={handleChartClick}
          style={{ cursor: onDataClick ? 'pointer' : 'default' }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis
            dataKey="date"
            stroke="#94a3b8"
            tick={(props: any) => {
              const { x, y, payload } = props
              const dateStr = payload?.value || ''
              const isRed = isRedDate(dateStr)
              return (
                <g transform={`translate(${x},${y})`}>
                  <text
                    x={0}
                    y={0}
                    dy={16}
                    textAnchor="middle"
                    fill={isRed ? '#ef4444' : '#94a3b8'}
                    fontSize={12}
                    fontWeight={isRed ? 600 : 400}
                    style={{ cursor: onDataClick ? 'pointer' : 'default' }}
                  >
                    {dateStr}
                  </text>
                </g>
              )
            }}
            tickLine={{ stroke: '#334155' }}
          />
          <YAxis
            stroke="#94a3b8"
            tick={{ fill: '#94a3b8', fontSize: 12 }}
            tickFormatter={(value) => formatNumber(value)}
            tickLine={{ stroke: '#334155' }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ paddingTop: '20px' }}
            formatter={(value) => <span className="text-dashboard-text text-sm">{value}</span>}
          />
          
          {/* 마케팅 로그 마커 */}
          {markers.map((marker, index) => (
            <ReferenceLine
              key={index}
              x={marker.date}
              stroke={TYPE_COLORS[marker.type] || '#22c55e'}
              strokeDasharray="5 5"
              strokeWidth={2}
              label={{
                value: TYPE_ICONS[marker.type] || '📌',
                position: 'top',
                fill: TYPE_COLORS[marker.type] || '#22c55e',
                fontSize: 16,
              }}
            />
          ))}
          
          {/* 전월 라인 (회색 계열, 점선) - 현재 월과 구분되도록 */}
          {showPrevMonth && prevData && prevData.length > 0 && (
            <>
              {showOnline && (
                <Line
                  type="monotone"
                  dataKey="prevOnline"
                  name="인터넷(전월)"
                  stroke="#9ca3af"
                  strokeWidth={2}
                  strokeDasharray="8 4"
                  strokeOpacity={0.7}
                  dot={false}
                  activeDot={false}
                />
              )}
              {showOffline && (
                <Line
                  type="monotone"
                  dataKey="prevOffline"
                  name="현장(전월)"
                  stroke="#6b7280"
                  strokeWidth={2}
                  strokeDasharray="8 4"
                  strokeOpacity={0.7}
                  dot={false}
                  activeDot={false}
                />
              )}
              {showTotal && (
                <Line
                  type="monotone"
                  dataKey="prevTotal"
                  name="전체(전월)"
                  stroke="#d1d5db"
                  strokeWidth={2}
                  strokeDasharray="8 4"
                  strokeOpacity={0.7}
                  dot={false}
                  activeDot={false}
                />
              )}
            </>
          )}
          
          {/* 현재 월 라인 */}
          {showOnline && (
            <Line
              type="monotone"
              dataKey="online"
              name="인터넷"
              stroke="#22c55e"
              strokeWidth={2}
              dot={{ fill: '#22c55e', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, fill: '#22c55e', stroke: '#fff', strokeWidth: 2 }}
            />
          )}
          {showOffline && (
            <Line
              type="monotone"
              dataKey="offline"
              name="현장"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }}
            />
          )}
          {showTotal && (
            <Line
              type="monotone"
              dataKey="total"
              name="전체"
              stroke="#f59e0b"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={<CustomDot />}
              activeDot={{ r: 6, fill: '#f59e0b', stroke: '#fff', strokeWidth: 2 }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
      
      {/* 마커 범례 - 제목 (날짜) 형식으로 표시 */}
      {markers.length > 0 && (
        <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-dashboard-border">
          {markers.map((marker, index) => {
            // 표시용 날짜 (2/16 형식, 없으면 그래프용 날짜 사용)
            const startDateDisplay = marker.displayDate || marker.date
            const endDateDisplay = marker.displayEndDate || marker.endDate
            // 날짜 형식: M/D~M/D
            const dateRange = endDateDisplay && endDateDisplay !== startDateDisplay 
              ? `${startDateDisplay}~${endDateDisplay}` 
              : startDateDisplay
            // 표시 형식: 제목 (날짜)
            const displayText = marker.title 
              ? `${marker.title} (${dateRange})`
              : `${TYPE_NAMES[marker.type] || '마케팅'} (${dateRange})`
            
            return (
              <div 
                key={index} 
                className="group relative flex items-center gap-1 px-3 py-1.5 rounded-full text-xs cursor-pointer transition-all hover:ring-2 hover:ring-maze-500/50"
                style={{ 
                  backgroundColor: `${TYPE_COLORS[marker.type]}20`,
                  color: TYPE_COLORS[marker.type] 
                }}
              >
                <span>{TYPE_ICONS[marker.type] || '📌'}</span>
                <span className="font-medium">{displayText}</span>
                
                {/* 호버 시 상세 정보 툴팁 */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50">
                  <div className="bg-dashboard-card border border-dashboard-border rounded-lg p-3 shadow-xl min-w-[180px] whitespace-nowrap">
                    <p className="text-xs text-dashboard-muted mb-1">
                      {TYPE_NAMES[marker.type] || '마케팅'}
                    </p>
                    <p className="text-sm font-semibold text-dashboard-text mb-2">
                      {marker.title || '-'}
                    </p>
                    <p className="text-xs text-dashboard-muted mb-2">
                      {dateRange}
                    </p>
                    {marker.impressions !== undefined && marker.impressions > 0 && (
                      <div className="grid grid-cols-3 gap-2 text-center border-t border-dashboard-border pt-2">
                        <div>
                          <p className="text-[9px] text-dashboard-muted">노출</p>
                          <p className="text-xs font-bold">{formatNumber(marker.impressions)}</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-dashboard-muted">클릭</p>
                          <p className="text-xs font-bold">{formatNumber(marker.clicks || 0)}</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-dashboard-muted">CTR</p>
                          <p className="text-xs font-bold text-maze-500">{marker.clickRate}%</p>
                        </div>
                      </div>
                    )}
                  </div>
                  {/* 툴팁 화살표 */}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-dashboard-card" />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
