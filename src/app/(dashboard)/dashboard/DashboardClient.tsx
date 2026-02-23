'use client'

import { useState, useEffect, useCallback } from 'react'
import { Role } from '@prisma/client'
import { Card, CardHeader, StatCard } from '@/components/ui'
import { SalesChart, ChannelChart } from '@/components/charts'
import { DashboardFilters } from '@/components/dashboard/DashboardFilters'
import { KpiCard, ComparisonBadge } from '@/components/dashboard/KpiCard'
import { MonthSelector } from '@/components/dashboard/MonthSelector'
import { useDashboardStore } from '@/stores/dashboard-store'
import { formatNumber, formatCurrency, formatPercent } from '@/lib/utils'
import { cn } from '@/lib/utils'
import {
  Users,
  TrendingUp,
  DollarSign,
  BarChart3,
  Sparkles,
  Building2,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react'

// 탭 없이 단일 페이지로 구성
type TabType = 'overview'

interface DashboardClientProps {
  userRole: Role
  companyCode?: string
}

export function DashboardClient({ userRole, companyCode }: DashboardClientProps) {
  const [data, setData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Zustand store
  const { 
    year, 
    month, 
    viewMode,
    setAvailableMonths,
  } = useDashboardStore()

  const fetchDashboardData = useCallback(async () => {
    console.log('[Client] Fetching dashboard data...', { year, month, viewMode })
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        year: year.toString(),
        month: month.toString(),
        viewMode,
      })
      const response = await fetch(`/api/dashboard?${params}`, { cache: 'no-store' })
      console.log('[Client] Response status:', response.status)
      const result = await response.json()
      console.log('[Client] Data received:', { 
        year: result.year, 
        month: result.month,
        comparison: result.comparison 
      })
      
      setData(result)
      
      // 사용 가능한 월 목록 업데이트
      if (result.availableMonths) {
        setAvailableMonths(result.availableMonths)
      }
    } catch (error) {
      console.error('[Client] Failed to fetch dashboard data:', error)
    } finally {
      setIsLoading(false)
    }
  }, [year, month, viewMode, setAvailableMonths])

  // 연/월 변경시 데이터 다시 불러오기
  useEffect(() => {
    fetchDashboardData()
  }, [fetchDashboardData])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="loading-spinner" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-center text-dashboard-muted py-12">
        데이터를 불러올 수 없습니다.
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 필터 영역 (연/월 선택, 뷰모드, 전월비 옵션) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          {/* 연/월 선택 드롭다운 (클릭 가능) */}
          <MonthSelector />
          <p className="text-sm text-dashboard-muted">
            {viewMode === 'cumulative' ? '1월~' + month + '월 누적' : month + '월 데이터'}
          </p>
        </div>
        <DashboardFilters />
      </div>

      {/* 단일 대시보드 뷰 - 모든 콘텐츠 통합 */}
      <OverviewTab data={data} userRole={userRole} year={year} month={month} />
    </div>
  )
}

function getCompanyTabLabel(role: Role): string {
  switch (role) {
    case 'SUPER_ADMIN':
    case 'SKP_ADMIN':
      return 'SKP 상세'
    case 'MAZE_ADMIN':
      return '메이즈랜드 현황'
    case 'CULTURE_ADMIN':
      return '컬처커넥션 현황'
    case 'AGENCY_ADMIN':
      return '운영대행 현황'
    default:
      return '회사 현황'
  }
}

