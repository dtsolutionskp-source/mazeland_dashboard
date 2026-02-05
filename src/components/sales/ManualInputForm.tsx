'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Card, CardHeader, Button } from '@/components/ui'
import { formatNumber, formatCurrency, cn } from '@/lib/utils'
import type {
  ChannelMaster,
  CategoryMaster,
  DataSource,
  ChannelSalesData,
  CategorySalesData,
} from '@/types/sales-input'
import {
  Save,
  Globe,
  MapPin,
} from 'lucide-react'

/* =====================
 * 타입 정의
 * ===================== */

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

interface ManualInputFormProps {
  year: number
  month: number
  mode: DataSource
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

const BASE_PRICE = 3000

/* =====================
 * 컴포넌트
 * ===================== */

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

  const [channelInputs, setChannelInputs] = useState<Record<string, number>>({})
  const [categoryInputs, setCategoryInputs] = useState<Record<string, number>>({})

  /* 초기 데이터 세팅 */
  useEffect(() => {
    if (initialData) {
      const ch: Record<string, number> = {}
      initialData.channels.forEach(c => (ch[c.channelCode] = c.count))
      setChannelInputs(ch)

      const cat: Record<string, number> = {}
      initialData.categories.forEach(c => (cat[c.categoryCode] = c.count))
      setCategoryInputs(cat)
    } else {
      const ch: Record<string, number> = {}
      masterChannels.forEach(c => (ch[c.code] = 0))
      setChannelInputs(ch)

      const cat: Record<string, number> = {}
      masterCategories.forEach(c => (cat[c.code] = 0))
      setCategoryInputs(cat)
    }
  }, [initialData, masterChannels, masterCategories])

  /* 채널 계산 */
  const channelData = useMemo<ChannelSalesData[]>(() => {
    return masterChannels.map(ch => {
      const count = channelInputs[ch.code] ?? 0
      const grossRevenue = BASE_PRICE * count
      const feeRate = (ch as any).feeRate ?? (ch as any).defaultFeeRate ?? 0
      const fee = Math.round(grossRevenue * feeRate / 100)
      const netRevenue = grossRevenue - fee

      return {
        channelCode: ch.code,
        channelName: ch.name,
        feeRate,
        count,
        grossRevenue,
        fee,
        netRevenue,
      }
    })
  }, [masterChannels, channelInputs])

  /* 카테고리 계산 */
  const categoryData = useMemo<CategorySalesData[]>(() => {
    return masterCategories.map(cat => {
      const count = categoryInputs[cat.code] ?? 0
      return {
        categoryCode: cat.code,
        categoryName: cat.name,
        count,
        revenue: BASE_PRICE * count,
      }
    })
  }, [masterCategories, categoryInputs])

  /* 합계 */
  const totals = useMemo(() => {
    const onlineCount = channelData.reduce((s, c) => s + c.count, 0)
    const onlineGross = channelData.reduce((s, c) => s + (c.grossRevenue ?? 0), 0)
    const onlineFee = channelData.reduce((s, c) => s + (c.fee ?? 0), 0)
    const onlineNet = channelData.reduce((s, c) => s + (c.netRevenue ?? 0), 0)

    const offlineCount = categoryData.reduce((s, c) => s + c.count, 0)
    const offlineRevenue = categoryData.reduce((s, c) => s + (c.revenue ?? 0), 0)

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

  /* 핸들러 */
  const handleChannelChange = useCallback((code: string, value: number) => {
    setChannelInputs(prev => ({ ...prev, [code]: value }))
  }, [])

  const handleCategoryChange = useCallback((code: string, value: number) => {
    setCategoryInputs(prev => ({ ...prev, [code]: value }))
  }, [])

  const handleSave = async () => {
    await onSave({
      channels: channelData,
      categories: categoryData,
      source: mode,
    })
  }

  /* =====================
   * 렌더
   * ===================== */

  return (
    <div className="space-y-6">
      {/* 탭 */}
      <div className="flex gap-2 p-1 bg-dashboard-bg rounded-lg">
        <button
          onClick={() => setActiveTab('internet')}
          className={cn(
            'flex-1 py-3 rounded-lg font-medium',
            activeTab === 'internet'
              ? 'bg-maze-500 text-white'
              : 'text-dashboard-muted'
          )}
        >
          <Globe className="inline w-4 h-4 mr-2" />
          인터넷 ({formatNumber(totals.onlineCount)})
        </button>
        <button
          onClick={() => setActiveTab('onsite')}
          className={cn(
            'flex-1 py-3 rounded-lg font-medium',
            activeTab === 'onsite'
              ? 'bg-blue-500 text-white'
              : 'text-dashboard-muted'
          )}
        >
          <MapPin className="inline w-4 h-4 mr-2" />
          현장 ({formatNumber(totals.offlineCount)})
        </button>
      </div>

      {/* 인터넷 */}
      {activeTab === 'internet' && (
        <Card>
          <CardHeader title="채널별 인터넷 판매" />
          {channelData.map(ch => (
            <div key={ch.channelCode} className="flex items-center gap-4 py-2">
              <div className="flex-1">{ch.channelName}</div>
              <input
                type="number"
                className="w-24 text-center border rounded"
                value={ch.count}
                onChange={e => handleChannelChange(ch.channelCode, Number(e.target.value) || 0)}
              />
              <div className="w-32 text-right">{formatCurrency(ch.netRevenue)}</div>
            </div>
          ))}
        </Card>
      )}

      {/* 현장 */}
      {activeTab === 'onsite' && (
        <Card>
          <CardHeader title="구분별 현장 판매" />
          {categoryData.map(cat => (
            <div key={cat.categoryCode} className="flex items-center gap-4 py-2">
              <div className="flex-1">{cat.categoryName}</div>
              <input
                type="number"
                className="w-24 text-center border rounded"
                value={cat.count}
                onChange={e => handleCategoryChange(cat.categoryCode, Number(e.target.value) || 0)}
              />
              <div className="w-32 text-right">{formatCurrency(cat.revenue)}</div>
            </div>
          ))}
        </Card>
      )}

      {/* 저장 */}
      <Card>
        <Button
          onClick={handleSave}
          disabled={isSaving || totals.totalCount === 0}
          isLoading={isSaving}
        >
          <Save className="w-4 h-4 mr-2" />
          저장
        </Button>
      </Card>
    </div>
  )
}

