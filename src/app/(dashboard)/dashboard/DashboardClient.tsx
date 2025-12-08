'use client'

import { useState, useEffect, useCallback } from 'react'
import { Role } from '@prisma/client'
import { Card, CardHeader, StatCard } from '@/components/ui'
import { SalesChart, ChannelChart, SettlementTable } from '@/components/charts'
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

// 탭 정의
type TabType = 'overview' | 'company' | 'channels' | 'marketing'

interface DashboardClientProps {
  userRole: Role
  companyCode?: string
}

export function DashboardClient({ userRole, companyCode }: DashboardClientProps) {
  const [activeTab, setActiveTab] = useState<TabType>('overview')
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

  // 탭 목록 (역할에 따라 다름)
  const tabs = [
    { id: 'overview' as const, label: '전체 현황', icon: BarChart3 },
    { id: 'company' as const, label: getCompanyTabLabel(userRole), icon: Building2 },
    { id: 'channels' as const, label: '채널/구분 분석', icon: PieChart },
    { id: 'marketing' as const, label: '마케팅 로그', icon: Sparkles },
  ]

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

      {/* 탭 네비게이션 */}
      <div className="flex gap-2 border-b border-dashboard-border pb-4">
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg transition-all',
                activeTab === tab.id
                  ? 'bg-maze-500 text-white'
                  : 'text-dashboard-muted hover:bg-dashboard-card hover:text-dashboard-text'
              )}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* 탭 콘텐츠 */}
      {activeTab === 'overview' && <OverviewTab data={data} userRole={userRole} />}
      {activeTab === 'company' && <CompanyTab data={data} userRole={userRole} />}
      {activeTab === 'channels' && <ChannelsTab data={data} />}
      {activeTab === 'marketing' && <MarketingTab data={data} />}
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
// 전체 현황 탭
// ==========================================
function OverviewTab({ data, userRole }: { data: any; userRole: Role }) {
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
  const settlement = Array.isArray(rawData.settlement) ? rawData.settlement : []
  const comparison = rawData.comparison || null

  // 마케팅 로그를 차트 마커 형식으로 변환
  const markers = (marketingLogs || []).map((log: any) => ({
    date: log.date.slice(5).replace('-', '/'),
    type: log.type,
    title: log.title,
  }))

  return (
    <div className="space-y-6">
      {/* KPI 카드 (전월비 표시) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
        <KpiCard
          title="SKP 매출"
          value={formatCurrency(summary.totalRevenue)}
          comparison={comparison?.totalRevenue}
          icon={<DollarSign className="w-6 h-6" />}
          subtitle="수수료 제외"
        />
      </div>

      {/* 인터넷/현장 비율 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

        <Card>
          <CardHeader title="매출 상세" />
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 bg-dashboard-bg rounded-lg">
              <p className="text-sm text-dashboard-muted">SKP 매출</p>
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
      </div>

      {/* 일별 추이 그래프 */}
      <Card>
        <CardHeader
          title="일별 방문객 추이"
          description="인터넷/현장 판매 구분 및 마케팅 이벤트 표시"
        />
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
        />
      </Card>

      {/* 회사별 정산 요약 */}
      <Card>
        <CardHeader
          title="회사별 정산 현황"
          description="월 누적 기준"
        />
        <SettlementTable
          data={settlement.map((s: any) => ({
            companyName: s.companyName,
            companyCode: s.companyCode,
            revenue: typeof s.revenue === 'number' ? s.revenue : 0,
            income: typeof s.income === 'number' ? s.income : 0,
            cost: typeof s.cost === 'number' ? s.cost : 0,
            profit: typeof s.profit === 'number' ? s.profit : 0,
            profitRate: typeof s.profitRate === 'number' ? s.profitRate : 0,
          }))}
          showDetails={userRole === 'SUPER_ADMIN' || userRole === 'SKP_ADMIN'}
        />
      </Card>
    </div>
  )
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

  const markers = (marketingLogs || []).map((log: any) => ({
    date: log.date.slice(5).replace('-', '/'),
    type: log.type,
    title: log.title,
  }))

  const getLogTypeColor = (type: string) => {
    switch (type) {
      case 'CAMPAIGN': return 'bg-blue-500/20 text-blue-500 border-blue-500/30'
      case 'WEATHER': return 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30'
      case 'EVENT': return 'bg-purple-500/20 text-purple-500 border-purple-500/30'
      case 'MAINTENANCE': return 'bg-orange-500/20 text-orange-500 border-orange-500/30'
      default: return 'bg-gray-500/20 text-gray-500 border-gray-500/30'
    }
  }

  const getLogTypeName = (type: string) => {
    switch (type) {
      case 'CAMPAIGN': return '캠페인'
      case 'WEATHER': return '날씨'
      case 'EVENT': return '행사'
      case 'MAINTENANCE': return '공사/점검'
      default: return '기타'
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="마케팅 이벤트 타임라인"
          description="그래프 위 마커(📌)가 마케팅/이슈 이벤트입니다"
        />
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
        />
      </Card>

      <Card>
        <CardHeader
          title="등록된 마케팅 로그"
          description="날짜, 유형, 내용"
          action={
            <a
              href="/marketing-log"
              className="text-sm text-maze-500 hover:text-maze-400 transition-colors"
            >
              전체 보기 →
            </a>
          }
        />
        <div className="space-y-3">
          {(marketingLogs || []).map((log: any) => (
            <div
              key={log.id}
              className={cn(
                'p-4 rounded-lg border',
                getLogTypeColor(log.type)
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium">{log.date}</span>
                  <span className={cn(
                    'px-2 py-0.5 rounded text-xs',
                    getLogTypeColor(log.type)
                  )}>
                    {getLogTypeName(log.type)}
                  </span>
                </div>
              </div>
              <p className="mt-2 font-medium">{log.title}</p>
              {log.content && (
                <p className="mt-1 text-sm opacity-80">{log.content}</p>
              )}
            </div>
          ))}
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

function getChannelColor(code: string): string {
  const colors: Record<string, string> = {
    NAVER_MAZE_25: '#22c55e',
    MAZE_TICKET: '#3b82f6',
    MAZE_TICKET_SINGLE: '#f59e0b',
    GENERAL_TICKET: '#ef4444',
    OTHER: '#8b5cf6',
  }
  return colors[code] || '#6b7280'
}

function getCategoryColor(code: string): string {
  const colors: Record<string, string> = {
    INDIVIDUAL: '#22c55e',
    TRAVEL_AGENCY: '#3b82f6',
    TAXI: '#f59e0b',
    RESIDENT: '#8b5cf6',
    ALL_PASS: '#ec4899',
  }
  return colors[code] || '#6b7280'
}