// ==========================================
// 전체 현황 (단일 대시보드)
// ==========================================
function OverviewTab({ data, userRole, year, month }: { data: any; userRole: Role; year: number; month: number }) {
  // yearMonth 형식 생성 (예: "2026-02")
  const yearMonth = `${year}-${String(month).padStart(2, '0')}`
  const rawData = data || {}
  const summary = {
    totalVisitors: 0,
    onlineCount: 0,
    offlineCount: 0,
    onlineRatio: 0,
    offlineRatio: 0,
    totalRevenue: 0,
    totalProfit: 0,
    totalFee: 0,
    totalNetRevenue: 0,
    ...rawData.summary,
  }
  const dailyTrend = rawData.dailyTrend || []
  const prevDailyTrend = rawData.prevDailyTrend || []
  const marketingLogs = rawData.marketingLogs || []
  const channels = rawData.channels || []
  const categories = rawData.categories || []
  const comparison = rawData.comparison || null
  
  // SKP 계정 여부 확인
  const isSkpUser = userRole === 'SUPER_ADMIN' || userRole === 'SKP_ADMIN'

  // 날짜 문자열에서 MM/DD 형식으로 변환 (시간 제외, 그래프 dateLabel과 동일 형식)
  const formatDateToMD = (dateStr: string): string => {
    if (!dateStr) return ''
    // ISO 형식 "2026-02-16T00:00:00.000Z" 또는 "2026-02-16" 처리
    const dateOnly = dateStr.split('T')[0] // 시간 부분 제거
    // "2026-02-16" -> "02/16" (그래프의 dateLabel과 동일 형식)
    return dateOnly.slice(5).replace('-', '/')
  }
  
  // 사용자 표시용 M/D 형식 (마케팅 범례에 표시)
  const formatDateForDisplay = (dateStr: string): string => {
    if (!dateStr) return ''
    const dateOnly = dateStr.split('T')[0]
    const parts = dateOnly.split('-')
    if (parts.length >= 3) {
      const month = parseInt(parts[1], 10)
      const day = parseInt(parts[2], 10)
      return `${month}/${day}`
    }
    return dateOnly.slice(5).replace('-', '/')
  }

  // 마케팅 로그를 차트 마커 형식으로 변환
  const markers = (marketingLogs || []).map((log: any) => {
    const isCampaign = log.logType === 'CAMPAIGN'
    
    return {
      date: formatDateToMD(log.startDate || ''), // 그래프 매칭용 (02/16 형식)
      endDate: formatDateToMD(log.endDate || ''),
      displayDate: formatDateForDisplay(log.startDate || ''), // 범례 표시용 (2/16 형식)
      displayEndDate: formatDateForDisplay(log.endDate || ''),
      type: log.logType || 'CAMPAIGN',
      // 캠페인은 제목, 퍼포먼스는 세부유형 표시
      title: isCampaign ? (log.title || '') : (log.subType || ''),
      content: isCampaign ? log.content : null,
      impressions: log.impressions || 0,
      clicks: log.clicks || 0,
      clickRate: log.impressions > 0 ? ((log.clicks / log.impressions) * 100).toFixed(2) : '0.00',
    }
  })

  // 채널별 합계 계산
  const channelTotals = (channels || []).reduce((acc: any, ch: any) => ({
    count: acc.count + (ch.count || 0),
    revenue: acc.revenue + (ch.revenue || 0),
    fee: acc.fee + (ch.fee || 0),
    netRevenue: acc.netRevenue + (ch.netRevenue || 0),
  }), { count: 0, revenue: 0, fee: 0, netRevenue: 0 })

  // 구분별 합계 계산
  const categoryTotals = (categories || []).reduce((acc: any, cat: any) => ({
    count: acc.count + (cat.count || 0),
    revenue: acc.revenue + (cat.revenue || cat.count * 3000 || 0),
  }), { count: 0, revenue: 0 })

  return (
    <div className="space-y-6">
      {/* KPI 카드 (전월비 표시) */}
      <div className={cn(
        "grid gap-6",
        isSkpUser 
          ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-4" 
          : "grid-cols-1 md:grid-cols-3"
      )}>
        <KpiCard
          title="총 방문객"
          value={formatNumber(summary.totalVisitors) + '명'}
          comparison={comparison?.totalVisitors}
          icon={<Users className="w-6 h-6" />}
        />
        <KpiCard
          title="인터넷 판매"
          value={formatNumber(summary.onlineCount) + '명'}
          comparison={comparison?.onlineCount}
          icon={<TrendingUp className="w-6 h-6" />}
        />
        <KpiCard
          title="현장 판매"
          value={formatNumber(summary.offlineCount) + '명'}
          comparison={comparison?.offlineCount}
          icon={<BarChart3 className="w-6 h-6" />}
        />
        {/* SKP 계정에서만 디지털프로그램 매출 표시 */}
        {isSkpUser && (
          <KpiCard
            title="디지털프로그램 매출"
            value={formatCurrency(summary.totalRevenue)}
            comparison={comparison?.totalRevenue}
            icon={<DollarSign className="w-6 h-6" />}
            subtitle="수수료 제외"
          />
        )}
      </div>

      {/* 인터넷/현장 비율 */}
      <Card>
        <CardHeader title="판매 채널 비율" />
        <div className="flex items-center gap-8">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-dashboard-muted">인터넷</span>
              <span className="text-maze-500 font-semibold">{summary.onlineRatio}%</span>
            </div>
            <div className="h-3 bg-dashboard-border rounded-full overflow-hidden">
              <div
                className="h-full bg-maze-500 rounded-full transition-all duration-500"
                style={{ width: `${summary.onlineRatio}%` }}
              />
            </div>
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-dashboard-muted">현장</span>
              <span className="text-blue-500 font-semibold">{summary.offlineRatio}%</span>
            </div>
            <div className="h-3 bg-dashboard-border rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-500"
                style={{ width: `${summary.offlineRatio}%` }}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* 일별 추이 그래프 */}
      <Card>
        <CardHeader
          title="일별 방문객 추이"
          description="인터넷/현장 판매 구분 및 마케팅 이벤트 표시"
        />
        {/* 데이터가 많을 때 스크롤 가능하도록 */}
        <div className="overflow-x-auto">
          <div style={{ minWidth: Math.max(800, dailyTrend.length * 25) }}>
            <SalesChart
              data={dailyTrend.map((d: any) => ({
                date: d.dateLabel,
                online: d.online,
                offline: d.offline,
                total: d.total,
              }))}
              prevData={prevDailyTrend.map((d: any) => ({
                date: d.dateLabel,
                online: d.online,
                offline: d.offline,
                total: d.total,
              }))}
              markers={markers}
              height={350}
              yearMonth={yearMonth}
            />
          </div>
        </div>
      </Card>

      {/* 채널/구분 분석 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader title="채널별 인터넷 판매" description="수수료율 포함" />
          <ChannelChart
            data={channels?.map((ch: any) => ({
              name: ch.name,
              value: ch.count,
              color: getChannelColor(ch.code),
            })) || []}
            height={280}
          />
        </Card>

        <Card>
          <CardHeader title="구분별 현장 판매" />
          <ChannelChart
            data={categories?.map((cat: any) => ({
              name: cat.name,
              value: cat.count,
              color: getCategoryColor(cat.code),
            })) || []}
            height={280}
          />
        </Card>
      </div>

      {/* 채널별 상세 현황 테이블 */}
      <Card>
        <CardHeader title="채널별 상세 현황" description="인터넷 판매 채널별 매출/수수료/순매출" />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-dashboard-border">
                <th className="text-left py-3 px-4 text-sm font-semibold text-dashboard-muted">채널명</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-dashboard-muted">판매수</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-dashboard-muted">수수료율</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-dashboard-muted">매출</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-dashboard-muted">수수료</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-dashboard-muted">순매출</th>
              </tr>
            </thead>
            <tbody>
              {channels?.map((ch: any) => (
                <tr key={ch.code} className="border-b border-dashboard-border/50 hover:bg-dashboard-border/30">
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: getChannelColor(ch.code) }}
                      />
                      <span className="text-dashboard-text">{ch.name}</span>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-right text-dashboard-text">
                    {formatNumber(ch.count)}명
                  </td>
                  <td className="py-4 px-4 text-right text-orange-500">
                    {ch.feeRate || 0}%
                  </td>
                  <td className="py-4 px-4 text-right text-dashboard-text">
                    {formatCurrency(ch.revenue || ch.count * 3000)}
                  </td>
                  <td className="py-4 px-4 text-right text-red-400">
                    -{formatCurrency(ch.fee || Math.round((ch.count * 3000) * (ch.feeRate || 0) / 100))}
                  </td>
                  <td className="py-4 px-4 text-right text-maze-500 font-semibold">
                    {formatCurrency(ch.netRevenue || (ch.count * 3000) - Math.round((ch.count * 3000) * (ch.feeRate || 0) / 100))}
                  </td>
                </tr>
              ))}
            </tbody>
            {/* 합계 행 */}
            <tfoot>
              <tr className="border-t-2 border-dashboard-border bg-dashboard-bg/50">
                <td className="py-4 px-4 font-bold text-dashboard-text">합계</td>
                <td className="py-4 px-4 text-right font-bold text-dashboard-text">
                  {formatNumber(channelTotals.count)}명
                </td>
                <td className="py-4 px-4 text-right text-dashboard-muted">-</td>
                <td className="py-4 px-4 text-right font-bold text-dashboard-text">
                  {formatCurrency(channelTotals.revenue || channelTotals.count * 3000)}
                </td>
                <td className="py-4 px-4 text-right font-bold text-red-400">
                  -{formatCurrency(channelTotals.fee || summary.totalFee)}
                </td>
                <td className="py-4 px-4 text-right font-bold text-maze-500">
                  {formatCurrency(channelTotals.netRevenue || summary.totalRevenue)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      {/* 구분별 현장 판매 현황 */}
      <Card>
        <CardHeader title="구분별 현장 판매 현황" />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-dashboard-border">
                <th className="text-left py-3 px-4 text-sm font-semibold text-dashboard-muted">구분</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-dashboard-muted">판매수</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-dashboard-muted">매출</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-dashboard-muted">비율</th>
              </tr>
            </thead>
            <tbody>
              {categories?.map((cat: any) => {
                const catRevenue = cat.revenue || cat.count * 3000
                return (
                  <tr key={cat.code} className="border-b border-dashboard-border/50 hover:bg-dashboard-border/30">
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: getCategoryColor(cat.code) }}
                        />
                        <span className="text-dashboard-text">{cat.name}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-right text-dashboard-text">
                      {formatNumber(cat.count)}명
                    </td>
                    <td className="py-4 px-4 text-right text-dashboard-text">
                      {formatCurrency(catRevenue)}
                    </td>
                    <td className="py-4 px-4 text-right text-blue-500">
                      {categoryTotals.count > 0 ? ((cat.count / categoryTotals.count) * 100).toFixed(1) : 0}%
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-dashboard-border bg-dashboard-bg/50">
                <td className="py-4 px-4 font-bold text-dashboard-text">합계</td>
                <td className="py-4 px-4 text-right font-bold text-dashboard-text">
                  {formatNumber(categoryTotals.count)}명
                </td>
                <td className="py-4 px-4 text-right font-bold text-maze-500">
                  {formatCurrency(categoryTotals.revenue)}
                </td>
                <td className="py-4 px-4 text-right font-bold text-blue-500">100%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      {/* SKP 계정에서만 매출 상세 표시 (최하단 배치) */}
      {isSkpUser && (
        <Card>
          <CardHeader title="디지털프로그램 매출 상세" description="SKP 매출 및 비용 내역" />
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 bg-dashboard-bg rounded-lg">
              <p className="text-sm text-dashboard-muted">디지털프로그램 매출</p>
              <p className="text-xl font-bold text-maze-500 mt-1">
                {formatCurrency(summary.totalRevenue)}
              </p>
              <p className="text-xs text-dashboard-muted mt-1">수수료 제외</p>
            </div>
            <div className="text-center p-4 bg-dashboard-bg rounded-lg">
              <p className="text-sm text-dashboard-muted">채널 수수료 합계</p>
              <p className="text-xl font-bold text-orange-500 mt-1">
                {formatCurrency(summary.totalFee)}
              </p>
              <p className="text-xs text-dashboard-muted mt-1">이미 차감됨</p>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}

// 카테고리별 색상
function getCategoryColor(code: string): string {
  const colors: Record<string, string> = {
    INDIVIDUAL: '#3b82f6',
    TRAVEL_AGENCY: '#8b5cf6',
    TAXI: '#f59e0b',
    RESIDENT: '#22c55e',
    ALL_PASS: '#ec4899',
    SHUTTLE_DISCOUNT: '#06b6d4',
    SCHOOL_GROUP: '#f97316',
  }
  return colors[code] || CHANNEL_COLORS[colorIndex++ % CHANNEL_COLORS.length]
}

// ==========================================
// 회사별 탭
// ==========================================
function CompanyTab({ data, userRole }: { data: any; userRole: Role }) {
  switch (userRole) {
    case 'SUPER_ADMIN':
    case 'SKP_ADMIN':
      return <SkpDetailView data={data} />
    case 'MAZE_ADMIN':
      return <MazeDetailView data={data} />
    case 'CULTURE_ADMIN':
      return <CultureDetailView data={data} />
    case 'AGENCY_ADMIN':
      return <AgencyDetailView data={data} />
    default:
      return <div className="text-dashboard-muted">권한이 없습니다.</div>
  }
}

// SKP 상세 뷰
function SkpDetailView({ data }: { data: any }) {
  const { skpDetails, channelMargins, summary } = data

  if (!skpDetails) return null

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/30">
          <p className="text-sm text-blue-400">총 매출</p>
          <p className="text-2xl font-bold text-dashboard-text mt-1">
            {formatCurrency(skpDetails.grossRevenue)}
          </p>
        </Card>
        <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/30">
          <p className="text-sm text-red-400">채널 수수료</p>
          <p className="text-2xl font-bold text-red-500 mt-1">
            -{formatCurrency(skpDetails.channelFees)}
          </p>
        </Card>
        <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/30">
          <p className="text-sm text-orange-400">지급 비용</p>
          <p className="text-2xl font-bold text-orange-500 mt-1">
            -{formatCurrency(skpDetails.totalCost)}
          </p>
          <p className="text-xs text-dashboard-muted mt-1">
            메이즈 {formatCurrency(skpDetails.mazePayment)} + 컬처 {formatCurrency(skpDetails.culturePayment)} + FMC {formatCurrency(skpDetails.agencyPayment || 0)}
          </p>
        </Card>
        <Card className="bg-gradient-to-br from-maze-500/10 to-maze-600/5 border-maze-500/30">
          <p className="text-sm text-maze-400">SKP 이익</p>
          <p className="text-2xl font-bold text-maze-500 mt-1">
            {formatCurrency(skpDetails.profit)}
          </p>
          <p className="text-xs text-dashboard-muted mt-1">
            + 플랫폼 이용료 {formatCurrency(skpDetails.platformFeeIncome)}
          </p>
        </Card>
      </div>

      {/* 채널별 마진 */}
      <Card>
        <CardHeader title="채널별 마진율" description="수수료 차감 후 순매출 기준" />
        <div className="space-y-4">
          {channelMargins?.map((ch: any) => (
            <div key={ch.name} className="flex items-center gap-4">
              <div className="w-40 text-sm text-dashboard-text">{ch.name}</div>
              <div className="flex-1">
                <div className="h-6 bg-dashboard-border rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-maze-500 to-maze-400 rounded-full flex items-center justify-end pr-2"
                    style={{ width: `${ch.margin}%` }}
                  >
                    <span className="text-xs text-white font-medium">{ch.margin}%</span>
                  </div>
                </div>
              </div>
              <div className="w-32 text-right text-sm text-dashboard-muted">
                {formatCurrency(ch.netRevenue)}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* 자금 흐름도 */}
      <Card>
        <CardHeader title="정산 자금 흐름" description="수수료는 채널에서 사전 차감되어 SKP에 입금" />
        <div className="flex items-center justify-between flex-wrap gap-4 p-4 bg-dashboard-bg rounded-xl">
          <FlowBox title="SKP 수취" value={skpDetails.netRevenue} color="blue" subtitle="수수료 차감 후" />
          <FlowArrow />
          <FlowBox title="메이즈 지급" value={-skpDetails.mazePayment} color="orange" subtitle="1,000원/인 기준" />
          <FlowArrow />
          <FlowBox title="컬처 지급" value={-skpDetails.culturePayment} color="purple" subtitle="500원/인 기준" />
          <FlowArrow />
          <FlowBox title="FMC 지급" value={-(skpDetails.agencyPayment || 0)} color="red" subtitle="순이익의 20%" />
          <FlowArrow />
          <FlowBox title="플랫폼료 수입" value={skpDetails.platformFeeIncome} color="green" subtitle="컬처에서 200원/인" />
          <FlowArrow />
          <FlowBox title="SKP 이익" value={skpDetails.profit} color="maze" highlight />
        </div>
        <p className="text-xs text-dashboard-muted mt-3">
          * 채널 수수료 {formatCurrency(skpDetails.channelFees)}는 채널에서 사전 공제되어 SKP 계좌에 입금되지 않습니다.
        </p>
      </Card>
    </div>
  )
}

// 메이즈랜드 뷰
function MazeDetailView({ data }: { data: any }) {
  const { mazeDetails, summary, channels } = data

  if (!mazeDetails) return null

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-maze-500/10 to-maze-600/5 border-maze-500/30">
          <p className="text-sm text-maze-400">SKP로부터 수익</p>
          <p className="text-2xl font-bold text-dashboard-text mt-1">
            {formatCurrency(mazeDetails.revenue)}
          </p>
          <p className="text-xs text-dashboard-muted">1인당 1,000원 × {formatNumber(summary.totalVisitors)}명</p>
        </Card>
        <Card>
          <p className="text-sm text-dashboard-muted">컬처커넥션 지급</p>
          <p className="text-2xl font-bold text-orange-500 mt-1">
            -{formatCurrency(mazeDetails.culturePayment)}
          </p>
          <p className="text-xs text-dashboard-muted">1인당 500원</p>
        </Card>
        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/30">
          <p className="text-sm text-green-400">메이즈랜드 이익</p>
          <p className="text-2xl font-bold text-green-500 mt-1">
            {formatCurrency(mazeDetails.profit)}
          </p>
          <p className="text-xs text-dashboard-muted">이익률 {mazeDetails.profitRate}%</p>
        </Card>
        <Card>
          <p className="text-sm text-dashboard-muted">총 방문객</p>
          <p className="text-2xl font-bold text-dashboard-text mt-1">
            {formatNumber(summary.totalVisitors)}명
          </p>
          <p className="text-xs text-dashboard-muted">
            인터넷 {formatNumber(mazeDetails.visitorBreakdown?.online || 0)} / 현장 {formatNumber(mazeDetails.visitorBreakdown?.offline || 0)}
          </p>
        </Card>
      </div>

      {/* 채널별 방문객 */}
      <Card>
        <CardHeader title="인터넷 채널별 방문객" description="메이즈랜드 입장권 채널 분석" />
        <ChannelChart
          data={channels?.map((ch: any) => ({
            name: ch.name,
            value: ch.count,
            color: getChannelColor(ch.code),
          })) || []}
          height={300}
        />
      </Card>

      <Card className="border-yellow-500/30 bg-yellow-500/5">
        <p className="text-sm text-yellow-500">
          💡 SKP 및 컬처커넥션의 상세 손익 정보는 해당 회사 관리자만 조회할 수 있습니다.
        </p>
      </Card>
    </div>
  )
}

// 컬처커넥션 뷰
function CultureDetailView({ data }: { data: any }) {
  const { cultureDetails, summary } = data

  if (!cultureDetails) return null

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <p className="text-sm text-dashboard-muted">SKP로부터 수익</p>
          <p className="text-2xl font-bold text-blue-500 mt-1">
            {formatCurrency(cultureDetails.revenueFromSkp)}
          </p>
          <p className="text-xs text-dashboard-muted">1인당 500원</p>
        </Card>
        <Card>
          <p className="text-sm text-dashboard-muted">메이즈랜드로부터 수익</p>
          <p className="text-2xl font-bold text-maze-500 mt-1">
            {formatCurrency(cultureDetails.revenueFromMaze)}
          </p>
          <p className="text-xs text-dashboard-muted">1인당 500원</p>
        </Card>
        <Card>
          <p className="text-sm text-dashboard-muted">SKP 플랫폼료 지급</p>
          <p className="text-2xl font-bold text-orange-500 mt-1">
            -{formatCurrency(cultureDetails.platformFeePayout)}
          </p>
          <p className="text-xs text-dashboard-muted">1인당 200원</p>
        </Card>
        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/30">
          <p className="text-sm text-purple-400">컬처커넥션 이익</p>
          <p className="text-2xl font-bold text-purple-500 mt-1">
            {formatCurrency(cultureDetails.profit)}
          </p>
          <p className="text-xs text-dashboard-muted">이익률 {cultureDetails.profitRate}%</p>
        </Card>
      </div>

      <Card>
        <CardHeader title="수수료 흐름" />
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="p-4 bg-dashboard-bg rounded-lg">
            <p className="text-sm text-dashboard-muted">총 수익</p>
            <p className="text-xl font-bold text-dashboard-text">
              {formatCurrency(cultureDetails.totalRevenue)}
            </p>
            <p className="text-xs text-maze-500 mt-1">
              SKP + 메이즈랜드
            </p>
          </div>
          <div className="p-4 bg-dashboard-bg rounded-lg">
            <p className="text-sm text-dashboard-muted">플랫폼료 지급</p>
            <p className="text-xl font-bold text-orange-500">
              -{formatCurrency(cultureDetails.platformFeePayout)}
            </p>
            <p className="text-xs text-dashboard-muted mt-1">
              SKP에 지급
            </p>
          </div>
          <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
            <p className="text-sm text-purple-400">순이익</p>
            <p className="text-xl font-bold text-purple-500">
              {formatCurrency(cultureDetails.profit)}
            </p>
            <p className="text-xs text-dashboard-muted mt-1">
              1인당 800원
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}

// 운영대행사 뷰
function AgencyDetailView({ data }: { data: any }) {
  const { agencyDetails, summary, channels } = data

  if (!agencyDetails) return null

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/30">
          <p className="text-sm text-orange-400">운영대행 수수료</p>
          <p className="text-2xl font-bold text-orange-500 mt-1">
            {formatCurrency(agencyDetails.agencyFee)}
          </p>
          <p className="text-xs text-dashboard-muted mt-1">
            {agencyDetails.basedOn}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-dashboard-muted">총 방문객</p>
          <p className="text-2xl font-bold text-dashboard-text mt-1">
            {formatNumber(summary.totalVisitors)}명
          </p>
        </Card>
        <Card>
          <p className="text-sm text-dashboard-muted">일 평균 방문객</p>
          <p className="text-2xl font-bold text-dashboard-text mt-1">
            {formatNumber(Math.round(summary.totalVisitors / 23))}명
          </p>
        </Card>
      </div>

      {/* 주요 채널 성과 */}
      {agencyDetails.topChannels && (
        <Card>
          <CardHeader title="주요 채널 성과" description="인터넷 판매 상위 채널" />
          <div className="space-y-4">
            {agencyDetails.topChannels.map((ch: any, index: number) => (
              <div key={ch.name} className="flex items-center gap-4 p-4 bg-dashboard-bg rounded-lg">
                <div className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center font-bold',
                  index === 0 && 'bg-yellow-500 text-black',
                  index === 1 && 'bg-gray-400 text-black',
                  index === 2 && 'bg-orange-600 text-white',
                )}>
                  {index + 1}
                </div>
                <div className="flex-1">
                  <p className="text-dashboard-text font-medium">{ch.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-dashboard-text">{formatNumber(ch.count)}명</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="border-blue-500/30 bg-blue-500/5">
        <p className="text-sm text-blue-500">
          📊 운영대행 수수료는 SKP 순이익의 20%로 계산됩니다. 상세 정산 내역은 SKP 담당자에게 문의하세요.
        </p>
      </Card>
    </div>
  )
}

// ==========================================
// 채널/구분 분석 탭
// ==========================================
function ChannelsTab({ data }: { data: any }) {
  const { channels, categories } = data

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader title="채널별 인터넷 판매" description="수수료율 포함" />
          <ChannelChart
            data={channels?.map((ch: any) => ({
              name: ch.name,
              value: ch.count,
              color: getChannelColor(ch.code),
            })) || []}
            height={280}
          />
        </Card>

        <Card>
          <CardHeader title="구분별 현장 판매" />
          <ChannelChart
            data={categories?.map((cat: any) => ({
              name: cat.name,
              value: cat.count,
              color: getCategoryColor(cat.code),
            })) || []}
            height={280}
          />
        </Card>
      </div>

      <Card>
        <CardHeader title="채널별 상세 현황" />
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-dashboard-border">
                <th className="text-left py-3 px-4 text-sm font-semibold text-dashboard-muted">채널</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-dashboard-muted">인원</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-dashboard-muted">매출</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-dashboard-muted">수수료율</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-dashboard-muted">수수료</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-dashboard-muted">순매출</th>
              </tr>
            </thead>
            <tbody>
              {channels?.map((ch: any) => (
                <tr key={ch.code} className="border-b border-dashboard-border/50 hover:bg-dashboard-border/30">
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: getChannelColor(ch.code) }}
                      />
                      <span className="text-dashboard-text">{ch.name}</span>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-right text-dashboard-text">
                    {formatNumber(ch.count)}명
                  </td>
                  <td className="py-4 px-4 text-right text-dashboard-text">
                    {formatCurrency(ch.revenue)}
                  </td>
                  <td className="py-4 px-4 text-right">
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-500/20 text-orange-500">
                      {ch.feeRate}%
                    </span>
                  </td>
                  <td className="py-4 px-4 text-right text-red-500">
                    -{formatCurrency(ch.fee)}
                  </td>
                  <td className="py-4 px-4 text-right font-semibold text-maze-500">
                    {formatCurrency(ch.netRevenue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

// ==========================================
// 마케팅 로그 탭
// ==========================================
function MarketingTab({ data }: { data: any }) {
  const { marketingLogs = [], dailyTrend = [], prevDailyTrend = [] } = data
  const { year, month } = useDashboardStore()
  const yearMonth = `${year}-${String(month).padStart(2, '0')}`

  // 날짜 문자열에서 MM/DD 형식으로 변환 (그래프 매칭용)
  const formatDateToMD = (dateStr: string): string => {
    if (!dateStr) return ''
    const dateOnly = dateStr.split('T')[0]
    return dateOnly.slice(5).replace('-', '/')
  }

  // 사용자 표시용 M/D 형식
  const formatDateForDisplay = (dateStr: string): string => {
    if (!dateStr) return ''
    const dateOnly = dateStr.split('T')[0]
    const parts = dateOnly.split('-')
    if (parts.length >= 3) {
      const month = parseInt(parts[1], 10)
      const day = parseInt(parts[2], 10)
      return `${month}/${day}`
    }
    return dateOnly.slice(5).replace('-', '/')
  }

  const markers = (marketingLogs || []).map((log: any) => ({
    date: formatDateToMD(log.startDate || log.date || ''), // 그래프 매칭용
    endDate: formatDateToMD(log.endDate || ''),
    displayDate: formatDateForDisplay(log.startDate || log.date || ''), // 범례 표시용
    displayEndDate: formatDateForDisplay(log.endDate || ''),
    type: log.logType || log.type,
    title: log.subType || log.title,
  }))

  const getLogTypeColor = (type: string) => {
    switch (type) {
      case 'OKCASHBACK_PUSH': return 'bg-blue-500/20 text-blue-500 border-blue-500/30'
      case 'OKCASHBACK_BANNER': return 'bg-purple-500/20 text-purple-500 border-purple-500/30'
      default: return 'bg-gray-500/20 text-gray-500 border-gray-500/30'
    }
  }

  const getLogTypeName = (type: string) => {
    switch (type) {
      case 'OKCASHBACK_PUSH': return 'OK캐쉬백 푸쉬'
      case 'OKCASHBACK_BANNER': return 'OK캐쉬백 배너'
      default: return '기타'
    }
  }

  // 클릭율 계산
  const calculateClickRate = (clicks: number, impressions: number) => {
    if (!impressions || impressions === 0) return '0.00'
    return ((clicks / impressions) * 100).toFixed(2)
  }

  // 전체 통계
  const totalStats = (marketingLogs || []).reduce((acc: any, log: any) => ({
    impressions: acc.impressions + (log.impressions || 0),
    clicks: acc.clicks + (log.clicks || 0),
  }), { impressions: 0, clicks: 0 })

  return (
    <div className="space-y-6">
      {/* 통계 요약 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <div className="text-center">
            <p className="text-sm text-dashboard-muted">총 노출량</p>
            <p className="text-2xl font-bold text-dashboard-text mt-1">
              {formatNumber(totalStats.impressions)}
            </p>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <p className="text-sm text-dashboard-muted">총 클릭수</p>
            <p className="text-2xl font-bold text-dashboard-text mt-1">
              {formatNumber(totalStats.clicks)}
            </p>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <p className="text-sm text-dashboard-muted">평균 클릭율</p>
            <p className="text-2xl font-bold text-maze-500 mt-1">
              {calculateClickRate(totalStats.clicks, totalStats.impressions)}%
            </p>
          </div>
        </Card>
      </div>

      {/* 방문객 추이 차트 */}
      <Card>
        <CardHeader
          title="방문객 추이 & 마케팅 이벤트"
          description="그래프 위 마커(📌)가 마케팅 이벤트입니다"
        />
        <SalesChart
          data={(dailyTrend || []).map((d: any) => ({
            date: d.dateLabel,
            online: d.online,
            offline: d.offline,
            total: d.total,
          }))}
          prevData={(prevDailyTrend || []).map((d: any) => ({
            date: d.dateLabel,
            online: d.online,
            offline: d.offline,
            total: d.total,
          }))}
          markers={markers}
          height={350}
          yearMonth={yearMonth}
        />
      </Card>

      {/* 마케팅 로그 테이블 */}
      <Card>
        <CardHeader
          title="등록된 마케팅 로그"
          description="기간, 유형, 노출량, 클릭수, 클릭율"
          action={
            <a
              href="/marketing-log"
              className="text-sm text-maze-500 hover:text-maze-400 transition-colors"
            >
              전체 보기 →
            </a>
          }
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dashboard-border">
                <th className="text-left py-3 px-4 font-semibold text-dashboard-muted">기간</th>
                <th className="text-left py-3 px-4 font-semibold text-dashboard-muted">유형</th>
                <th className="text-left py-3 px-4 font-semibold text-dashboard-muted">세부</th>
                <th className="text-right py-3 px-4 font-semibold text-dashboard-muted">노출량</th>
                <th className="text-right py-3 px-4 font-semibold text-dashboard-muted">클릭수</th>
                <th className="text-right py-3 px-4 font-semibold text-dashboard-muted">클릭율</th>
              </tr>
            </thead>
            <tbody>
              {(marketingLogs || []).length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-dashboard-muted">
                    등록된 마케팅 로그가 없습니다.
                  </td>
                </tr>
              ) : (
                (marketingLogs || []).map((log: any) => (
                  <tr key={log.id} className="border-b border-dashboard-border/50 hover:bg-dashboard-border/30">
                    <td className="py-3 px-4 text-dashboard-text">
                      {log.startDate && log.endDate 
                        ? `${formatDateToMD(log.startDate)} ~ ${formatDateToMD(log.endDate)}`
                        : formatDateToMD(log.date) || '-'}
                    </td>
                    <td className="py-3 px-4">
                      <span className={cn(
                        'px-2 py-1 rounded text-xs',
                        getLogTypeColor(log.logType || log.type)
                      )}>
                        {getLogTypeName(log.logType || log.type)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-dashboard-text">
                      {log.subType || log.title || '-'}
                    </td>
                    <td className="py-3 px-4 text-right text-dashboard-text">
                      {formatNumber(log.impressions || 0)}
                    </td>
                    <td className="py-3 px-4 text-right text-dashboard-text">
                      {formatNumber(log.clicks || 0)}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-maze-500">
                      {calculateClickRate(log.clicks || 0, log.impressions || 0)}%
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

// ==========================================
// 유틸리티 컴포넌트
// ==========================================
function FlowBox({ title, value, color, highlight, subtitle }: { title: string; value: number; color: string; highlight?: boolean; subtitle?: string }) {
  const colorClass = {
    blue: 'border-blue-500/30 bg-blue-500/10',
    red: 'border-red-500/30 bg-red-500/10',
    orange: 'border-orange-500/30 bg-orange-500/10',
    purple: 'border-purple-500/30 bg-purple-500/10',
    green: 'border-green-500/30 bg-green-500/10',
    maze: 'border-maze-500/30 bg-maze-500/10',
  }[color] || ''

  return (
    <div className={cn(
      'px-4 py-3 rounded-lg border text-center min-w-[100px]',
      colorClass,
      highlight && 'ring-2 ring-maze-500'
    )}>
      <p className="text-xs text-dashboard-muted">{title}</p>
      <p className={cn(
        'text-sm font-bold mt-1',
        value >= 0 ? 'text-dashboard-text' : 'text-red-500'
      )}>
        {formatCurrency(Math.abs(value))}
      </p>
      {subtitle && <p className="text-[10px] text-dashboard-muted mt-0.5">{subtitle}</p>}
    </div>
  )
}

function FlowArrow() {
  return (
    <div className="text-dashboard-muted">
      <ArrowUpRight className="w-5 h-5" />
    </div>
  )
}

// 채널별 색상 (동적으로 생성)
const CHANNEL_COLORS = [
  '#22c55e', // green
  '#3b82f6', // blue
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
  '#84cc16', // lime
  '#14b8a6', // teal
  '#6366f1', // indigo
  '#a855f7', // purple
]

const channelColorMap: Record<string, string> = {}
let colorIndex = 0

function getChannelColor(code: string): string {
  if (!channelColorMap[code]) {
    channelColorMap[code] = CHANNEL_COLORS[colorIndex % CHANNEL_COLORS.length]
    colorIndex++
  }
  return channelColorMap[code]
}
