'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card, CardHeader, Button } from '@/components/ui'
import { formatNumber, formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'
import {
  Globe,
  MapPin,
  Save,
  RefreshCw,
  Calculator,
  DollarSign,
  Users,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react'

// 로컬 타입 정의
type DataSource = 'file' | 'manual' | 'mixed'

interface ChannelMaster {
  code: string
  name: string
  feeRate: number
  order: number
  active: boolean
}

interface CategoryMaster {
  code: string
  name: string
  order: number
  active: boolean
}

interface InternetSaleInput {
  channelCode: string
  count: number
}

interface OnsiteSaleInput {
  categoryCode: string
  count: number
}

// ==========================================
// 타입 정의
// ==========================================

interface ManualInputFormProps {
  year: number
  month: number
  source: DataSource
  channels: ChannelMaster[]
  categories: CategoryMaster[]
  initialInternetSales?: InternetSaleInput[]
  initialOnsiteSales?: OnsiteSaleInput[]
  onSave: (data: {
    internetSales: InternetSaleInput[]
    onsiteSales: OnsiteSaleInput[]
    source: DataSource
  }) => Promise<void>
  isLoading?: boolean
}

type TabType = 'internet' | 'onsite'

const BASE_PRICE = 3000
const MAZE_UNIT = 1000
const CULTURE_UNIT = 1000
const PLATFORM_FEE_UNIT = 200
const AGENCY_RATE = 0.20

// ==========================================
// 메인 컴포넌트
// ==========================================

export function ManualInputForm({
  year,
  month,
  source,
  channels,
  categories,
  initialInternetSales,
  initialOnsiteSales,
  onSave,
  isLoading = false,
}: ManualInputFormProps) {
  const [activeTab, setActiveTab] = useState<TabType>('internet')
  const [isSaving, setIsSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  // 인터넷 판매 데이터
  const [internetSales, setInternetSales] = useState<InternetSaleInput[]>(() =>
    channels.map(ch => ({
      channelCode: ch.code,
      count: initialInternetSales?.find(s => s.channelCode === ch.code)?.count || 0,
    }))
  )

  // 현장 판매 데이터
  const [onsiteSales, setOnsiteSales] = useState<OnsiteSaleInput[]>(() =>
    categories.map(cat => ({
      categoryCode: cat.code,
      count: initialOnsiteSales?.find(s => s.categoryCode === cat.code)?.count || 0,
    }))
  )

  // 초기 데이터가 변경되면 업데이트
  useEffect(() => {
    if (initialInternetSales) {
      setInternetSales(
        channels.map(ch => ({
          channelCode: ch.code,
          count: initialInternetSales.find(s => s.channelCode === ch.code)?.count || 0,
        }))
      )
    }
  }, [initialInternetSales, channels])

  useEffect(() => {
    if (initialOnsiteSales) {
      setOnsiteSales(
        categories.map(cat => ({
          categoryCode: cat.code,
          count: initialOnsiteSales.find(s => s.categoryCode === cat.code)?.count || 0,
        }))
      )
    }
  }, [initialOnsiteSales, categories])

  // 인터넷 판매 합계
  const internetTotals = useMemo(() => {
    let totalCount = 0
    let grossRevenue = 0
    let fee = 0
    let netRevenue = 0

    for (const sale of internetSales) {
      const channel = channels.find(ch => ch.code === sale.channelCode)
      if (!channel) continue

      const count = sale.count || 0
      const feeRate = channel.feeRate / 100
      const gross = BASE_PRICE * count
      const f = Math.round(gross * feeRate)
      const net = gross - f

      totalCount += count
      grossRevenue += gross
      fee += f
      netRevenue += net
    }

    return { totalCount, grossRevenue, fee, netRevenue }
  }, [internetSales, channels])

  // 현장 판매 합계
  const onsiteTotals = useMemo(() => {
    const totalCount = onsiteSales.reduce((sum, s) => sum + (s.count || 0), 0)
    const revenue = totalCount * BASE_PRICE

    return { totalCount, revenue }
  }, [onsiteSales])

  // 전체 합계 및 정산 미리보기
  const calculatedSettlement = useMemo(() => {
    const totalCount = internetTotals.totalCount + onsiteTotals.totalCount
    const skpTicketRevenue = internetTotals.netRevenue + onsiteTotals.revenue

    // 메이즈랜드/컬처커넥션 (1,000원 기준, 동일 수수료율)
    let mazeOnlineNet = 0
    let cultureOnlineNet = 0
    let platformFeeOnline = 0

    for (const sale of internetSales) {
      const channel = channels.find(ch => ch.code === sale.channelCode)
      if (!channel) continue

      const feeRate = channel.feeRate / 100
      const count = sale.count || 0
      mazeOnlineNet += Math.round(MAZE_UNIT * (1 - feeRate) * count)
      cultureOnlineNet += Math.round(CULTURE_UNIT * (1 - feeRate) * count)
      platformFeeOnline += Math.round(PLATFORM_FEE_UNIT * (1 - feeRate) * count)
    }

    const mazeOffline = MAZE_UNIT * onsiteTotals.totalCount
    const cultureOffline = CULTURE_UNIT * onsiteTotals.totalCount
    const platformFeeOffline = PLATFORM_FEE_UNIT * onsiteTotals.totalCount

    const mazeRevenue = mazeOnlineNet + mazeOffline
    const cultureGrossRevenue = cultureOnlineNet + cultureOffline
    const totalPlatformFee = platformFeeOnline + platformFeeOffline

    // FMC 수수료
    const skpNetBeforeAgency = skpTicketRevenue - mazeRevenue - cultureGrossRevenue
    const agencyRevenue = Math.round(skpNetBeforeAgency * AGENCY_RATE)

    // 컬처커넥션 이익 (플랫폼료 차감)
    const cultureProfit = cultureGrossRevenue - totalPlatformFee

    // SKP 이익 (플랫폼료 수입 추가)
    const skpTotalIncome = skpTicketRevenue + totalPlatformFee
    const skpCost = mazeRevenue + cultureGrossRevenue + agencyRevenue
    const skpProfit = skpTotalIncome - skpCost

    return {
      totalCount,
      skpRevenue: skpTicketRevenue,
      skpProfit,
      mazeRevenue,
      cultureGrossRevenue,
      cultureProfit,
      agencyRevenue,
      platformFee: totalPlatformFee,
    }
  }, [internetSales, internetTotals, onsiteTotals, channels])

  // 인터넷 판매 수정
  const handleInternetChange = (channelCode: string, count: number) => {
    setInternetSales(prev =>
      prev.map(s =>
        s.channelCode === channelCode ? { ...s, count: Math.max(0, count) } : s
      )
    )
    setHasChanges(true)
  }

  // 현장 판매 수정
  const handleOnsiteChange = (categoryCode: string, count: number) => {
    setOnsiteSales(prev =>
      prev.map(s =>
        s.categoryCode === categoryCode ? { ...s, count: Math.max(0, count) } : s
      )
    )
    setHasChanges(true)
  }

  // 저장
  const handleSave = async () => {
    setIsSaving(true)
    try {
      await onSave({
        internetSales,
        onsiteSales,
        source: hasChanges && source === 'file' ? 'mixed' : source,
      })
      setHasChanges(false)
    } finally {
      setIsSaving(false)
    }
  }

  // 초기화
  const handleReset = () => {
    setInternetSales(
      channels.map(ch => ({
        channelCode: ch.code,
        count: initialInternetSales?.find(s => s.channelCode === ch.code)?.count || 0,
      }))
    )
    setOnsiteSales(
      categories.map(cat => ({
        categoryCode: cat.code,
        count: initialOnsiteSales?.find(s => s.categoryCode === cat.code)?.count || 0,
      }))
    )
    setHasChanges(false)
  }

  const tabs = [
    { id: 'internet' as const, label: '인터넷 판매', icon: Globe, count: internetTotals.totalCount },
    { id: 'onsite' as const, label: '현장 판매', icon: MapPin, count: onsiteTotals.totalCount },
  ]

  return (
    <div className="space-y-6">
      {/* 탭 네비게이션 */}
      <div className="flex gap-2 p-1 bg-dashboard-bg rounded-lg">
        {tabs.map(tab => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-all',
                activeTab === tab.id
                  ? 'bg-dashboard-card text-maze-500 shadow-sm'
                  : 'text-dashboard-muted hover:text-dashboard-text'
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium">{tab.label}</span>
              <span className={cn(
                'px-2 py-0.5 rounded-full text-xs font-bold',
                activeTab === tab.id
                  ? 'bg-maze-500/20 text-maze-500'
                  : 'bg-dashboard-border text-dashboard-muted'
              )}>
                {formatNumber(tab.count)}
              </span>
            </button>
          )
        })}
      </div>

      {/* 인터넷 판매 입력 */}
      {activeTab === 'internet' && (
        <Card>
          <CardHeader
            title="인터넷 판매 (채널별)"
            description="각 채널의 판매 건수를 입력하세요. 수수료율은 자동 적용됩니다."
          />
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dashboard-border">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-dashboard-muted">채널명</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-dashboard-muted">수수료율</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-dashboard-muted">건수</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-dashboard-muted">총 매출</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-dashboard-muted">수수료</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-maze-500">순매출</th>
                </tr>
              </thead>
              <tbody>
                {internetSales.map((sale, index) => {
                  const channel = channels.find(ch => ch.code === sale.channelCode)
                  if (!channel) return null

                  const count = sale.count || 0
                  const feeRate = channel.feeRate / 100
                  const gross = BASE_PRICE * count
                  const fee = Math.round(gross * feeRate)
                  const net = gross - fee

                  return (
                    <tr key={sale.channelCode} className="border-b border-dashboard-border/50 hover:bg-dashboard-bg/50">
                      <td className="py-3 px-4">
                        <span className="text-dashboard-text font-medium">{channel.name}</span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-500/20 text-orange-500">
                          {channel.feeRate}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <input
                          type="number"
                          value={count || ''}
                          onChange={(e) => handleInternetChange(channel.code, parseInt(e.target.value) || 0)}
                          placeholder="0"
                          className="w-24 bg-dashboard-card border border-dashboard-border hover:border-maze-500 focus:border-maze-500 rounded px-3 py-1.5 text-right text-dashboard-text font-medium focus:outline-none"
                        />
                      </td>
                      <td className="py-3 px-4 text-right text-dashboard-muted">
                        {formatCurrency(gross)}
                      </td>
                      <td className="py-3 px-4 text-right text-orange-500">
                        -{formatCurrency(fee)}
                      </td>
                      <td className="py-3 px-4 text-right text-maze-500 font-semibold">
                        {formatCurrency(net)}
                      </td>
                    </tr>
                  )
                })}
                {/* 합계 행 */}
                <tr className="bg-maze-500/10 font-bold">
                  <td className="py-4 px-4 text-dashboard-text">합계</td>
                  <td className="py-4 px-4"></td>
                  <td className="py-4 px-4 text-right text-dashboard-text">
                    {formatNumber(internetTotals.totalCount)}명
                  </td>
                  <td className="py-4 px-4 text-right text-dashboard-muted">
                    {formatCurrency(internetTotals.grossRevenue)}
                  </td>
                  <td className="py-4 px-4 text-right text-orange-500">
                    -{formatCurrency(internetTotals.fee)}
                  </td>
                  <td className="py-4 px-4 text-right text-maze-500">
                    {formatCurrency(internetTotals.netRevenue)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* 현장 판매 입력 */}
      {activeTab === 'onsite' && (
        <Card>
          <CardHeader
            title="현장 판매 (구분별)"
            description="각 구분의 판매 건수를 입력하세요. 현장 판매는 수수료가 없습니다."
          />
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dashboard-border">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-dashboard-muted">구분</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-dashboard-muted">건수</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-blue-500">매출</th>
                </tr>
              </thead>
              <tbody>
                {onsiteSales.map((sale, index) => {
                  const category = categories.find(cat => cat.code === sale.categoryCode)
                  if (!category) return null

                  const count = sale.count || 0
                  const revenue = BASE_PRICE * count

                  return (
                    <tr key={sale.categoryCode} className="border-b border-dashboard-border/50 hover:bg-dashboard-bg/50">
                      <td className="py-3 px-4">
                        <span className="text-dashboard-text font-medium">{category.name}</span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <input
                          type="number"
                          value={count || ''}
                          onChange={(e) => handleOnsiteChange(category.code, parseInt(e.target.value) || 0)}
                          placeholder="0"
                          className="w-24 bg-dashboard-card border border-dashboard-border hover:border-blue-500 focus:border-blue-500 rounded px-3 py-1.5 text-right text-dashboard-text font-medium focus:outline-none"
                        />
                      </td>
                      <td className="py-3 px-4 text-right text-blue-500 font-semibold">
                        {formatCurrency(revenue)}
                      </td>
                    </tr>
                  )
                })}
                {/* 합계 행 */}
                <tr className="bg-blue-500/10 font-bold">
                  <td className="py-4 px-4 text-dashboard-text">합계</td>
                  <td className="py-4 px-4 text-right text-dashboard-text">
                    {formatNumber(onsiteTotals.totalCount)}명
                  </td>
                  <td className="py-4 px-4 text-right text-blue-500">
                    {formatCurrency(onsiteTotals.revenue)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* 요약 및 정산 미리보기 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 요약 카드 */}
        <Card>
          <CardHeader title="입력 요약" />
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 bg-dashboard-bg rounded-lg">
              <Users className="w-6 h-6 text-dashboard-muted mx-auto mb-2" />
              <p className="text-sm text-dashboard-muted">전체 인원</p>
              <p className="text-2xl font-bold text-dashboard-text">
                {formatNumber(calculatedSettlement.totalCount)}명
              </p>
            </div>
            <div className="text-center p-4 bg-dashboard-bg rounded-lg">
              <DollarSign className="w-6 h-6 text-maze-500 mx-auto mb-2" />
              <p className="text-sm text-dashboard-muted">SKP 매출</p>
              <p className="text-2xl font-bold text-maze-500">
                {formatCurrency(calculatedSettlement.skpRevenue)}
              </p>
            </div>
          </div>
          <div className="mt-4 p-3 bg-dashboard-bg rounded-lg">
            <div className="flex items-center justify-between text-sm">
              <span className="text-dashboard-muted">인터넷 ({internetTotals.totalCount}명)</span>
              <span className="text-maze-500 font-medium">{formatCurrency(internetTotals.netRevenue)}</span>
            </div>
            <div className="flex items-center justify-between text-sm mt-2">
              <span className="text-dashboard-muted">현장 ({onsiteTotals.totalCount}명)</span>
              <span className="text-blue-500 font-medium">{formatCurrency(onsiteTotals.revenue)}</span>
            </div>
          </div>
        </Card>

        {/* 정산 미리보기 */}
        <Card>
          <CardHeader title="정산 미리보기" />
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-blue-500/10 rounded-lg">
              <span className="text-dashboard-text font-medium">SKP</span>
              <div className="text-right">
                <p className="text-dashboard-muted text-xs">매출 {formatCurrency(calculatedSettlement.skpRevenue)}</p>
                <p className="text-blue-500 font-semibold">이익 {formatCurrency(calculatedSettlement.skpProfit)}</p>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 bg-maze-500/10 rounded-lg">
              <span className="text-dashboard-text font-medium">메이즈랜드</span>
              <span className="text-maze-500 font-semibold">{formatCurrency(calculatedSettlement.mazeRevenue)}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-purple-500/10 rounded-lg">
              <span className="text-dashboard-text font-medium">컬처커넥션</span>
              <div className="text-right">
                <p className="text-dashboard-muted text-xs">매출 {formatCurrency(calculatedSettlement.cultureGrossRevenue)}</p>
                <p className="text-purple-500 font-semibold">이익 {formatCurrency(calculatedSettlement.cultureProfit)}</p>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 bg-orange-500/10 rounded-lg">
              <span className="text-dashboard-text font-medium">FMC</span>
              <span className="text-orange-500 font-semibold">{formatCurrency(calculatedSettlement.agencyRevenue)}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* 액션 버튼 */}
      <div className="flex items-center justify-between p-4 bg-dashboard-card rounded-xl border border-dashboard-border">
        <div className="flex items-center gap-3">
          {hasChanges ? (
            <span className="flex items-center gap-2 text-orange-500 text-sm">
              <AlertCircle className="w-4 h-4" />
              저장되지 않은 변경사항이 있습니다.
            </span>
          ) : (
            <span className="flex items-center gap-2 text-dashboard-muted text-sm">
              <CheckCircle2 className="w-4 h-4" />
              모든 변경사항이 저장되었습니다.
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={!hasChanges || isSaving}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            초기화
          </Button>
          <Button
            onClick={handleSave}
            isLoading={isSaving}
            disabled={isSaving}
          >
            <Save className="w-4 h-4 mr-2" />
            데이터 저장
          </Button>
        </div>
      </div>
    </div>
  )
}

