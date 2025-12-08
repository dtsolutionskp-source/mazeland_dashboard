'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Card, CardHeader, Button } from '@/components/ui'
import { formatNumber, formatCurrency, cn } from '@/lib/utils'
import { 
  ChannelMaster, 
  CategoryMaster, 
  DataSource,
  InputMode,
} from '@/types/sales-data'

// ManualInputForm 전용 간소화 타입
interface ChannelSalesData {
  channelCode: string
  channelName: string
  feeRate: number
  count: number
  grossRevenue?: number
  fee?: number
  netRevenue?: number
}

interface CategorySalesData {
  categoryCode: string
  categoryName: string
  count: number
  revenue?: number
}

interface SimpleMonthlyData {
  year: number
  month: number
  source: DataSource
  uploadedAt: string
  channels: ChannelSalesData[]
  categories: CategorySalesData[]
  summary: {
    onlineCount: number
    offlineCount: number
    totalCount: number
    onlineRevenue: number
    onlineFee: number
    onlineNetRevenue: number
    offlineRevenue: number
    totalRevenue: number
    totalNetRevenue: number
  }
  dailyData?: any[]
}
import {
  Save,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Globe,
  MapPin,
  Calculator,
} from 'lucide-react'

const BASE_PRICE = 3000

interface ManualInputFormProps {
  year: number
  month: number
  mode: InputMode
  masterChannels: ChannelMaster[]
  masterCategories: CategoryMaster[]
  initialData?: SimpleMonthlyData | null
  onSave: (data: { 
    channels: ChannelSalesData[]
    categories: CategorySalesData[]
    source: DataSource 
  }) => Promise<void>
  isSaving?: boolean
}

type TabType = 'internet' | 'onsite'

