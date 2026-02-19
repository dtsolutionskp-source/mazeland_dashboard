'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Header } from '@/components/dashboard/Header'
import { Card, CardHeader, Button, Input, Select } from '@/components/ui'
import { formatDate, formatNumber } from '@/lib/utils'
import { cn } from '@/lib/utils'
import {
  Plus,
  Calendar,
  Trash2,
  Edit,
  X,
  Eye,
  MousePointer,
  Percent,
  Megaphone,
  TrendingUp,
  FileText,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

interface MarketingLog {
  id: string
  logType: 'CAMPAIGN' | 'PERFORMANCE' | 'HOLIDAY'
  startDate: string
  endDate: string
  // 캠페인용
  title?: string
  content?: string
  // 퍼포먼스용
  subType?: string
  impressions: number
  clicks: number
  createdBy?: {
    name: string
    email: string
  }
  createdAt: string
}

const LOG_TYPES = [
  { value: 'CAMPAIGN', label: '캠페인', icon: Megaphone, color: 'text-blue-500 bg-blue-500/20' },
  { value: 'PERFORMANCE', label: '퍼포먼스', icon: TrendingUp, color: 'text-orange-500 bg-orange-500/20' },
  { value: 'HOLIDAY', label: '연휴', icon: Calendar, color: 'text-red-500 bg-red-500/20' },
]

const MONTHS = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월']
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

function calculateClickRate(clicks: number, impressions: number): string {
  if (impressions === 0) return '0.00'
  return ((clicks / impressions) * 100).toFixed(2)
}

export default function MarketingLogPage() {
  const [logs, setLogs] = useState<MarketingLog[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isFetching, setIsFetching] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingLog, setEditingLog] = useState<MarketingLog | null>(null)
  const [filter, setFilter] = useState('ALL')
  const [error, setError] = useState<string | null>(null)
  
  // 월별 필터 (캘린더와 연동)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  
  // 폼 상태
  const [formData, setFormData] = useState({
    logType: 'CAMPAIGN' as 'CAMPAIGN' | 'PERFORMANCE' | 'HOLIDAY',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    title: '',
    content: '',
    subType: '',
    impressions: 0,
    clicks: 0,
  })

  // 로그 목록 조회
  const fetchLogs = useCallback(async () => {
    setIsFetching(true)
    setError(null)
    try {
      const response = await fetch('/api/marketing-log')
      if (!response.ok) throw new Error('로그 조회 실패')
      const data = await response.json()
      setLogs(data.logs || [])
    } catch (err) {
      console.error('Fetch logs error:', err)
      setError('마케팅 로그를 불러오는데 실패했습니다.')
    } finally {
      setIsFetching(false)
    }
  }, [])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    
    try {
      const url = editingLog ? `/api/marketing-log/${editingLog.id}` : '/api/marketing-log'
      const method = editingLog ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '저장 실패')
      }
      
      await fetchLogs() // 목록 새로고침
      setShowModal(false)
      setEditingLog(null)
      resetForm()
    } catch (err: any) {
      console.error('Submit error:', err)
      setError(err.message || '저장 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      logType: 'CAMPAIGN',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
      title: '',
      content: '',
      subType: '',
      impressions: 0,
      clicks: 0,
    })
  }

  const handleEdit = (log: MarketingLog) => {
    setEditingLog(log)
    setFormData({
      logType: log.logType,
      startDate: log.startDate?.split('T')[0] || '',
      endDate: log.endDate?.split('T')[0] || '',
      title: log.title || '',
      content: log.content || '',
      subType: log.subType || '',
      impressions: log.impressions || 0,
      clicks: log.clicks || 0,
    })
    setShowModal(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return
    
    setError(null)
    try {
      const response = await fetch(`/api/marketing-log/${id}`, {
        method: 'DELETE',
      })
      
      if (!response.ok) {
        throw new Error('삭제 실패')
      }
      
      await fetchLogs() // 목록 새로고침
    } catch (err) {
      console.error('Delete error:', err)
      setError('삭제 중 오류가 발생했습니다.')
    }
  }

  // 월별 필터링
  const filteredLogs = useMemo(() => {
    let result = logs
    
    // 월별 필터
    result = result.filter(log => {
      const logStart = new Date(log.startDate)
      const logEnd = new Date(log.endDate)
      const filterStart = new Date(selectedYear, selectedMonth - 1, 1)
      const filterEnd = new Date(selectedYear, selectedMonth, 0) // 해당 월의 마지막 날
      
      // 기간이 겹치는지 확인
      return logStart <= filterEnd && logEnd >= filterStart
    })
    
    // 유형 필터
    if (filter !== 'ALL') {
      result = result.filter(l => l.logType === filter)
    }
    
    return result
  }, [logs, selectedYear, selectedMonth, filter])
  
  // 사용 가능한 연도 목록 (현재 연도 기준 ±2년 + 로그에 있는 연도)
  const availableYears = useMemo(() => {
    const years = new Set<number>()
    const currentYear = new Date().getFullYear()
    
    // 현재 연도 기준 ±2년 추가
    for (let y = currentYear - 2; y <= currentYear + 1; y++) {
      years.add(y)
    }
    
    // 로그에 있는 연도도 추가
    logs.forEach(log => {
      const startYear = new Date(log.startDate).getFullYear()
      const endYear = new Date(log.endDate).getFullYear()
      years.add(startYear)
      years.add(endYear)
    })
    
    return Array.from(years).sort((a, b) => b - a)
  }, [logs])

  const getLogTypeInfo = (type: string) => {
    return LOG_TYPES.find(t => t.value === type) || LOG_TYPES[0]
  }
  
  // 캘린더 데이터 (selectedYear, selectedMonth와 연동)
  const calendarData = useMemo(() => {
    const year = selectedYear
    const month = selectedMonth
    const firstDay = new Date(year, month - 1, 1)
    const lastDay = new Date(year, month, 0)
    const daysInMonth = lastDay.getDate()
    const startWeekday = firstDay.getDay()
    
    // 해당 월의 로그들
    const monthLogs = logs.filter(log => {
      const logStart = new Date(log.startDate)
      const logEnd = new Date(log.endDate)
      const filterStart = new Date(year, month - 1, 1)
      const filterEnd = lastDay
      return logStart <= filterEnd && logEnd >= filterStart
    })
    
    // 일정 띠 데이터 생성 (각 로그별 시작일~종료일 범위)
    interface EventBar {
      log: MarketingLog
      startDay: number
      endDay: number
      row: number
    }
    
    const eventBars: EventBar[] = []
    const rowOccupancy: Map<number, number[]>[] = [] // 각 날짜별 행 점유 상태
    
    for (let d = 0; d <= daysInMonth; d++) {
      rowOccupancy.push(new Map())
    }
    
    monthLogs.forEach(log => {
      const logStart = new Date(log.startDate)
      const logEnd = new Date(log.endDate)
      
      // 해당 월 내에서의 시작/종료일 계산
      let startDay = logStart.getFullYear() === year && logStart.getMonth() === month - 1
        ? logStart.getDate()
        : 1
      let endDay = logEnd.getFullYear() === year && logEnd.getMonth() === month - 1
        ? logEnd.getDate()
        : daysInMonth
      
      // 빈 행 찾기
      let row = 0
      let found = false
      while (!found) {
        let canPlace = true
        for (let d = startDay; d <= endDay; d++) {
          const dayRows = rowOccupancy[d]?.get(row) || []
          if (dayRows.length > 0) {
            canPlace = false
            break
          }
        }
        if (canPlace) {
          found = true
        } else {
          row++
        }
        if (row > 10) break // 최대 10행
      }
      
      // 점유 표시
      for (let d = startDay; d <= endDay; d++) {
        if (!rowOccupancy[d]) rowOccupancy[d] = new Map()
        rowOccupancy[d].set(row, [...(rowOccupancy[d].get(row) || []), 1])
      }
      
      eventBars.push({ log, startDay, endDay, row })
    })
    
    return { daysInMonth, startWeekday, eventBars, monthLogs }
  }, [logs, selectedYear, selectedMonth])
  
  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12)
      setSelectedYear(selectedYear - 1)
    } else {
      setSelectedMonth(selectedMonth - 1)
    }
  }
  
  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1)
      setSelectedYear(selectedYear + 1)
    } else {
      setSelectedMonth(selectedMonth + 1)
    }
  }

  // 선택한 월의 통계 (filteredLogs 기준)
  const monthlyStats = useMemo(() => {
    const campaigns = filteredLogs.filter(l => l.logType === 'CAMPAIGN')
    const performances = filteredLogs.filter(l => l.logType === 'PERFORMANCE')
    const holidays = filteredLogs.filter(l => l.logType === 'HOLIDAY')
    
    const totalImpressions = performances.reduce((sum, log) => sum + (log.impressions || 0), 0)
    const totalClicks = performances.reduce((sum, log) => sum + (log.clicks || 0), 0)
    
    return {
      campaignCount: campaigns.length,
      performanceCount: performances.length,
      holidayCount: holidays.length,
      impressions: totalImpressions,
      clicks: totalClicks,
    }
  }, [filteredLogs])

  return (
    <div className="min-h-screen">
      <Header
        title="마케팅 로그"
        description="캠페인과 퍼포먼스 광고 기록을 관리합니다"
      />
      
      <div className="p-8 space-y-6">
        {/* 에러 메시지 */}
        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-500 text-sm">
            {error}
          </div>
        )}

        {/* 월별 통계 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-blue-500/20">
                <Megaphone className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-dashboard-muted">{selectedMonth}월 캠페인</p>
                <p className="text-2xl font-bold text-dashboard-text">
                  {monthlyStats.campaignCount}건
                </p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-green-500/20">
                <Eye className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-dashboard-muted">{selectedMonth}월 노출량</p>
                <p className="text-2xl font-bold text-dashboard-text">
                  {formatNumber(monthlyStats.impressions)}
                </p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-orange-500/20">
                <MousePointer className="w-6 h-6 text-orange-500" />
              </div>
              <div>
                <p className="text-sm text-dashboard-muted">{selectedMonth}월 클릭수</p>
                <p className="text-2xl font-bold text-dashboard-text">
                  {formatNumber(monthlyStats.clicks)}
                </p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-purple-500/20">
                <Percent className="w-6 h-6 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-dashboard-muted">{selectedMonth}월 클릭율</p>
                <p className="text-2xl font-bold text-dashboard-text">
                  {calculateClickRate(monthlyStats.clicks, monthlyStats.impressions)}%
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* 월별 필터 및 추가 버튼 */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            {/* 연도 선택 */}
            <Select
              value={selectedYear.toString()}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              options={availableYears.map(y => ({ value: y.toString(), label: `${y}년` }))}
              className="w-28"
            />
            {/* 월 선택 */}
            <div className="flex items-center gap-1">
              {MONTHS.map((m, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedMonth(idx + 1)}
                  className={cn(
                    'px-3 py-2 text-sm rounded-lg transition-all',
                    selectedMonth === idx + 1
                      ? 'bg-emerald-600 text-white font-semibold'
                      : 'bg-dashboard-card text-dashboard-muted hover:bg-dashboard-border hover:text-dashboard-text'
                  )}
                >
                  {idx + 1}월
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* 유형 필터 */}
            <Select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              options={[
                { value: 'ALL', label: '전체 유형' },
                ...LOG_TYPES.map(t => ({ value: t.value, label: t.label })),
              ]}
              className="w-36"
            />
            <Button onClick={() => setShowModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              새 로그 등록
            </Button>
          </div>
        </div>
        
        {/* 선택 월 표시 */}
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-emerald-500" />
          <span className="text-lg font-semibold text-dashboard-text">
            {selectedYear}년 {selectedMonth}월 마케팅 로그
          </span>
          <span className="text-sm text-dashboard-muted">
            ({filteredLogs.length}건)
          </span>
        </div>

        {/* 로그 테이블 */}
        <Card>
          {isFetching ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-maze-500" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-dashboard-border">
                    <th className="text-left py-4 px-4 text-sm font-semibold text-dashboard-muted">유형</th>
                    <th className="text-left py-4 px-4 text-sm font-semibold text-dashboard-muted">기간</th>
                    <th className="text-left py-4 px-4 text-sm font-semibold text-dashboard-muted">내용</th>
                    <th className="text-right py-4 px-4 text-sm font-semibold text-dashboard-muted">노출량</th>
                    <th className="text-right py-4 px-4 text-sm font-semibold text-dashboard-muted">클릭수</th>
                    <th className="text-right py-4 px-4 text-sm font-semibold text-dashboard-muted">클릭율</th>
                    <th className="text-center py-4 px-4 text-sm font-semibold text-dashboard-muted">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12">
                        <p className="text-dashboard-muted">등록된 로그가 없습니다.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log) => {
                      const typeInfo = getLogTypeInfo(log.logType)
                      const TypeIcon = typeInfo.icon
                      const clickRate = calculateClickRate(log.clicks || 0, log.impressions || 0)
                      
                      return (
                        <tr 
                          key={log.id} 
                          className="border-b border-dashboard-border/50 hover:bg-dashboard-border/30 transition-colors"
                        >
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-2">
                              <div className={cn('p-1.5 rounded', typeInfo.color)}>
                                <TypeIcon className="w-4 h-4" />
                              </div>
                              <span className="text-sm text-dashboard-text">{typeInfo.label}</span>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-2 text-sm">
                              <Calendar className="w-4 h-4 text-dashboard-muted" />
                              <span className="text-dashboard-text">
                                {formatDate(log.startDate)} ~ {formatDate(log.endDate)}
                              </span>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            {log.logType === 'CAMPAIGN' ? (
                              <div>
                                <p className="text-sm font-medium text-dashboard-text">{log.title || '-'}</p>
                                <p className="text-xs text-dashboard-muted line-clamp-1">{log.content || ''}</p>
                              </div>
                            ) : log.logType === 'HOLIDAY' ? (
                              <span className="text-sm font-medium text-red-500">{log.title || '연휴'}</span>
                            ) : (
                              <span className="text-sm text-dashboard-text">{log.subType || '-'}</span>
                            )}
                          </td>
                          <td className="py-4 px-4 text-right">
                            {log.logType === 'PERFORMANCE' ? (
                              <span className="text-sm font-medium text-dashboard-text">
                                {formatNumber(log.impressions || 0)}
                              </span>
                            ) : (
                              <span className="text-sm text-dashboard-muted">-</span>
                            )}
                          </td>
                          <td className="py-4 px-4 text-right">
                            {log.logType === 'PERFORMANCE' ? (
                              <span className="text-sm font-medium text-dashboard-text">
                                {formatNumber(log.clicks || 0)}
                              </span>
                            ) : (
                              <span className="text-sm text-dashboard-muted">-</span>
                            )}
                          </td>
                          <td className="py-4 px-4 text-right">
                            {log.logType === 'PERFORMANCE' ? (
                              <span className={cn(
                                'text-sm font-bold',
                                parseFloat(clickRate) >= 3 ? 'text-green-500' :
                                parseFloat(clickRate) >= 1 ? 'text-blue-500' : 'text-dashboard-muted'
                              )}>
                                {clickRate}%
                              </span>
                            ) : (
                              <span className="text-sm text-dashboard-muted">-</span>
                            )}
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleEdit(log)}
                                className="p-2 text-dashboard-muted hover:text-dashboard-text hover:bg-dashboard-border rounded-lg transition-colors"
                                title="수정"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(log.id)}
                                className="p-2 text-dashboard-muted hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                title="삭제"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        
        {/* 캘린더 (띠 형태) */}
        <Card>
          <div className="p-4 border-b border-dashboard-border">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-dashboard-text flex items-center gap-2">
                <Calendar className="w-5 h-5 text-emerald-500" />
                마케팅 일정 캘린더
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrevMonth}
                  className="p-2 hover:bg-dashboard-border rounded-lg transition-colors"
                >
                  <ChevronLeft className="w-5 h-5 text-dashboard-muted" />
                </button>
                <span className="text-sm font-medium text-dashboard-text min-w-[100px] text-center">
                  {selectedYear}년 {selectedMonth}월
                </span>
                <button
                  onClick={handleNextMonth}
                  className="p-2 hover:bg-dashboard-border rounded-lg transition-colors"
                >
                  <ChevronRight className="w-5 h-5 text-dashboard-muted" />
                </button>
              </div>
            </div>
          </div>
          
          <div className="p-4 overflow-x-auto">
            {/* 요일 헤더 */}
            <div className="grid grid-cols-7 gap-0 mb-1 min-w-[600px]">
              {WEEKDAYS.map((day, idx) => (
                <div
                  key={day}
                  className={cn(
                    'text-center text-xs font-medium py-2 border-b border-dashboard-border',
                    idx === 0 ? 'text-red-400' : idx === 6 ? 'text-blue-400' : 'text-dashboard-muted'
                  )}
                >
                  {day}
                </div>
              ))}
            </div>
            
            {/* 캘린더 그리드 (주 단위) */}
            {(() => {
              const weeks: number[][] = []
              let currentWeek: number[] = []
              
              // 첫 주 빈칸 채우기
              for (let i = 0; i < calendarData.startWeekday; i++) {
                currentWeek.push(0)
              }
              
              // 날짜 채우기
              for (let day = 1; day <= calendarData.daysInMonth; day++) {
                currentWeek.push(day)
                if (currentWeek.length === 7) {
                  weeks.push(currentWeek)
                  currentWeek = []
                }
              }
              
              // 마지막 주 빈칸 채우기
              if (currentWeek.length > 0) {
                while (currentWeek.length < 7) {
                  currentWeek.push(0)
                }
                weeks.push(currentWeek)
              }
              
              return weeks.map((week, weekIdx) => {
                // 이번 주에 해당하는 이벤트 바 찾기
                const weekStartDay = week.find(d => d > 0) || 1
                const weekEndDay = [...week].reverse().find(d => d > 0) || calendarData.daysInMonth
                
                const weekEvents = calendarData.eventBars.filter(bar => 
                  bar.startDay <= weekEndDay && bar.endDay >= weekStartDay
                )
                
                // 최대 행 수 계산
                const maxRow = Math.max(0, ...weekEvents.map(e => e.row)) + 1
                
                return (
                  <div key={weekIdx} className="min-w-[600px]">
                    {/* 날짜 행 */}
                    <div className="grid grid-cols-7 gap-0">
                      {week.map((day, dayIdx) => {
                        const isToday = day > 0 &&
                          selectedYear === new Date().getFullYear() &&
                          selectedMonth === new Date().getMonth() + 1 &&
                          day === new Date().getDate()
                        
                        return (
                          <div
                            key={dayIdx}
                            className={cn(
                              'h-8 flex items-center justify-center border-b border-r border-dashboard-border/50',
                              dayIdx === 0 && 'border-l',
                              day === 0 && 'bg-dashboard-bg/30'
                            )}
                          >
                            {day > 0 && (
                              <span
                                className={cn(
                                  'text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full',
                                  isToday
                                    ? 'bg-emerald-500 text-white'
                                    : dayIdx === 0
                                      ? 'text-red-400'
                                      : dayIdx === 6
                                        ? 'text-blue-400'
                                        : 'text-dashboard-text'
                                )}
                              >
                                {day}
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                    
                    {/* 이벤트 띠 영역 */}
                    <div 
                      className="relative grid grid-cols-7 gap-0 border-b border-dashboard-border/30"
                      style={{ minHeight: maxRow > 0 ? `${maxRow * 24 + 8}px` : '32px' }}
                    >
                      {/* 배경 그리드 */}
                      {week.map((day, dayIdx) => (
                        <div
                          key={dayIdx}
                          className={cn(
                            'border-r border-dashboard-border/30',
                            dayIdx === 0 && 'border-l',
                            day === 0 && 'bg-dashboard-bg/30'
                          )}
                        />
                      ))}
                      
                      {/* 이벤트 바 */}
                      {weekEvents.map((bar, barIdx) => {
                        // 이번 주에서의 시작/끝 위치 계산
                        const weekStartPos = week.findIndex(d => d > 0 && d >= bar.startDay)
                        const weekEndPos = week.findLastIndex(d => d > 0 && d <= bar.endDay)
                        
                        if (weekStartPos === -1 || weekEndPos === -1) return null
                        
                        const isStart = bar.startDay >= weekStartDay
                        const isEnd = bar.endDay <= weekEndDay
                        
                        const barColor = bar.log.logType === 'CAMPAIGN' 
                          ? 'bg-blue-500' 
                          : bar.log.logType === 'HOLIDAY'
                          ? 'bg-red-500'
                          : 'bg-orange-500'
                        
                        const barLabel = bar.log.logType === 'CAMPAIGN'
                          ? bar.log.title || '캠페인'
                          : bar.log.logType === 'HOLIDAY'
                          ? bar.log.title || '연휴'
                          : bar.log.subType || '퍼포먼스'
                        
                        return (
                          <div
                            key={barIdx}
                            className={cn(
                              'absolute h-5 flex items-center px-1 text-[10px] text-white font-medium overflow-hidden whitespace-nowrap',
                              barColor,
                              isStart ? 'rounded-l-md ml-0.5' : '',
                              isEnd ? 'rounded-r-md mr-0.5' : ''
                            )}
                            style={{
                              left: `calc(${(weekStartPos / 7) * 100}% + 2px)`,
                              right: `calc(${((6 - weekEndPos) / 7) * 100}% + 2px)`,
                              top: `${bar.row * 24 + 4}px`,
                            }}
                            title={`${barLabel} (${formatDate(bar.log.startDate)} ~ ${formatDate(bar.log.endDate)})`}
                          >
                            {isStart && barLabel}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })
            })()}
            
            {/* 범례 */}
            <div className="mt-4 pt-4 border-t border-dashboard-border flex items-center gap-6">
              <div className="flex items-center gap-2 text-xs text-dashboard-muted">
                <div className="w-8 h-4 rounded bg-blue-500" />
                <span>캠페인</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-dashboard-muted">
                <div className="w-8 h-4 rounded bg-green-500" />
                <span>퍼포먼스</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-dashboard-muted">
                <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-[10px] text-white font-bold">1</div>
                <span>오늘</span>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* 등록/수정 모달 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-dashboard-card border border-dashboard-border rounded-2xl w-full max-w-lg animate-slide-up">
            <div className="flex items-center justify-between p-6 border-b border-dashboard-border">
              <h2 className="text-xl font-semibold text-dashboard-text">
                {editingLog ? '로그 수정' : '새 로그 등록'}
              </h2>
              <button
                onClick={() => {
                  setShowModal(false)
                  setEditingLog(null)
                  resetForm()
                }}
                className="p-2 text-dashboard-muted hover:text-dashboard-text hover:bg-dashboard-border rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* 유형 선택 */}
              <Select
                label="유형"
                value={formData.logType}
                onChange={(e) => setFormData({ ...formData, logType: e.target.value as any })}
                options={LOG_TYPES.map(t => ({ value: t.value, label: t.label }))}
              />
              
              {/* 기간 */}
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="시작일"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  required
                />
                <Input
                  label="종료일"
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  required
                />
              </div>
              
              {/* 연휴용 필드 */}
              {formData.logType === 'HOLIDAY' && (
                <Input
                  label="연휴명"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="예: 설 연휴, 추석 연휴"
                  required
                />
              )}
              
              {/* 캠페인용 필드 */}
              {formData.logType === 'CAMPAIGN' && (
                <>
                  <Input
                    label="제목"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="캠페인 제목을 입력하세요"
                    required
                  />
                  <div>
                    <label className="block text-sm font-medium text-dashboard-text mb-2">내용</label>
                    <textarea
                      value={formData.content}
                      onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                      placeholder="캠페인 내용을 입력하세요"
                      rows={4}
                      className="w-full px-4 py-3 bg-dashboard-bg border border-dashboard-border rounded-lg text-dashboard-text placeholder:text-dashboard-muted focus:outline-none focus:ring-2 focus:ring-maze-500 focus:border-transparent transition-all resize-none"
                      required
                    />
                  </div>
                </>
              )}
              
              {/* 퍼포먼스용 필드 */}
              {formData.logType === 'PERFORMANCE' && (
                <>
                  <Input
                    label="세부 유형"
                    value={formData.subType}
                    onChange={(e) => setFormData({ ...formData, subType: e.target.value })}
                    placeholder="예: OK캐쉬백 푸쉬광고"
                    required
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="노출량"
                      type="number"
                      value={formData.impressions}
                      onChange={(e) => setFormData({ ...formData, impressions: parseInt(e.target.value) || 0 })}
                      min={0}
                      required
                    />
                    <Input
                      label="클릭수"
                      type="number"
                      value={formData.clicks}
                      onChange={(e) => setFormData({ ...formData, clicks: parseInt(e.target.value) || 0 })}
                      min={0}
                      required
                    />
                  </div>
                  
                  {/* 클릭율 미리보기 */}
                  <div className="p-4 bg-dashboard-bg rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-dashboard-muted">클릭율 (자동 계산)</span>
                      <span className="text-lg font-bold text-maze-500">
                        {calculateClickRate(formData.clicks, formData.impressions)}%
                      </span>
                    </div>
                  </div>
                </>
              )}
              
              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setShowModal(false)
                    setEditingLog(null)
                    resetForm()
                  }}
                >
                  취소
                </Button>
                <Button type="submit" isLoading={isLoading}>
                  {editingLog ? '수정' : '등록'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
