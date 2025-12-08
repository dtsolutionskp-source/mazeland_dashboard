/**
 * 대시보드 상태 관리 (Zustand)
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { ViewMode } from '@/types/dashboard'

interface DashboardState {
  // 선택된 연/월
  year: number
  month: number
  
  // 뷰 모드 (단월 / 누적)
  viewMode: ViewMode
  
  // 전월 라인 표시 여부
  showPrevMonthLine: boolean
  
  // 그래프 시리즈 표시 옵션
  showOnline: boolean
  showOffline: boolean
  showTotal: boolean
  
  // 사용 가능한 월 목록
  availableMonths: { year: number; month: number }[]
  
  // Actions
  setYear: (year: number) => void
  setMonth: (month: number) => void
  setYearMonth: (year: number, month: number) => void
  setViewMode: (mode: ViewMode) => void
  togglePrevMonthLine: () => void
  toggleSeriesVisibility: (series: 'online' | 'offline' | 'total') => void
  setAvailableMonths: (months: { year: number; month: number }[]) => void
  
  // 헬퍼
  getPrevMonth: () => { year: number; month: number } | null
}

// 기본값: 현재 날짜 기준
const now = new Date()
const defaultYear = now.getFullYear()
const defaultMonth = now.getMonth() + 1

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set, get) => ({
      // 초기값
      year: defaultYear,
      month: defaultMonth,
      viewMode: 'single',
      showPrevMonthLine: false,
      showOnline: true,
      showOffline: true,
      showTotal: true,
      availableMonths: [],

      // Actions
      setYear: (year) => set({ year }),
      setMonth: (month) => set({ month }),
      setYearMonth: (year, month) => set({ year, month }),
      
      setViewMode: (viewMode) => set({ viewMode }),
      
      togglePrevMonthLine: () => set((state) => ({ 
        showPrevMonthLine: !state.showPrevMonthLine 
      })),
      
      toggleSeriesVisibility: (series) => set((state) => {
        switch (series) {
          case 'online':
            return { showOnline: !state.showOnline }
          case 'offline':
            return { showOffline: !state.showOffline }
          case 'total':
            return { showTotal: !state.showTotal }
          default:
            return {}
        }
      }),
      
      setAvailableMonths: (availableMonths) => set({ availableMonths }),

      // 헬퍼: 전월 계산
      getPrevMonth: () => {
        const { year, month, availableMonths } = get()
        let prevYear = year
        let prevMonth = month - 1
        
        if (prevMonth < 1) {
          prevYear -= 1
          prevMonth = 12
        }
        
        // 사용 가능한 월 목록에 있는지 확인
        const exists = availableMonths.some(
          m => m.year === prevYear && m.month === prevMonth
        )
        
        return exists ? { year: prevYear, month: prevMonth } : null
      },
    }),
    {
      name: 'dashboard-store',
      partialize: (state) => ({
        viewMode: state.viewMode,
        showPrevMonthLine: state.showPrevMonthLine,
        showOnline: state.showOnline,
        showOffline: state.showOffline,
        showTotal: state.showTotal,
      }),
    }
  )
)

