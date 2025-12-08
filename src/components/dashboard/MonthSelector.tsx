'use client'

import { useState, useRef, useEffect } from 'react'
import { useDashboardStore } from '@/stores/dashboard-store'
import { cn } from '@/lib/utils'
import { ChevronDown, Calendar } from 'lucide-react'

interface MonthSelectorProps {
  className?: string
}

export function MonthSelector({ className }: MonthSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  
  const { year, month, setYearMonth } = useDashboardStore()

  // 외부 클릭 시 닫기
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const years = [2025, 2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034, 2035]
  const months = Array.from({ length: 12 }, (_, i) => i + 1)

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedYear = parseInt(e.target.value)
    setYearMonth(selectedYear, month)
  }

  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedMonth = parseInt(e.target.value)
    setYearMonth(year, selectedMonth)
    setIsOpen(false)
  }

  return (
    <div ref={dropdownRef} className={cn('relative', className)}>
      {/* 트리거 버튼 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-dashboard-card border border-dashboard-border rounded-xl hover:border-maze-500/50 transition-all cursor-pointer"
      >
        <Calendar className="w-5 h-5 text-maze-500" />
        <span className="text-xl font-bold text-dashboard-text">
          {year}년 {month}월
        </span>
        <ChevronDown className={cn(
          'w-5 h-5 text-dashboard-muted transition-transform',
          isOpen && 'rotate-180'
        )} />
      </button>

      {/* 드롭다운 패널 */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 bg-dashboard-card border border-dashboard-border rounded-xl shadow-2xl z-50 min-w-[280px] overflow-hidden animate-fade-in">
          {/* 연도/월 드롭박스 */}
          <div className="p-4 space-y-4">
            {/* 연도 선택 드롭박스 */}
            <div>
              <label className="text-xs text-dashboard-muted mb-2 block">연도 선택</label>
              <select
                value={year}
                onChange={handleYearChange}
                className="w-full px-4 py-3 bg-dashboard-bg border border-dashboard-border rounded-lg text-dashboard-text font-medium focus:outline-none focus:ring-2 focus:ring-maze-500 focus:border-transparent cursor-pointer appearance-none"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                  backgroundPosition: 'right 0.75rem center',
                  backgroundRepeat: 'no-repeat',
                  backgroundSize: '1.5em 1.5em',
                }}
              >
                {years.map(y => (
                  <option key={y} value={y}>{y}년</option>
                ))}
              </select>
            </div>

            {/* 월 선택 드롭박스 */}
            <div>
              <label className="text-xs text-dashboard-muted mb-2 block">월 선택</label>
              <select
                value={month}
                onChange={handleMonthChange}
                className="w-full px-4 py-3 bg-dashboard-bg border border-dashboard-border rounded-lg text-dashboard-text font-medium focus:outline-none focus:ring-2 focus:ring-maze-500 focus:border-transparent cursor-pointer appearance-none"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                  backgroundPosition: 'right 0.75rem center',
                  backgroundRepeat: 'no-repeat',
                  backgroundSize: '1.5em 1.5em',
                }}
              >
                {months.map(m => (
                  <option key={m} value={m}>{m}월</option>
                ))}
              </select>
            </div>
          </div>

          {/* 빠른 선택 */}
          <div className="p-3 border-t border-dashboard-border bg-dashboard-bg/50">
            <p className="text-xs text-dashboard-muted mb-2">빠른 선택</p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setYearMonth(2025, 1)
                  setIsOpen(false)
                }}
                className={cn(
                  'flex-1 py-2 px-3 rounded-lg text-xs transition-all',
                  year === 2025 && month === 1
                    ? 'bg-maze-500 text-white'
                    : 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
                )}
              >
                2025년 1월
              </button>
              <button
                onClick={() => {
                  const now = new Date()
                  setYearMonth(now.getFullYear(), now.getMonth() + 1)
                  setIsOpen(false)
                }}
                className={cn(
                  'flex-1 py-2 px-3 rounded-lg text-xs transition-all',
                  'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30'
                )}
              >
                이번 달
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
