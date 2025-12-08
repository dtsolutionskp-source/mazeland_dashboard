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
  date: string
  type: string
  title: string
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
}

const TYPE_COLORS: Record<string, string> = {
  CAMPAIGN: '#3b82f6',
  WEATHER: '#f59e0b',
  EVENT: '#8b5cf6',
  MAINTENANCE: '#f97316',
  OTHER: '#6b7280',
}

const TYPE_ICONS: Record<string, string> = {
  CAMPAIGN: '📢',
  WEATHER: '🌤️',
  EVENT: '🎉',
  MAINTENANCE: '🔧',
  OTHER: '📌',
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
}: SalesChartProps) {
  // Store에서 상태 가져오기 (prop이 없으면 store 값 사용)
  const store = useDashboardStore()
  
  const showTotal = propShowTotal ?? store.showTotal
  const showOnline = propShowOnline ?? store.showOnline
  const showOffline = propShowOffline ?? store.showOffline
  const showPrevMonth = propShowPrevMonth ?? store.showPrevMonthLine

  // 전월 데이터를 현재 데이터에 병합 (날짜 기준 매핑)
  const mergedData = data.map((item, index) => {
    const prevItem = prevData?.[index]
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
              <div className="flex items-center gap-2">
                <span className="text-lg">{TYPE_ICONS[marker.type] || '📌'}</span>
                <div>
                  <p className="text-xs text-dashboard-muted">마케팅 이벤트</p>
                  <p className="text-sm font-medium" style={{ color: TYPE_COLORS[marker.type] }}>
                    {marker.title}
                  </p>
                </div>
              </div>
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
            tick={{ fill: '#94a3b8', fontSize: 12, cursor: onDataClick ? 'pointer' : 'default' }}
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
          
          {/* 전월 라인 (연한 회색, 점선) */}
          {showPrevMonth && prevData && (
            <>
              {showOnline && (
                <Line
                  type="monotone"
                  dataKey="prevOnline"
                  name="인터넷(전월)"
                  stroke="#22c55e"
                  strokeWidth={1.5}
                  strokeDasharray="3 3"
                  strokeOpacity={0.3}
                  dot={false}
                  activeDot={false}
                />
              )}
              {showOffline && (
                <Line
                  type="monotone"
                  dataKey="prevOffline"
                  name="현장(전월)"
                  stroke="#3b82f6"
                  strokeWidth={1.5}
                  strokeDasharray="3 3"
                  strokeOpacity={0.3}
                  dot={false}
                  activeDot={false}
                />
              )}
              {showTotal && (
                <Line
                  type="monotone"
                  dataKey="prevTotal"
                  name="전체(전월)"
                  stroke="#f59e0b"
                  strokeWidth={1.5}
                  strokeDasharray="3 3"
                  strokeOpacity={0.3}
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
      
      {/* 마커 범례 */}
      {markers.length > 0 && (
        <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-dashboard-border">
          <span className="text-sm text-dashboard-muted">마케팅 이벤트:</span>
          {markers.map((marker, index) => (
            <div key={index} className="flex items-center gap-2">
              <span>{TYPE_ICONS[marker.type] || '📌'}</span>
              <span className="text-sm" style={{ color: TYPE_COLORS[marker.type] }}>
                {marker.date} - {marker.title}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
