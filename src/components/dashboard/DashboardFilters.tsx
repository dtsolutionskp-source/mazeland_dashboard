'use client'

import { useDashboardStore } from '@/stores/dashboard-store'
import { cn } from '@/lib/utils'
import { Calendar, ChevronDown, BarChart2, TrendingUp, Eye, EyeOff } from 'lucide-react'

interface DashboardFiltersProps {
  className?: string
}

export function DashboardFilters({ className }: DashboardFiltersProps) {
  const {
    year,
    month,
    viewMode,
    showPrevMonthLine,
    showOnline,
    showOffline,
    showTotal,
    availableMonths,
    setYearMonth,
    setViewMode,
    togglePrevMonthLine,
    toggleSeriesVisibility,
  } = useDashboardStore()

  // 사용 가능한 연도 목록 추출
  const availableYears = [...new Set(availableMonths.map(m => m.year))].sort((a, b) => b - a)
  
  // 선택된 연도의 월 목록
  const monthsForYear = availableMonths
    .filter(m => m.year === year)
    .map(m => m.month)
    .sort((a, b) => b - a)

  // 연도 변경 시 해당 연도의 최신 월로 자동 설정
  const handleYearChange = (newYear: number) => {
    const monthsInYear = availableMonths
      .filter(m => m.year === newYear)
      .map(m => m.month)
    const latestMonth = Math.max(...monthsInYear, 1)
    setYearMonth(newYear, latestMonth)
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-4', className)}>
      {/* 연도 선택 */}
      <div className="flex items-center gap-2">
        <Calendar className="w-4 h-4 text-dashboard-muted" />
        <div className="relative">
          <select
            value={year}
            onChange={(e) => {
              const newYear = Number(e.target.value)
              console.log('[Filter] Year changed to:', newYear)
              setYearMonth(newYear, month)
            }}
            className="appearance-none bg-dashboard-card border border-dashboard-border rounded-lg px-4 py-2 pr-8 text-dashboard-text focus:outline-none focus:ring-2 focus:ring-maze-500/50 cursor-pointer"
          >
            {/* 2025~2035년 표시 */}
            {[2025, 2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034, 2035].map(y => (
              <option key={y} value={y}>{y}년</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-dashboard-muted pointer-events-none" />
        </div>
      </div>

      {/* 월 선택 */}
      <div className="relative">
        <select
          value={month}
          onChange={(e) => {
            const newMonth = Number(e.target.value)
            console.log('[Filter] Month changed to:', newMonth)
            setYearMonth(year, newMonth)
          }}
          className="appearance-none bg-dashboard-card border border-dashboard-border rounded-lg px-4 py-2 pr-8 text-dashboard-text focus:outline-none focus:ring-2 focus:ring-maze-500/50 cursor-pointer"
        >
          {/* 항상 1-12월 표시 */}
          {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
            <option key={m} value={m}>{m}월</option>
          ))}
        </select>
        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-dashboard-muted pointer-events-none" />
      </div>

      {/* 구분선 */}
      <div className="h-8 w-px bg-dashboard-border hidden sm:block" />

      {/* 뷰 모드 토글 */}
      <div className="flex items-center bg-dashboard-card border border-dashboard-border rounded-lg p-1">
        <button
          onClick={() => setViewMode('single')}
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-all',
            viewMode === 'single'
              ? 'bg-maze-500 text-white'
              : 'text-dashboard-muted hover:text-dashboard-text'
          )}
        >
          <BarChart2 className="w-4 h-4" />
          <span className="hidden sm:inline">해당 월</span>
        </button>
        <button
          onClick={() => setViewMode('cumulative')}
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-all',
            viewMode === 'cumulative'
              ? 'bg-maze-500 text-white'
              : 'text-dashboard-muted hover:text-dashboard-text'
          )}
        >
          <TrendingUp className="w-4 h-4" />
          <span className="hidden sm:inline">누적</span>
        </button>
      </div>

      {/* 구분선 */}
      <div className="h-8 w-px bg-dashboard-border hidden md:block" />

      {/* 전월 추세 보기 옵션 */}
      <button
        onClick={togglePrevMonthLine}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all',
          showPrevMonthLine
            ? 'bg-blue-500/20 border-blue-500/50 text-blue-400'
            : 'bg-dashboard-card border-dashboard-border text-dashboard-muted hover:text-dashboard-text'
        )}
      >
        {showPrevMonthLine ? (
          <Eye className="w-4 h-4" />
        ) : (
          <EyeOff className="w-4 h-4" />
        )}
        <span className="hidden sm:inline">전월 비교</span>
      </button>

      {/* 그래프 시리즈 토글 */}
      <div className="flex items-center gap-1 bg-dashboard-card border border-dashboard-border rounded-lg p-1">
        <button
          onClick={() => toggleSeriesVisibility('total')}
          className={cn(
            'px-2 py-1 rounded text-xs font-medium transition-all',
            showTotal
              ? 'bg-dashboard-text text-dashboard-bg'
              : 'text-dashboard-muted hover:text-dashboard-text'
          )}
        >
          전체
        </button>
        <button
          onClick={() => toggleSeriesVisibility('online')}
          className={cn(
            'px-2 py-1 rounded text-xs font-medium transition-all',
            showOnline
              ? 'bg-maze-500 text-white'
              : 'text-dashboard-muted hover:text-dashboard-text'
          )}
        >
          인터넷
        </button>
        <button
          onClick={() => toggleSeriesVisibility('offline')}
          className={cn(
            'px-2 py-1 rounded text-xs font-medium transition-all',
            showOffline
              ? 'bg-blue-500 text-white'
              : 'text-dashboard-muted hover:text-dashboard-text'
          )}
        >
          현장
        </button>
      </div>
    </div>
  )
}

