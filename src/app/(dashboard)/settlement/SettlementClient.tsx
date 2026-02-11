'use client'

import { useState, useEffect, useCallback } from 'react'
import { Header } from '@/components/dashboard/Header'
import { Card, CardHeader } from '@/components/ui'
import { formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'
import { 
  Check, 
  ArrowRight, 
  CheckCircle2,
  Clock,
  RefreshCw,
  Wallet,
  ArrowDownUp,
  TrendingUp,
  Calendar,
  BarChart3,
} from 'lucide-react'
import { Role } from '@prisma/client'
import { useDashboardStore } from '@/stores/dashboard-store'

interface SettlementClientProps {
  userRole: Role
  showAllData: boolean
  userName: string
}

// 정산 항목 타입
type SettlementItemId = 
  | 'SKP_TO_MAZE_REVENUE'
  | 'MAZE_TO_SKP_OPERATION'
  | 'SKP_TO_CULTURE_PLATFORM'
  | 'CULTURE_TO_SKP'
  | 'SKP_TO_MAZE_CULTURE_SHARE'
  | 'FMC_TO_SKP_AGENCY'

interface SettlementItem {
  id: SettlementItemId
  from: string
  to: string
  fromCode: string
  toCode: string
  description: string
  isInvoice?: boolean  // 세금계산서가 아닌 인보이스 청구 건
  isNonRevenue?: boolean  // 매출이 아닌 수익 건
}

interface CheckState {
  checked: boolean
  checkedAt?: string
  checkedBy?: string
  amount: number
}

interface NetTransfer {
  from: string
  to: string
  amount: number
  description: string
}

interface CompanySummary {
  revenue: number
  expense: number
  profit: number
}

interface MonthlyDataItem {
  year: number
  month: number
  amounts: Record<string, number>
  visitors: number
}

interface CumulativeData {
  type: 'yearly' | 'total'
  year: number | null
  period: string
  monthCount: number
  totalVisitors: number
  companySummary: Record<string, CompanySummary>
  amounts: Record<string, number>
  availableYears: number[]
  monthlyData: MonthlyDataItem[]
}

// 정산 항목 정의 (수정된 설명)
const SETTLEMENT_ITEMS: SettlementItem[] = [
  {
    id: 'SKP_TO_MAZE_REVENUE',
    from: 'SKP',
    to: '메이즈랜드',
    fromCode: 'SKP',
    toCode: 'MAZE',
    description: '총매출 건 (인당 3,000원, 수수료 차감)',
  },
  {
    id: 'MAZE_TO_SKP_OPERATION',
    from: '메이즈랜드',
    to: 'SKP',
    fromCode: 'MAZE',
    toCode: 'SKP',
    description: '운영 수수료 (인당 1,000원, 수수료 차감)',
  },
  {
    id: 'CULTURE_TO_SKP',
    from: '컬처커넥션',
    to: 'SKP',
    fromCode: 'CULTURE',
    toCode: 'SKP',
    description: '플랫폼 비용 (인당 1,000원, 수수료 차감)',
  },
  {
    id: 'SKP_TO_CULTURE_PLATFORM',
    from: 'SKP',
    to: '컬처커넥션',
    fromCode: 'SKP',
    toCode: 'CULTURE',
    description: '플랫폼 이용료 (1,000원의 20%, 수수료 차감)',
  },
  {
    id: 'SKP_TO_MAZE_CULTURE_SHARE',
    from: 'SKP',
    to: '메이즈랜드',
    fromCode: 'SKP',
    toCode: 'MAZE',
    description: '컬처 분담금 (인당 500원, 인보이스 청구)',
    isInvoice: true,
    isNonRevenue: true,
  },
  {
    id: 'FMC_TO_SKP_AGENCY',
    from: 'FMC',
    to: 'SKP',
    fromCode: 'FMC',
    toCode: 'SKP',
    description: '운영대행 수수료 (SKP 순이익의 20%)',
  },
]

// 회사별 색상
const COMPANY_COLORS: Record<string, string> = {
  SKP: 'bg-blue-500',
  MAZE: 'bg-maze-500',
  CULTURE: 'bg-purple-500',
  FMC: 'bg-orange-500',
}

const COMPANY_BG_COLORS: Record<string, string> = {
  SKP: 'bg-blue-500/10 border-blue-500/30',
  MAZE: 'bg-maze-500/10 border-maze-500/30',
  CULTURE: 'bg-purple-500/10 border-purple-500/30',
  FMC: 'bg-orange-500/10 border-orange-500/30',
}

const COMPANY_NAMES: Record<string, string> = {
  SKP: 'SKP',
  MAZE: '메이즈랜드',
  CULTURE: '컬처커넥션',
  FMC: 'FMC',
}

const ALL_TABS = ['SKP', 'MAZE', 'CULTURE', 'FMC'] as const

// 역할별 접근 가능한 탭 매핑
const ROLE_TO_TAB: Record<string, string> = {
  SUPER_ADMIN: 'SKP',  // 전체 접근 가능
  SKP_ADMIN: 'SKP',    // 전체 접근 가능
  MAZE_ADMIN: 'MAZE',
  CULTURE_ADMIN: 'CULTURE',
  AGENCY_ADMIN: 'FMC',
}

// 역할별 접근 가능한 탭 목록
function getAccessibleTabs(role: Role): readonly string[] {
  // SKP_ADMIN 또는 SUPER_ADMIN은 전체 탭 접근 가능
  if (role === 'SUPER_ADMIN' || role === 'SKP_ADMIN') {
    return ALL_TABS
  }
  // 그 외는 자기 탭만 접근 가능
  const tab = ROLE_TO_TAB[role]
  return tab ? [tab] : []
}

export function SettlementClient({ userRole, showAllData, userName }: SettlementClientProps) {
  // 접근 가능한 탭 계산
  const accessibleTabs = getAccessibleTabs(userRole)
  const defaultTab = ROLE_TO_TAB[userRole] || 'SKP'
  
  // Dashboard store에서 전역 월/년 동기화용
  const { setYearMonth } = useDashboardStore()
  
  const [activeTab, setActiveTab] = useState<string>(defaultTab)
  const [selectedYear, setSelectedYear] = useState<number | null>(null)
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null)
  const [checks, setChecks] = useState<Record<string, CheckState>>({})
  const [amounts, setAmounts] = useState<Record<string, number>>({})
  const [netTransfers, setNetTransfers] = useState<Record<string, NetTransfer>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  const [availableMonths, setAvailableMonths] = useState<{year: number, month: number}[]>([])
  const [dataInfo, setDataInfo] = useState<{totalVisitors: number, onlineCount: number, offlineCount: number}>({
    totalVisitors: 0, onlineCount: 0, offlineCount: 0
  })
  
  // 누적 현황 관련 상태
  const [cumulativeTab, setCumulativeTab] = useState<'yearly' | 'total'>('yearly')
  const [cumulativeYear, setCumulativeYear] = useState<number>(new Date().getFullYear())
  const [cumulativeData, setCumulativeData] = useState<CumulativeData | null>(null)
  const [isLoadingCumulative, setIsLoadingCumulative] = useState(false)
  const [availableYears, setAvailableYears] = useState<number[]>([])

  // 초기 데이터 로드 (사용 가능한 월 목록만)
  useEffect(() => {
    const initializeMonth = async () => {
      try {
        // 먼저 사용 가능한 월 목록만 가져옴 (캐시 무효화)
        const res = await fetch(`/api/settlement-data?year=0&month=0&_t=${Date.now()}`, {
          cache: 'no-store',
        })
        if (res.ok) {
          const data = await res.json()
          if (data.availableMonths && data.availableMonths.length > 0) {
            setAvailableMonths(data.availableMonths)
            // 가장 최신 월로 설정
            const latestMonth = data.availableMonths.sort((a: any, b: any) => {
              if (a.year !== b.year) return b.year - a.year
              return b.month - a.month
            })[0]
            setSelectedYear(latestMonth.year)
            setSelectedMonth(latestMonth.month)
          } else {
            // 데이터가 없으면 현재 날짜 사용
            setSelectedYear(new Date().getFullYear())
            setSelectedMonth(new Date().getMonth() + 1)
          }
        }
      } catch (error) {
        console.error('Initialize error:', error)
        setSelectedYear(new Date().getFullYear())
        setSelectedMonth(new Date().getMonth() + 1)
      } finally {
        setIsInitialized(true)
      }
    }
    
    initializeMonth()
  }, [])

  // 데이터 로드
  const loadData = useCallback(async () => {
    if (selectedYear === null || selectedMonth === null) return
    
    setIsLoading(true)
    try {
      // 정산 데이터 API 호출 (캐시 무효화)
      const settDataRes = await fetch(
        `/api/settlement-data?year=${selectedYear}&month=${selectedMonth}&_t=${Date.now()}`,
        { cache: 'no-store' }
      )
      if (settDataRes.ok) {
        const settData = await settDataRes.json()
        
        console.log('[Settlement Client] Data loaded:', settData)
        
        // 금액 설정
        if (settData.amounts) {
          setAmounts(settData.amounts)
        }
        
        // 상계 입금액 설정
        if (settData.netTransfers) {
          setNetTransfers(settData.netTransfers)
        }
        
        // 사용 가능한 월 목록
        if (settData.availableMonths) {
          setAvailableMonths(settData.availableMonths)
        }
        
        // 데이터 정보
        setDataInfo({
          totalVisitors: settData.totalVisitors || 0,
          onlineCount: settData.onlineCount || 0,
          offlineCount: settData.offlineCount || 0,
        })
      }

      // 체크 상태 로드 (캐시 무효화)
      const checkRes = await fetch(
        `/api/settlement-check?year=${selectedYear}&month=${selectedMonth}&_t=${Date.now()}`,
        { cache: 'no-store' }
      )
      if (checkRes.ok) {
        const checkData = await checkRes.json()
        setChecks(checkData.checks || {})
      }
    } catch (error) {
      console.error('Load data error:', error)
    } finally {
      setIsLoading(false)
    }
  }, [selectedYear, selectedMonth])

  useEffect(() => {
    if (isInitialized && selectedYear !== null && selectedMonth !== null) {
      loadData()
      // Header의 날짜와 동기화
      setYearMonth(selectedYear, selectedMonth)
    }
  }, [isInitialized, selectedYear, selectedMonth, loadData, setYearMonth])

  // 누적 데이터 로드
  const loadCumulativeData = useCallback(async () => {
    setIsLoadingCumulative(true)
    try {
      const res = await fetch(
        `/api/settlement-cumulative?type=${cumulativeTab}&year=${cumulativeYear}&_t=${Date.now()}`,
        { cache: 'no-store' }
      )
      if (res.ok) {
        const data = await res.json()
        setCumulativeData(data)
        if (data.availableYears && data.availableYears.length > 0) {
          setAvailableYears(data.availableYears)
          // 현재 선택된 연도가 가용 연도에 없으면 첫 번째 연도로 변경
          if (!data.availableYears.includes(cumulativeYear)) {
            setCumulativeYear(data.availableYears[0])
          }
        }
      }
    } catch (error) {
      console.error('Load cumulative data error:', error)
    } finally {
      setIsLoadingCumulative(false)
    }
  }, [cumulativeTab, cumulativeYear])

  useEffect(() => {
    if (isInitialized) {
      loadCumulativeData()
    }
  }, [isInitialized, cumulativeTab, cumulativeYear, loadCumulativeData])

  useEffect(() => {
    // 초기 연도 설정 및 동기화
    if (availableMonths.length > 0) {
      const years = Array.from(
        availableMonths.reduce((acc, m) => acc.add(m.year), new Set<number>())
      ).sort((a, b) => b - a)
      
      if (years.length > 0) {
        setAvailableYears(years)
        // 현재 선택된 연도가 가용 연도에 없으면 첫 번째 연도로 변경
        if (!years.includes(cumulativeYear)) {
          setCumulativeYear(years[0])
        }
      }
    }
  }, [availableMonths, cumulativeYear])

  // 체크 상태 토글
  const handleToggleCheck = async (itemId: SettlementItemId) => {
    const currentState = checks[itemId]?.checked || false
    const newChecked = !currentState
    const amount = amounts[itemId] || 0

    // 낙관적 업데이트
    setChecks(prev => ({
      ...prev,
      [itemId]: {
        checked: newChecked,
        checkedAt: newChecked ? new Date().toISOString() : undefined,
        checkedBy: newChecked ? userName : undefined,
        amount,
      }
    }))

    setIsSaving(true)
    try {
      const res = await fetch('/api/settlement-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year: selectedYear,
          month: selectedMonth,
          itemId,
          checked: newChecked,
          amount,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setChecks(data.checks)
      }
    } catch (error) {
      console.error('Toggle check error:', error)
      // 롤백
      loadData()
    } finally {
      setIsSaving(false)
    }
  }

  // 현재 탭에 해당하는 항목 필터
  const getItemsForTab = (companyCode: string) => {
    return SETTLEMENT_ITEMS.filter(
      item => item.fromCode === companyCode || item.toCode === companyCode
    )
  }

  // 발행/수취 구분
  const getItemsGrouped = (companyCode: string) => {
    const items = getItemsForTab(companyCode)
    return {
      // 해당 회사가 발행하는 것 (발행처 = 해당 회사)
      issue: items.filter(item => item.fromCode === companyCode),
      // 해당 회사가 수취하는 것 (수취처 = 해당 회사)
      receive: items.filter(item => item.toCode === companyCode),
    }
  }

  // 완료율 계산
  const getCompletionRate = (companyCode: string) => {
    const items = getItemsForTab(companyCode)
    const checkedCount = items.filter(item => checks[item.id]?.checked).length
    return items.length > 0 ? Math.round((checkedCount / items.length) * 100) : 0
  }

  // 전체 완료율
  const getTotalCompletionRate = () => {
    const checkedCount = SETTLEMENT_ITEMS.filter(item => checks[item.id]?.checked).length
    return Math.round((checkedCount / SETTLEMENT_ITEMS.length) * 100)
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-'
    const date = new Date(dateStr)
    return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`
  }

  return (
    <div className="min-h-screen">
      <Header
        title="정산 현황"
        description="세금계산서 발행 및 상계 입금 관리"
      />
      
      <div className="p-8 space-y-6">
        {/* 월 선택 및 요약 */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="text-dashboard-muted">조회 월:</span>
            <select
              value={selectedYear && selectedMonth ? `${selectedYear}-${selectedMonth}` : ''}
              onChange={(e) => {
                const [y, m] = e.target.value.split('-')
                setSelectedYear(parseInt(y))
                setSelectedMonth(parseInt(m))
              }}
              className="px-4 py-2 bg-dashboard-card border border-dashboard-border rounded-lg text-dashboard-text"
            >
              {availableMonths.length > 0 ? (
                availableMonths
                  .sort((a, b) => b.year - a.year || b.month - a.month)
                  .map(m => (
                    <option key={`${m.year}-${m.month}`} value={`${m.year}-${m.month}`}>
                      {m.year}년 {m.month}월
                    </option>
                  ))
              ) : (
                <option value="">데이터 없음</option>
              )}
            </select>
            <button
              onClick={loadData}
              disabled={isLoading}
              className="p-2 text-dashboard-muted hover:text-dashboard-text rounded-lg hover:bg-dashboard-border transition-colors"
            >
              <RefreshCw className={cn('w-5 h-5', isLoading && 'animate-spin')} />
            </button>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="text-sm">
              <span className="text-dashboard-muted">총 방문객: </span>
              <span className="text-dashboard-text font-bold">{dataInfo.totalVisitors.toLocaleString()}명</span>
              <span className="text-dashboard-muted ml-2">
                (온라인 {dataInfo.onlineCount.toLocaleString()} / 오프라인 {dataInfo.offlineCount.toLocaleString()})
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-dashboard-muted">진행률:</span>
              <div className="w-32 h-3 bg-dashboard-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-maze-500 transition-all duration-500"
                  style={{ width: `${getTotalCompletionRate()}%` }}
                />
              </div>
              <span className="text-maze-500 font-bold">{getTotalCompletionRate()}%</span>
            </div>
          </div>
        </div>

        {/* 회사별 탭 - 접근 가능한 탭만 표시 */}
        <div className="flex gap-2 border-b border-dashboard-border">
          {accessibleTabs.map(tab => {
            const completionRate = getCompletionRate(tab)
            const isComplete = completionRate === 100
            
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'relative px-6 py-3 font-medium transition-all border-b-2 -mb-[2px]',
                  activeTab === tab
                    ? 'border-maze-500 text-maze-500'
                    : 'border-transparent text-dashboard-muted hover:text-dashboard-text'
                )}
              >
                <div className="flex items-center gap-2">
                  <div className={cn('w-3 h-3 rounded-full', COMPANY_COLORS[tab])} />
                  <span>{COMPANY_NAMES[tab]}</span>
                  {isComplete ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  ) : completionRate > 0 ? (
                    <Clock className="w-4 h-4 text-yellow-500" />
                  ) : null}
                </div>
              </button>
            )
          })}
        </div>

        {/* 정산 항목 표시 */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-maze-500" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 발행할 계산서 (해당 회사가 발행) */}
            <Card className={COMPANY_BG_COLORS[activeTab]}>
              <CardHeader
                title={`${COMPANY_NAMES[activeTab]}가 발행하는 계산서`}
                description="세금계산서 발행 후 체크"
              />
              <div className="space-y-3">
                {getItemsGrouped(activeTab).issue.length > 0 ? (
                  getItemsGrouped(activeTab).issue.map(item => (
                    <SettlementItemCard
                      key={item.id}
                      item={item}
                      checkState={checks[item.id]}
                      amount={amounts[item.id] || 0}
                      onToggle={() => handleToggleCheck(item.id)}
                      isSaving={isSaving}
                      direction="issue"
                    />
                  ))
                ) : (
                  <p className="text-center py-4 text-dashboard-muted">발행할 계산서가 없습니다.</p>
                )}
              </div>
            </Card>

            {/* 수취할 계산서 (해당 회사가 수취) */}
            <Card>
              <CardHeader
                title={`${COMPANY_NAMES[activeTab]}가 수취하는 계산서`}
                description="발행처에서 계산서 발행 시 자동 체크됨"
              />
              <div className="space-y-3">
                {getItemsGrouped(activeTab).receive.length > 0 ? (
                  getItemsGrouped(activeTab).receive.map(item => (
                    <SettlementItemCard
                      key={item.id}
                      item={item}
                      checkState={checks[item.id]}
                      amount={amounts[item.id] || 0}
                      onToggle={() => handleToggleCheck(item.id)}
                      isSaving={isSaving}
                      direction="receive"
                    />
                  ))
                ) : (
                  <p className="text-center py-4 text-dashboard-muted">수취할 계산서가 없습니다.</p>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* 계산서 발행 현황 - 현재 탭에 해당하는 것만 표시 */}
        <Card>
          <CardHeader 
            title={`${COMPANY_NAMES[activeTab]} 관련 계산서 발행 현황`} 
            description={`${COMPANY_NAMES[activeTab]}와 관련된 정산 항목`} 
          />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dashboard-border">
                  <th className="text-left py-3 px-4 font-semibold text-dashboard-muted">발행처</th>
                  <th className="text-center py-3 px-4 font-semibold text-dashboard-muted"></th>
                  <th className="text-left py-3 px-4 font-semibold text-dashboard-muted">수취처</th>
                  <th className="text-left py-3 px-4 font-semibold text-dashboard-muted">항목</th>
                  <th className="text-right py-3 px-4 font-semibold text-dashboard-muted">금액</th>
                  <th className="text-center py-3 px-4 font-semibold text-dashboard-muted">구분</th>
                  <th className="text-center py-3 px-4 font-semibold text-dashboard-muted">상태</th>
                  <th className="text-center py-3 px-4 font-semibold text-dashboard-muted">발행일</th>
                </tr>
              </thead>
              <tbody>
                {SETTLEMENT_ITEMS
                  .filter(item => item.fromCode === activeTab || item.toCode === activeTab)
                  .map(item => {
                    const checkState = checks[item.id]
                    const amount = amounts[item.id] || 0
                    const isRevenue = item.fromCode === activeTab  // 발행처가 현재 탭이면 매출
                    
                    return (
                      <tr 
                        key={item.id} 
                        className={cn(
                          'border-b border-dashboard-border/50 transition-colors',
                          checkState?.checked ? 'bg-green-500/5' : 'hover:bg-dashboard-border/30'
                        )}
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className={cn('w-2 h-2 rounded-full', COMPANY_COLORS[item.fromCode])} />
                            <span className="text-dashboard-text font-medium">{item.from}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <ArrowRight className="w-4 h-4 text-dashboard-muted inline" />
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className={cn('w-2 h-2 rounded-full', COMPANY_COLORS[item.toCode])} />
                            <span className="text-dashboard-text font-medium">{item.to}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-dashboard-muted">
                          <div className="flex items-center gap-2">
                            {item.description}
                            {item.isInvoice && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-yellow-500/20 text-yellow-400">
                                인보이스
                              </span>
                            )}
                          </div>
                        </td>
                        <td className={cn(
                          'py-3 px-4 text-right font-medium',
                          isRevenue ? 'text-green-400' : 'text-red-400'
                        )}>
                          {isRevenue ? '+' : '-'}{formatCurrency(amount)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={cn(
                            'px-2 py-1 rounded text-xs font-medium',
                            item.isNonRevenue && isRevenue
                              ? 'bg-yellow-500/20 text-yellow-400'
                              : isRevenue 
                                ? 'bg-green-500/20 text-green-400' 
                                : 'bg-red-500/20 text-red-400'
                          )}>
                            {item.isNonRevenue && isRevenue ? '수익' : isRevenue ? '매출' : '비용'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => handleToggleCheck(item.id)}
                            disabled={isSaving}
                            className={cn(
                              'w-6 h-6 rounded border-2 flex items-center justify-center transition-all',
                              checkState?.checked
                                ? 'bg-green-500 border-green-500 text-white'
                                : 'border-dashboard-border hover:border-maze-500'
                            )}
                          >
                            {checkState?.checked && <Check className="w-4 h-4" />}
                          </button>
                        </td>
                        <td className="py-3 px-4 text-center text-xs text-dashboard-muted">
                          {checkState?.checked ? formatDate(checkState.checkedAt) : '-'}
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        </Card>

        {/* 상계 입금액 현황 - 현재 탭에 해당하는 것만 표시 */}
        <Card className="bg-gradient-to-r from-blue-500/5 to-purple-500/5 border-blue-500/20">
          <CardHeader 
            title={
              <div className="flex items-center gap-2">
                <ArrowDownUp className="w-5 h-5 text-blue-500" />
                <span>{COMPANY_NAMES[activeTab]} 상계 입금액 현황</span>
              </div>
            }
            description={`${COMPANY_NAMES[activeTab]}와 관련된 계산서 상계 처리 후 실제 입금 금액`}
          />
          <div className={cn(
            'grid gap-4',
            activeTab === 'SKP' ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1'
          )}>
            {/* SKP ↔ 메이즈랜드 - SKP 또는 MAZE 탭에서만 표시 */}
            {(activeTab === 'SKP' || activeTab === 'MAZE') && (
              <div className="p-4 bg-dashboard-card rounded-lg border border-dashboard-border">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={cn('w-3 h-3 rounded-full', COMPANY_COLORS.SKP)} />
                    <span className="font-medium text-dashboard-text">SKP</span>
                    <ArrowDownUp className="w-4 h-4 text-dashboard-muted" />
                    <div className={cn('w-3 h-3 rounded-full', COMPANY_COLORS.MAZE)} />
                    <span className="font-medium text-dashboard-text">메이즈랜드</span>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  {/* SKP → 메이즈 (총매출): SKP가 메이즈에 청구 = SKP 매출, 메이즈 비용 */}
                  <div className="flex justify-between">
                    <span className="text-dashboard-muted">SKP → 메이즈 (총매출)</span>
                    <span className={activeTab === 'SKP' ? 'text-green-400' : 'text-red-400'}>
                      {activeTab === 'SKP' ? '+' : '-'}{formatCurrency(amounts['SKP_TO_MAZE_REVENUE'] || 0)}
                    </span>
                  </div>
                  {/* 메이즈 → SKP (운영수수료): 메이즈가 SKP에 청구 = 메이즈 매출, SKP 비용 */}
                  <div className="flex justify-between">
                    <span className="text-dashboard-muted">메이즈 → SKP (운영수수료)</span>
                    <span className={activeTab === 'MAZE' ? 'text-green-400' : 'text-red-400'}>
                      {activeTab === 'MAZE' ? '+' : '-'}{formatCurrency(amounts['MAZE_TO_SKP_OPERATION'] || 0)}
                    </span>
                  </div>
                  {/* SKP → 메이즈 (컬처분담 인보이스): SKP가 메이즈에 청구 = SKP 수익, 메이즈 비용 */}
                  <div className="flex justify-between">
                    <span className="text-dashboard-muted">
                      SKP → 메이즈 (컬처분담)
                      <span className="ml-1 text-xs text-yellow-500">[인보이스]</span>
                    </span>
                    <span className={activeTab === 'SKP' ? 'text-green-400' : 'text-red-400'}>
                      {activeTab === 'SKP' ? '+' : '-'}{formatCurrency(amounts['SKP_TO_MAZE_CULTURE_SHARE'] || 0)}
                    </span>
                  </div>
                  <div className="border-t border-dashboard-border pt-2 mt-2">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-dashboard-text">상계 후 입금액</span>
                      {netTransfers.SKP_MAZE && (
                        <div className="text-right">
                          <div className="font-bold text-lg text-blue-400">
                            {formatCurrency(netTransfers.SKP_MAZE.amount)}
                          </div>
                          <div className="text-xs text-dashboard-muted">
                            {netTransfers.SKP_MAZE.description}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SKP ↔ 컬처커넥션 - SKP 또는 CULTURE 탭에서만 표시 */}
            {(activeTab === 'SKP' || activeTab === 'CULTURE') && (
              <div className="p-4 bg-dashboard-card rounded-lg border border-dashboard-border">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={cn('w-3 h-3 rounded-full', COMPANY_COLORS.SKP)} />
                    <span className="font-medium text-dashboard-text">SKP</span>
                    <ArrowDownUp className="w-4 h-4 text-dashboard-muted" />
                    <div className={cn('w-3 h-3 rounded-full', COMPANY_COLORS.CULTURE)} />
                    <span className="font-medium text-dashboard-text">컬처커넥션</span>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  {/* 컬처 → SKP (플랫폼비용): 컬처가 SKP에 청구 = 컬처 매출, SKP 비용 */}
                  <div className="flex justify-between">
                    <span className="text-dashboard-muted">컬처 → SKP (플랫폼비용)</span>
                    <span className={activeTab === 'CULTURE' ? 'text-green-400' : 'text-red-400'}>
                      {activeTab === 'CULTURE' ? '+' : '-'}{formatCurrency(amounts['CULTURE_TO_SKP'] || 0)}
                    </span>
                  </div>
                  {/* SKP → 컬처 (이용료 20%): SKP가 컬처에 청구 = SKP 매출, 컬처 비용 */}
                  <div className="flex justify-between">
                    <span className="text-dashboard-muted">SKP → 컬처 (이용료 20%)</span>
                    <span className={activeTab === 'SKP' ? 'text-green-400' : 'text-red-400'}>
                      {activeTab === 'SKP' ? '+' : '-'}{formatCurrency(amounts['SKP_TO_CULTURE_PLATFORM'] || 0)}
                    </span>
                  </div>
                  <div className="border-t border-dashboard-border pt-2 mt-2">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-dashboard-text">상계 후 입금액</span>
                      {netTransfers.SKP_CULTURE && (
                        <div className="text-right">
                          <div className="font-bold text-lg text-purple-400">
                            {formatCurrency(netTransfers.SKP_CULTURE.amount)}
                          </div>
                          <div className="text-xs text-dashboard-muted">
                            {netTransfers.SKP_CULTURE.description}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SKP → FMC - SKP 또는 FMC 탭에서만 표시 */}
            {(activeTab === 'SKP' || activeTab === 'FMC') && (
              <div className="p-4 bg-dashboard-card rounded-lg border border-dashboard-border">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={cn('w-3 h-3 rounded-full', COMPANY_COLORS.FMC)} />
                    <span className="font-medium text-dashboard-text">FMC</span>
                    <ArrowRight className="w-4 h-4 text-dashboard-muted" />
                    <div className={cn('w-3 h-3 rounded-full', COMPANY_COLORS.SKP)} />
                    <span className="font-medium text-dashboard-text">SKP</span>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  {/* FMC → SKP (대행수수료): FMC가 SKP에 청구 = FMC 매출, SKP 비용 */}
                  <div className="flex justify-between">
                    <span className="text-dashboard-muted">FMC → SKP (대행수수료)</span>
                    <span className={activeTab === 'FMC' ? 'text-green-400' : 'text-red-400'}>
                      {activeTab === 'FMC' ? '+' : '-'}{formatCurrency(amounts['FMC_TO_SKP_AGENCY'] || 0)}
                    </span>
                  </div>
                  <div className="border-t border-dashboard-border pt-2 mt-2">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-dashboard-text">입금액</span>
                      {netTransfers.SKP_FMC && (
                        <div className="text-right">
                          <div className="font-bold text-lg text-orange-400">
                            {formatCurrency(netTransfers.SKP_FMC.amount)}
                          </div>
                          <div className="text-xs text-dashboard-muted">
                            {netTransfers.SKP_FMC.description}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* 누적 현황 섹션 */}
        <Card className="bg-gradient-to-r from-emerald-500/5 to-teal-500/5 border-emerald-500/20">
          <CardHeader 
            title={
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-emerald-500" />
                <span>누적 현황</span>
              </div>
            }
            description="연간 및 전체 기간 매출/비용/수익 누적 합계"
          />
          
          {/* 누적 탭 */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setCumulativeTab('yearly')}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all',
                cumulativeTab === 'yearly'
                  ? 'bg-emerald-500 text-white'
                  : 'bg-dashboard-border text-dashboard-muted hover:bg-dashboard-border/80'
              )}
            >
              <Calendar className="w-4 h-4" />
              연간 누적
            </button>
            <button
              onClick={() => setCumulativeTab('total')}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all',
                cumulativeTab === 'total'
                  ? 'bg-emerald-500 text-white'
                  : 'bg-dashboard-border text-dashboard-muted hover:bg-dashboard-border/80'
              )}
            >
              <TrendingUp className="w-4 h-4" />
              전체 누적
            </button>
            
            {cumulativeTab === 'yearly' && availableYears.length > 0 && (
              <select
                value={cumulativeYear}
                onChange={(e) => setCumulativeYear(parseInt(e.target.value))}
                className="ml-4 px-4 py-2 bg-dashboard-card border border-dashboard-border rounded-lg text-dashboard-text"
              >
                {availableYears.map(year => (
                  <option key={year} value={year}>{year}년</option>
                ))}
              </select>
            )}
            
            <button
              onClick={loadCumulativeData}
              disabled={isLoadingCumulative}
              className="ml-auto p-2 text-dashboard-muted hover:text-dashboard-text rounded-lg hover:bg-dashboard-border transition-colors"
            >
              <RefreshCw className={cn('w-5 h-5', isLoadingCumulative && 'animate-spin')} />
            </button>
          </div>

          {/* 기간 정보 */}
          {cumulativeData && (
            <div className="mb-4 p-3 bg-dashboard-bg rounded-lg flex items-center justify-between">
              <div className="text-sm">
                <span className="text-dashboard-muted">조회 기간: </span>
                <span className="text-dashboard-text font-medium">{cumulativeData.period}</span>
                <span className="text-dashboard-muted ml-4">({cumulativeData.monthCount}개월)</span>
              </div>
              <div className="text-sm">
                <span className="text-dashboard-muted">총 방문객: </span>
                <span className="text-dashboard-text font-bold">{cumulativeData.totalVisitors.toLocaleString()}명</span>
              </div>
            </div>
          )}

          {/* 누적 현황 콘텐츠 */}
          {isLoadingCumulative ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
            </div>
          ) : cumulativeData?.monthlyData && cumulativeData.monthlyData.length > 0 ? (
            <div className="space-y-6">
              {/* 월별 정산 현황 테이블 */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-dashboard-border">
                      <th className="text-left py-2 px-3 font-semibold text-dashboard-muted">월</th>
                      <th className="text-right py-2 px-3 font-semibold text-dashboard-muted">방문객</th>
                      {activeTab === 'MAZE' ? (
                        <th className="text-right py-2 px-3 font-semibold text-green-400">매출</th>
                      ) : (
                        <>
                          <th className="text-right py-2 px-3 font-semibold text-green-400">매출</th>
                          <th className="text-right py-2 px-3 font-semibold text-red-400">비용</th>
                          <th className="text-right py-2 px-3 font-semibold text-emerald-400">순이익</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {cumulativeData.monthlyData
                      .sort((a, b) => a.year - b.year || a.month - b.month)
                      .map((monthData, idx) => {
                        // 회사별 매출/비용 계산
                        const getCompanyData = (code: string) => {
                          let revenue = 0
                          let expense = 0
                          let profit = 0
                          
                          if (code === 'SKP') {
                            revenue = (monthData.amounts.SKP_TO_MAZE_REVENUE || 0) + 
                                     (monthData.amounts.SKP_TO_CULTURE_PLATFORM || 0)
                            profit = monthData.amounts.SKP_TO_MAZE_CULTURE_SHARE || 0
                            expense = (monthData.amounts.MAZE_TO_SKP_OPERATION || 0) + 
                                     (monthData.amounts.CULTURE_TO_SKP || 0) +
                                     (monthData.amounts.FMC_TO_SKP_AGENCY || 0)
                          } else if (code === 'MAZE') {
                            revenue = monthData.amounts.MAZE_TO_SKP_OPERATION || 0
                            expense = (monthData.amounts.SKP_TO_MAZE_REVENUE || 0) + 
                                     (monthData.amounts.SKP_TO_MAZE_CULTURE_SHARE || 0)
                          } else if (code === 'CULTURE') {
                            revenue = monthData.amounts.CULTURE_TO_SKP || 0
                            expense = monthData.amounts.SKP_TO_CULTURE_PLATFORM || 0
                          } else if (code === 'FMC') {
                            revenue = monthData.amounts.FMC_TO_SKP_AGENCY || 0
                            expense = 0
                          }
                          
                          return { revenue, expense, profit, net: revenue + profit - expense }
                        }
                        
                        const data = getCompanyData(activeTab)
                        
                        return (
                          <tr key={idx} className="border-b border-dashboard-border/50 hover:bg-dashboard-border/20">
                            <td className="py-2 px-3 text-dashboard-text">
                              {monthData.year}년 {monthData.month}월
                            </td>
                            <td className="py-2 px-3 text-right text-dashboard-muted">
                              {monthData.visitors.toLocaleString()}명
                            </td>
                            {activeTab === 'MAZE' ? (
                              <td className="py-2 px-3 text-right text-green-400 font-medium">
                                +{formatCurrency(data.revenue)}
                              </td>
                            ) : (
                              <>
                                <td className="py-2 px-3 text-right text-green-400">
                                  +{formatCurrency(data.revenue)}
                                </td>
                                <td className="py-2 px-3 text-right text-red-400">
                                  -{formatCurrency(data.expense)}
                                </td>
                                <td className={cn(
                                  'py-2 px-3 text-right font-medium',
                                  data.net >= 0 ? 'text-emerald-400' : 'text-red-400'
                                )}>
                                  {data.net >= 0 ? '+' : ''}{formatCurrency(data.net)}
                                </td>
                              </>
                            )}
                          </tr>
                        )
                      })}
                  </tbody>
                </table>
              </div>

              {/* 총 합계 */}
              <div className={cn(
                'p-4 rounded-lg border-2',
                COMPANY_BG_COLORS[activeTab]
              )}>
                <div className="flex items-center gap-2 mb-3">
                  <div className={cn('w-4 h-4 rounded-full', COMPANY_COLORS[activeTab])} />
                  <span className="font-bold text-lg text-dashboard-text">
                    {COMPANY_NAMES[activeTab]} 총 합계
                  </span>
                  <span className="text-dashboard-muted text-sm ml-2">
                    ({cumulativeData.period})
                  </span>
                </div>
                
                {(() => {
                  const summary = cumulativeData.companySummary[activeTab]
                  if (!summary) return null
                  
                  const netAmount = summary.revenue + summary.profit - summary.expense
                  
                  // 메이즈랜드는 매출만 표시
                  if (activeTab === 'MAZE') {
                    return (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-dashboard-bg rounded-lg">
                          <div className="text-sm text-dashboard-muted mb-1">총 매출</div>
                          <div className="text-2xl font-bold text-green-400">
                            +{formatCurrency(summary.revenue)}
                          </div>
                        </div>
                        <div className="p-3 bg-dashboard-bg rounded-lg">
                          <div className="text-sm text-dashboard-muted mb-1">총 방문객</div>
                          <div className="text-2xl font-bold text-dashboard-text">
                            {cumulativeData.totalVisitors.toLocaleString()}명
                          </div>
                        </div>
                      </div>
                    )
                  }
                  
                  return (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-3 bg-dashboard-bg rounded-lg">
                        <div className="text-sm text-dashboard-muted mb-1">총 매출</div>
                        <div className="text-xl font-bold text-green-400">
                          +{formatCurrency(summary.revenue)}
                        </div>
                      </div>
                      {summary.profit > 0 && (
                        <div className="p-3 bg-dashboard-bg rounded-lg">
                          <div className="text-sm text-dashboard-muted mb-1">총 수익 (인보이스)</div>
                          <div className="text-xl font-bold text-yellow-400">
                            +{formatCurrency(summary.profit)}
                          </div>
                        </div>
                      )}
                      <div className="p-3 bg-dashboard-bg rounded-lg">
                        <div className="text-sm text-dashboard-muted mb-1">총 비용</div>
                        <div className="text-xl font-bold text-red-400">
                          -{formatCurrency(summary.expense)}
                        </div>
                      </div>
                      <div className="p-3 bg-dashboard-bg rounded-lg">
                        <div className="text-sm text-dashboard-muted mb-1">순이익</div>
                        <div className={cn(
                          'text-2xl font-bold',
                          netAmount >= 0 ? 'text-emerald-400' : 'text-red-400'
                        )}>
                          {netAmount >= 0 ? '+' : ''}{formatCurrency(netAmount)}
                        </div>
                      </div>
                    </div>
                  )
                })()}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-dashboard-muted">
              누적 데이터가 없습니다.
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

// 정산 항목 카드 컴포넌트
function SettlementItemCard({
  item,
  checkState,
  amount,
  onToggle,
  isSaving,
  direction,
}: {
  item: SettlementItem
  checkState?: CheckState
  amount: number
  onToggle: () => void
  isSaving: boolean
  direction: 'issue' | 'receive'
}) {
  const isChecked = checkState?.checked || false
  
  return (
    <div 
      className={cn(
        'p-4 rounded-lg border transition-all',
        isChecked
          ? 'bg-green-500/10 border-green-500/30'
          : 'bg-dashboard-bg border-dashboard-border'
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <div className={cn('w-2 h-2 rounded-full', COMPANY_COLORS[item.fromCode])} />
            <span className="text-sm font-medium text-dashboard-text">{item.from}</span>
            <ArrowRight className="w-4 h-4 text-dashboard-muted" />
            <div className={cn('w-2 h-2 rounded-full', COMPANY_COLORS[item.toCode])} />
            <span className="text-sm font-medium text-dashboard-text">{item.to}</span>
          </div>
          <p className="text-xs text-dashboard-muted">{item.description}</p>
          <p className="text-lg font-bold text-dashboard-text mt-2">
            {formatCurrency(amount)}
          </p>
          {isChecked && checkState?.checkedAt && (
            <p className="text-xs text-green-500 mt-1">
              ✓ {checkState.checkedBy}님이 체크함 ({new Date(checkState.checkedAt).toLocaleDateString()})
            </p>
          )}
        </div>
        
        <button
          onClick={onToggle}
          disabled={isSaving}
          className={cn(
            'w-8 h-8 rounded-lg border-2 flex items-center justify-center transition-all shrink-0',
            isChecked
              ? 'bg-green-500 border-green-500 text-white'
              : 'border-dashboard-border hover:border-maze-500 text-dashboard-muted'
          )}
        >
          {isChecked ? <Check className="w-5 h-5" /> : null}
        </button>
      </div>
    </div>
  )
}
