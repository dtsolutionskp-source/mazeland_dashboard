'use client'

import { useState, useRef, useEffect } from 'react'
import { Bell, Search, Calendar, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDashboardStore } from '@/stores/dashboard-store'

interface HeaderProps {
  title: string
  description?: string
}

export function Header({ title, description }: HeaderProps) {
  const [showNotifications, setShowNotifications] = useState(false)
  const [showMonthPicker, setShowMonthPicker] = useState(false)
  const monthPickerRef = useRef<HTMLDivElement>(null)
  
  const { year, month, setYearMonth } = useDashboardStore()

  // 외부 클릭 시 닫기
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (monthPickerRef.current && !monthPickerRef.current.contains(event.target as Node)) {
        setShowMonthPicker(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const years = [2025, 2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034, 2035]
  const months = Array.from({ length: 12 }, (_, i) => i + 1)

  const handleSelect = (selectedYear: number, selectedMonth: number) => {
    setYearMonth(selectedYear, selectedMonth)
    setShowMonthPicker(false)
  }

  return (
    <header className="sticky top-0 z-40 bg-dashboard-bg/80 backdrop-blur-xl border-b border-dashboard-border">
      <div className="flex items-center justify-between px-8 py-4">
        {/* Title */}
        <div>
          <h1 className="text-2xl font-bold text-dashboard-text">{title}</h1>
          {description && (
            <p className="text-sm text-dashboard-muted mt-1">{description}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dashboard-muted" />
            <input
              type="text"
              placeholder="검색..."
              className="w-64 pl-10 pr-4 py-2 rounded-lg bg-dashboard-card border border-dashboard-border text-sm text-dashboard-text placeholder-dashboard-muted focus:outline-none focus:ring-2 focus:ring-maze-500 focus:border-transparent transition-all"
            />
          </div>

          {/* Date Range - 클릭 가능한 드롭다운 */}
          <div ref={monthPickerRef} className="relative">
            <button 
              onClick={() => setShowMonthPicker(!showMonthPicker)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-dashboard-card border border-dashboard-border text-sm text-dashboard-text hover:border-maze-500/50 transition-all cursor-pointer"
            >
              <Calendar className="w-4 h-4 text-maze-500" />
              <span className="font-medium">{year}년 {month}월</span>
              <ChevronDown className={cn(
                'w-4 h-4 text-dashboard-muted transition-transform',
                showMonthPicker && 'rotate-180'
              )} />
            </button>

            {/* 월 선택 드롭다운 */}
            {showMonthPicker && (
              <div className="absolute right-0 top-full mt-2 bg-dashboard-card border border-dashboard-border rounded-xl shadow-2xl z-50 min-w-[280px] overflow-hidden animate-slide-up">
                {/* 연도 선택 - 드롭박스 */}
                <div className="p-3 border-b border-dashboard-border">
                  <p className="text-xs text-dashboard-muted mb-2">연도 선택</p>
                  <select
                    value={year}
                    onChange={(e) => setYearMonth(Number(e.target.value), month)}
                    className="w-full px-3 py-2 bg-dashboard-bg border border-dashboard-border rounded-lg text-dashboard-text text-sm focus:outline-none focus:ring-2 focus:ring-maze-500"
                  >
                    {years.map(y => (
                      <option key={y} value={y}>{y}년</option>
                    ))}
                  </select>
                </div>

                {/* 월 그리드 */}
                <div className="p-3">
                  <p className="text-xs text-dashboard-muted mb-2">월 선택</p>
                  <div className="grid grid-cols-4 gap-2">
                    {months.map(m => (
                      <button
                        key={m}
                        onClick={() => handleSelect(year, m)}
                        className={cn(
                          'py-2.5 rounded-lg text-sm font-medium transition-all',
                          month === m
                            ? 'bg-maze-500 text-white'
                            : 'bg-dashboard-bg text-dashboard-muted hover:text-dashboard-text hover:bg-dashboard-border'
                        )}
                      >
                        {m}월
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 rounded-lg bg-dashboard-card border border-dashboard-border text-dashboard-muted hover:text-dashboard-text hover:border-maze-500/50 transition-all"
            >
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-maze-500 rounded-full" />
            </button>

            {/* Notifications Dropdown */}
            {showNotifications && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-dashboard-card border border-dashboard-border rounded-xl shadow-xl overflow-hidden animate-slide-up">
                <div className="p-4 border-b border-dashboard-border">
                  <h3 className="font-semibold text-dashboard-text">알림</h3>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  <div className="p-4 hover:bg-dashboard-border/50 transition-colors cursor-pointer">
                    <p className="text-sm text-dashboard-text">새로운 데이터가 업로드되었습니다.</p>
                    <p className="text-xs text-dashboard-muted mt-1">1시간 전</p>
                  </div>
                  <div className="p-4 hover:bg-dashboard-border/50 transition-colors cursor-pointer">
                    <p className="text-sm text-dashboard-text">{month}월 정산이 완료되었습니다.</p>
                    <p className="text-xs text-dashboard-muted mt-1">3시간 전</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