export function ManualInputForm({
  year,
  month,
  mode,
  masterChannels,
  masterCategories,
  initialData,
  onSave,
  isSaving = false,
}: ManualInputFormProps) {
  const [activeTab, setActiveTab] = useState<TabType>('internet')
  
  // 채널별 입력 데이터
  const [channelInputs, setChannelInputs] = useState<Record<string, number>>({})
  
  // 카테고리별 입력 데이터
  const [categoryInputs, setCategoryInputs] = useState<Record<string, number>>({})
  
  // 초기 데이터 로드
  useEffect(() => {
    if (initialData) {
      // 채널 데이터 초기화
      const channels: Record<string, number> = {}
      for (const ch of initialData.channels) {
        channels[ch.channelCode] = ch.count
      }
      setChannelInputs(channels)

      // 카테고리 데이터 초기화
      const categories: Record<string, number> = {}
      for (const cat of initialData.categories) {
        categories[cat.categoryCode] = cat.count
      }
      setCategoryInputs(categories)
    } else {
      // 마스터 데이터 기반으로 빈 값 초기화
      const channels: Record<string, number> = {}
      for (const ch of masterChannels) {
        channels[ch.code] = 0
      }
      setChannelInputs(channels)

      const categories: Record<string, number> = {}
      for (const cat of masterCategories) {
        categories[cat.code] = 0
      }
      setCategoryInputs(categories)
    }
  }, [initialData, masterChannels, masterCategories])

  // 채널별 계산 데이터
  const channelData = useMemo(() => {
    return masterChannels.map(master => {
      const count = channelInputs[master.code] || 0
      const grossRevenue = BASE_PRICE * count
      const fee = Math.round(grossRevenue * master.feeRate / 100)
      const netRevenue = grossRevenue - fee

      return {
        channelCode: master.code,
        channelName: master.name,
        feeRate: master.feeRate,
        count,
        grossRevenue,
        fee,
        netRevenue,
      }
    })
  }, [masterChannels, channelInputs])

  // 카테고리별 계산 데이터
  const categoryData = useMemo(() => {
    return masterCategories.map(master => {
      const count = categoryInputs[master.code] || 0
      const revenue = BASE_PRICE * count

      return {
        categoryCode: master.code,
        categoryName: master.name,
        count,
        revenue,
      }
    })
  }, [masterCategories, categoryInputs])

  // 합계 계산
  const totals = useMemo(() => {
    const onlineCount = channelData.reduce((sum, ch) => sum + ch.count, 0)
    const onlineGross = channelData.reduce((sum, ch) => sum + ch.grossRevenue, 0)
    const onlineFee = channelData.reduce((sum, ch) => sum + ch.fee, 0)
    const onlineNet = channelData.reduce((sum, ch) => sum + ch.netRevenue, 0)

    const offlineCount = categoryData.reduce((sum, cat) => sum + cat.count, 0)
    const offlineRevenue = categoryData.reduce((sum, cat) => sum + cat.revenue, 0)

    return {
      onlineCount,
      onlineGross,
      onlineFee,
      onlineNet,
      offlineCount,
      offlineRevenue,
      totalCount: onlineCount + offlineCount,
      totalRevenue: onlineNet + offlineRevenue,
    }
  }, [channelData, categoryData])

  // 입력 핸들러
  const handleChannelChange = useCallback((code: string, value: number) => {
    setChannelInputs(prev => ({ ...prev, [code]: value }))
  }, [])

  const handleCategoryChange = useCallback((code: string, value: number) => {
    setCategoryInputs(prev => ({ ...prev, [code]: value }))
  }, [])

  // 저장 핸들러
  const handleSave = async () => {
    const source: DataSource = mode === 'manual' ? 'manual' : mode === 'mixed' ? 'mixed' : 'file'
    
    await onSave({
      channels: channelData,
      categories: categoryData,
      source,
    })
  }

  return (
    <div className="space-y-6">
      {/* 탭 네비게이션 */}
      <div className="flex gap-2 p-1 bg-dashboard-bg rounded-lg">
        <button
          onClick={() => setActiveTab('internet')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium transition-all',
            activeTab === 'internet'
              ? 'bg-maze-500 text-white shadow-lg'
              : 'text-dashboard-muted hover:text-dashboard-text hover:bg-dashboard-border/50'
          )}
        >
          <Globe className="w-4 h-4" />
          인터넷 판매
          <span className={cn(
            'px-2 py-0.5 rounded-full text-xs',
            activeTab === 'internet' ? 'bg-white/20' : 'bg-dashboard-border'
          )}>
            {formatNumber(totals.onlineCount)}명
          </span>
        </button>
        <button
          onClick={() => setActiveTab('onsite')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium transition-all',
            activeTab === 'onsite'
              ? 'bg-blue-500 text-white shadow-lg'
              : 'text-dashboard-muted hover:text-dashboard-text hover:bg-dashboard-border/50'
          )}
        >
          <MapPin className="w-4 h-4" />
          현장 판매
          <span className={cn(
            'px-2 py-0.5 rounded-full text-xs',
            activeTab === 'onsite' ? 'bg-white/20' : 'bg-dashboard-border'
          )}>
            {formatNumber(totals.offlineCount)}명
          </span>
        </button>
      </div>

      {/* 인터넷 판매 입력 */}
      {activeTab === 'internet' && (
        <Card>
          <CardHeader 
            title="채널별 인터넷 판매 입력" 
            description="채널별 판매 건수를 입력하세요. 금액은 자동 계산됩니다."
          />
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dashboard-border">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-dashboard-muted">채널명</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-dashboard-muted w-24">수수료율</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-maze-500 w-32">건수</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-dashboard-muted">총매출</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-orange-500">수수료</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-green-500">순매출</th>
                </tr>
              </thead>
              <tbody>
                {channelData.map(ch => (
                  <tr key={ch.channelCode} className="border-b border-dashboard-border/50">
                    <td className="py-4 px-4 text-dashboard-text">{ch.channelName}</td>
                    <td className="py-4 px-4 text-center">
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-500/20 text-orange-500">
                        {ch.feeRate}%
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <input
                        type="number"
                        min="0"
                        value={ch.count || ''}
                        onChange={(e) => handleChannelChange(ch.channelCode, parseInt(e.target.value) || 0)}
                        placeholder="0"
                        className="w-24 text-center bg-dashboard-bg border border-dashboard-border rounded-lg px-3 py-2 text-maze-500 font-semibold focus:outline-none focus:ring-2 focus:ring-maze-500 focus:border-transparent"
                      />
                    </td>
                    <td className="py-4 px-4 text-right text-dashboard-text">
                      {formatCurrency(ch.grossRevenue)}
                    </td>
                    <td className="py-4 px-4 text-right text-orange-500">
                      -{formatCurrency(ch.fee)}
                    </td>
                    <td className="py-4 px-4 text-right text-green-500 font-semibold">
                      {formatCurrency(ch.netRevenue)}
                    </td>
                  </tr>
                ))}
                {/* 합계 행 */}
                <tr className="bg-maze-500/5 font-bold">
                  <td className="py-4 px-4 text-dashboard-text">합계</td>
                  <td className="py-4 px-4"></td>
                  <td className="py-4 px-4 text-center text-maze-500">{formatNumber(totals.onlineCount)}명</td>
                  <td className="py-4 px-4 text-right text-dashboard-text">{formatCurrency(totals.onlineGross)}</td>
                  <td className="py-4 px-4 text-right text-orange-500">-{formatCurrency(totals.onlineFee)}</td>
                  <td className="py-4 px-4 text-right text-green-500">{formatCurrency(totals.onlineNet)}</td>
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
            title="구분별 현장 판매 입력" 
            description="구분별 판매 건수를 입력하세요. 금액은 자동 계산됩니다."
          />
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dashboard-border">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-dashboard-muted">구분</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-blue-500 w-32">건수</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-dashboard-muted">매출</th>
                </tr>
              </thead>
              <tbody>
                {categoryData.map(cat => (
                  <tr key={cat.categoryCode} className="border-b border-dashboard-border/50">
                    <td className="py-4 px-4 text-dashboard-text">{cat.categoryName}</td>
                    <td className="py-4 px-4 text-center">
                      <input
                        type="number"
                        min="0"
                        value={cat.count || ''}
                        onChange={(e) => handleCategoryChange(cat.categoryCode, parseInt(e.target.value) || 0)}
                        placeholder="0"
                        className="w-24 text-center bg-dashboard-bg border border-dashboard-border rounded-lg px-3 py-2 text-blue-500 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </td>
                    <td className="py-4 px-4 text-right text-dashboard-text font-semibold">
                      {formatCurrency(cat.revenue)}
                    </td>
                  </tr>
                ))}
                {/* 합계 행 */}
                <tr className="bg-blue-500/5 font-bold">
                  <td className="py-4 px-4 text-dashboard-text">합계</td>
                  <td className="py-4 px-4 text-center text-blue-500">{formatNumber(totals.offlineCount)}명</td>
                  <td className="py-4 px-4 text-right text-blue-500">{formatCurrency(totals.offlineRevenue)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* 요약 및 저장 */}
      <Card className="bg-gradient-to-br from-dashboard-card to-dashboard-bg">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          {/* 요약 */}
          <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-dashboard-bg/50 rounded-lg">
              <p className="text-xs text-dashboard-muted">인터넷 판매</p>
              <p className="text-lg font-bold text-maze-500 mt-1">{formatNumber(totals.onlineCount)}명</p>
              <p className="text-xs text-dashboard-muted">{formatCurrency(totals.onlineNet)}</p>
            </div>
            <div className="text-center p-4 bg-dashboard-bg/50 rounded-lg">
              <p className="text-xs text-dashboard-muted">현장 판매</p>
              <p className="text-lg font-bold text-blue-500 mt-1">{formatNumber(totals.offlineCount)}명</p>
              <p className="text-xs text-dashboard-muted">{formatCurrency(totals.offlineRevenue)}</p>
            </div>
            <div className="text-center p-4 bg-dashboard-bg/50 rounded-lg">
              <p className="text-xs text-dashboard-muted">총 판매</p>
              <p className="text-lg font-bold text-dashboard-text mt-1">{formatNumber(totals.totalCount)}명</p>
            </div>
            <div className="text-center p-4 bg-maze-500/10 rounded-lg border border-maze-500/30">
              <p className="text-xs text-dashboard-muted">SKP 매출</p>
              <p className="text-lg font-bold text-maze-500 mt-1">{formatCurrency(totals.totalRevenue)}</p>
              <p className="text-xs text-dashboard-muted">수수료 제외</p>
            </div>
          </div>

          {/* 저장 버튼 */}
          <div className="flex-shrink-0">
            <Button
              onClick={handleSave}
              disabled={isSaving || totals.totalCount === 0}
              isLoading={isSaving}
              size="lg"
              className="w-full md:w-auto"
            >
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? '저장 중...' : '데이터 저장'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}

