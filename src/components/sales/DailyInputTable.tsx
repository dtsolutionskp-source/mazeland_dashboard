'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Card, CardHeader, Button } from '@/components/ui'
import { formatNumber, formatCurrency, cn } from '@/lib/utils'
import {
  DailyAggData,
  DailyChannelSale,
  DailyCategorySale,
  MonthlyFeeSettings,
  ChannelMaster,
  CategoryMaster,
} from '@/types/sales-data'
import {
  Save,
  Globe,
  MapPin,
  Plus,
  X,
  Trash2,
  Percent,
  Settings2,
} from 'lucide-react'

const BASE_PRICE = 3000

interface DailyInputTableProps {
  year: number
  month: number
  channels: ChannelMaster[]
  categories: CategoryMaster[]
  feeSettings: MonthlyFeeSettings | null
  initialDailyData: DailyAggData[]
  onSave: (data: DailyAggData[]) => Promise<void>
  isSaving?: boolean
}

type TabType = 'internet' | 'onsite'

interface CustomChannel {
  code: string
  name: string
  defaultFeeRate: number
}

interface CustomCategory {
  code: string
  name: string
}

export function DailyInputTable({
  year,
  month,
  channels: masterChannels,
  categories: masterCategories,
  feeSettings,
  initialDailyData,
  onSave,
  isSaving = false,
}: DailyInputTableProps) {
  const [activeTab, setActiveTab] = useState<TabType>('internet')
  const [dailyData, setDailyData] = useState<Map<string, DailyAggData>>(new Map())
  const [hasChanges, setHasChanges] = useState(false)
  
  // 수수료율 편집 모드
  const [feeEditMode, setFeeEditMode] = useState(false)
  
  // 추가된 채널/카테고리
  const [customChannels, setCustomChannels] = useState<CustomChannel[]>([])
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([])
  
  // 채널/카테고리 추가 모달
  const [showAddChannel, setShowAddChannel] = useState(false)
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [newChannelName, setNewChannelName] = useState('')
  const [newChannelFeeRate, setNewChannelFeeRate] = useState(10)
  const [newCategoryName, setNewCategoryName] = useState('')

  // 전체 채널 목록 (업로드 데이터에서 추출 + 커스텀)
  // 마스터 채널은 사용하지 않음 - 업로드된 데이터 기준으로 표시
  const allChannels = useMemo(() => {
    const channelMap = new Map<string, CustomChannel>()
    
    // 기존 데이터에서 채널 추출 (업로드 데이터 기반)
    initialDailyData.forEach(d => {
      d.channelSales?.forEach(ch => {
        if (ch.count > 0 || !channelMap.has(ch.channelCode)) {
          // 더 큰 count를 가진 데이터로 업데이트 (또는 신규 추가)
          const existing = channelMap.get(ch.channelCode)
          if (!existing || ch.count > 0) {
            channelMap.set(ch.channelCode, {
              code: ch.channelCode,
              name: ch.channelName,
              defaultFeeRate: ch.feeRate || 0,
            })
          }
        }
      })
    })
    
    // 커스텀 채널
    customChannels.forEach(ch => {
      channelMap.set(ch.code, ch)
    })
    
    // 데이터가 없으면 마스터 채널 사용 (신규 입력용)
    if (channelMap.size === 0) {
      masterChannels.forEach(ch => {
        channelMap.set(ch.code, {
          code: ch.code,
          name: ch.name,
          defaultFeeRate: ch.defaultFeeRate,
        })
      })
    }
    
    return Array.from(channelMap.values())
  }, [masterChannels, customChannels, initialDailyData])

  // 전체 카테고리 목록
  const allCategories = useMemo(() => {
    const categoryMap = new Map<string, CustomCategory>()
    
    // 마스터 카테고리
    masterCategories.forEach(cat => {
      categoryMap.set(cat.code, {
        code: cat.code,
        name: cat.name,
      })
    })
    
    // 기존 데이터에서 카테고리 추출
    initialDailyData.forEach(d => {
      d.categorySales?.forEach(cat => {
        if (!categoryMap.has(cat.categoryCode)) {
          categoryMap.set(cat.categoryCode, {
            code: cat.categoryCode,
            name: cat.categoryName,
          })
        }
      })
    })
    
    // 커스텀 카테고리
    customCategories.forEach(cat => {
      categoryMap.set(cat.code, cat)
    })
    
    return Array.from(categoryMap.values())
  }, [masterCategories, customCategories, initialDailyData])

  // 해당 월의 날짜 목록 생성
  const dates = useMemo(() => {
    const daysInMonth = new Date(year, month, 0).getDate()
    return Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    })
  }, [year, month])

  // 채널별 수수료율 조회
  const getFeeRateForChannel = useCallback((channelCode: string, date: string): number => {
    if (feeSettings) {
      // Override 확인
      const override = feeSettings.overrides.find(
        o => o.channelCode === channelCode &&
            date >= o.startDate &&
            date <= o.endDate
      )
      if (override) return override.feeRate

      // 월간 기본값
      const channelFee = feeSettings.channels.find(c => c.channelCode === channelCode)
      if (channelFee) return channelFee.feeRate
    }
    
    // 마스터 또는 커스텀 채널에서 찾기
    const channel = allChannels.find(c => c.code === channelCode)
    return channel?.defaultFeeRate ?? 15
  }, [feeSettings, allChannels])

  // 빈 일자 데이터 생성
  const createEmptyDailyData = useCallback((date: string): DailyAggData => {
    const channelSales: DailyChannelSale[] = allChannels.map(ch => ({
      date,
      channelCode: ch.code,
      channelName: ch.name,
      count: 0,
      feeRate: getFeeRateForChannel(ch.code, date),
    }))

    const categorySales: DailyCategorySale[] = allCategories.map(cat => ({
      date,
      categoryCode: cat.code,
      categoryName: cat.name,
      count: 0,
    }))

    return {
      date,
      channelSales,
      categorySales,
      summary: {
        date,
        onlineCount: 0,
        offlineCount: 0,
        totalCount: 0,
        onlineNetRevenue: 0,
        offlineRevenue: 0,
        totalNetRevenue: 0,
      },
      source: 'manual',
    }
  }, [allChannels, allCategories, getFeeRateForChannel])

  // 초기 데이터 로드
  useEffect(() => {
    const dataMap = new Map<string, DailyAggData>()
    
    // 모든 날짜에 대해 데이터 초기화
    for (const date of dates) {
      const existingData = initialDailyData.find(d => d.date === date)
      
      if (existingData) {
        // 기존 데이터가 있으면 사용하되, 새 채널/카테고리 추가
        const channelSales: DailyChannelSale[] = allChannels.map(ch => {
          const existing = existingData.channelSales?.find(c => c.channelCode === ch.code)
          return existing || {
            date,
            channelCode: ch.code,
            channelName: ch.name,
            count: 0,
            feeRate: getFeeRateForChannel(ch.code, date),
          }
        })

        const categorySales: DailyCategorySale[] = allCategories.map(cat => {
          const existing = existingData.categorySales?.find(c => c.categoryCode === cat.code)
          return existing || {
            date,
            categoryCode: cat.code,
            categoryName: cat.name,
            count: 0,
          }
        })

        dataMap.set(date, {
          ...existingData,
          channelSales,
          categorySales,
        })
      } else {
        dataMap.set(date, createEmptyDailyData(date))
      }
    }
    
    setDailyData(dataMap)
    setHasChanges(false)
  }, [initialDailyData, dates, allChannels, allCategories, createEmptyDailyData, getFeeRateForChannel])

  // 채널 추가
  const handleAddChannel = () => {
    if (!newChannelName.trim()) return
    
    const code = `CUSTOM_${Date.now()}`
    const newChannel: CustomChannel = {
      code,
      name: newChannelName.trim(),
      defaultFeeRate: newChannelFeeRate,
    }
    
    setCustomChannels(prev => [...prev, newChannel])
    
    // 모든 일자 데이터에 새 채널 추가
    setDailyData(prev => {
      const newMap = new Map(prev)
      newMap.forEach((data, date) => {
        const channelSales = [
          ...data.channelSales,
          {
            date,
            channelCode: code,
            channelName: newChannelName.trim(),
            count: 0,
            feeRate: newChannelFeeRate,
          }
        ]
        newMap.set(date, { ...data, channelSales })
      })
      return newMap
    })
    
    setNewChannelName('')
    setNewChannelFeeRate(10)
    setShowAddChannel(false)
    setHasChanges(true)
  }

  // 카테고리 추가
  const handleAddCategory = () => {
    if (!newCategoryName.trim()) return
    
    const code = `CUSTOM_${Date.now()}`
    const newCategory: CustomCategory = {
      code,
      name: newCategoryName.trim(),
    }
    
    setCustomCategories(prev => [...prev, newCategory])
    
    // 모든 일자 데이터에 새 카테고리 추가
    setDailyData(prev => {
      const newMap = new Map(prev)
      newMap.forEach((data, date) => {
        const categorySales = [
          ...data.categorySales,
          {
            date,
            categoryCode: code,
            categoryName: newCategoryName.trim(),
            count: 0,
          }
        ]
        newMap.set(date, { ...data, categorySales })
      })
      return newMap
    })
    
    setNewCategoryName('')
    setShowAddCategory(false)
    setHasChanges(true)
  }

  // 채널 건수 변경
  const handleChannelCountChange = (date: string, channelCode: string, count: number) => {
    setDailyData(prev => {
      const newMap = new Map(prev)
      const data = newMap.get(date) || createEmptyDailyData(date)
      
      const channelSales = data.channelSales.map(ch =>
        ch.channelCode === channelCode ? { ...ch, count } : ch
      )
      
      newMap.set(date, { ...data, channelSales, source: 'manual' })
      return newMap
    })
    setHasChanges(true)
  }
  
  // 채널 수수료율 변경 (일자별)
  const handleChannelFeeRateChange = (date: string, channelCode: string, feeRate: number) => {
    setDailyData(prev => {
      const newMap = new Map(prev)
      const data = newMap.get(date) || createEmptyDailyData(date)
      
      const channelSales = data.channelSales.map(ch =>
        ch.channelCode === channelCode ? { ...ch, feeRate } : ch
      )
      
      newMap.set(date, { ...data, channelSales, source: 'manual' })
      return newMap
    })
    setHasChanges(true)
  }
  
  // 특정 채널의 일괄 수수료율 변경
  const handleBulkFeeRateChange = (channelCode: string, feeRate: number) => {
    setDailyData(prev => {
      const newMap = new Map(prev)
      newMap.forEach((data, date) => {
        const channelSales = data.channelSales.map(ch =>
          ch.channelCode === channelCode ? { ...ch, feeRate } : ch
        )
        newMap.set(date, { ...data, channelSales, source: 'manual' })
      })
      return newMap
    })
    setHasChanges(true)
  }

  // 카테고리 건수 변경
  const handleCategoryCountChange = (date: string, categoryCode: string, count: number) => {
    setDailyData(prev => {
      const newMap = new Map(prev)
      const data = newMap.get(date) || createEmptyDailyData(date)
      
      const categorySales = data.categorySales.map(cat =>
        cat.categoryCode === categoryCode ? { ...cat, count } : cat
      )
      
      newMap.set(date, { ...data, categorySales, source: 'manual' })
      return newMap
    })
    setHasChanges(true)
  }

  // 저장
  const handleSave = async () => {
    const dataList = Array.from(dailyData.values())
    await onSave(dataList)
    setHasChanges(false)
  }

  // 합계 계산
  const totals = useMemo(() => {
    const channelTotals: Record<string, number> = {}
    const categoryTotals: Record<string, number> = {}
    let onlineTotal = 0
    let offlineTotal = 0

    dailyData.forEach(data => {
      data.channelSales?.forEach(ch => {
        channelTotals[ch.channelCode] = (channelTotals[ch.channelCode] || 0) + ch.count
        onlineTotal += ch.count
      })
      data.categorySales?.forEach(cat => {
        categoryTotals[cat.categoryCode] = (categoryTotals[cat.categoryCode] || 0) + cat.count
        offlineTotal += cat.count
      })
    })

    return { channelTotals, categoryTotals, onlineTotal, offlineTotal }
  }, [dailyData])

  // 일자별 합계 계산
  const getDailyTotal = (date: string, type: 'internet' | 'onsite'): number => {
    const data = dailyData.get(date)
    if (!data) return 0

    if (type === 'internet') {
      return data.channelSales?.reduce((sum, ch) => sum + ch.count, 0) || 0
    } else {
      return data.categorySales?.reduce((sum, cat) => sum + cat.count, 0) || 0
    }
  }

  return (
    <div className="space-y-4">
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
            {formatNumber(totals.onlineTotal)}명
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
            {formatNumber(totals.offlineTotal)}명
          </span>
        </button>
      </div>

      {/* 인터넷 판매 테이블 */}
      {activeTab === 'internet' && (
        <Card>
          <CardHeader
            title="일자별 채널 판매 입력"
            description="각 일자의 채널별 판매 건수를 입력하세요"
          />
          
          {/* 채널 추가 및 수수료 편집 모드 */}
          <div className="mb-4 flex justify-between items-center">
            {/* 수수료율 편집 모드 토글 */}
            <button
              onClick={() => setFeeEditMode(!feeEditMode)}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                feeEditMode
                  ? 'bg-orange-500 text-white'
                  : 'bg-dashboard-bg text-dashboard-muted hover:text-dashboard-text'
              )}
            >
              <Percent className="w-4 h-4" />
              {feeEditMode ? '수수료율 편집 중' : '수수료율 편집'}
            </button>
            
            {!showAddChannel ? (
              <Button size="sm" variant="outline" onClick={() => setShowAddChannel(true)}>
                <Plus className="w-4 h-4 mr-1" />
                채널 추가
              </Button>
            ) : (
              <div className="flex items-center gap-2 p-3 bg-dashboard-bg rounded-lg">
                <input
                  type="text"
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value)}
                  placeholder="채널명"
                  className="w-32 px-2 py-1 text-sm bg-dashboard-card border border-dashboard-border rounded"
                />
                <input
                  type="number"
                  value={newChannelFeeRate}
                  onChange={(e) => setNewChannelFeeRate(parseFloat(e.target.value) || 0)}
                  placeholder="수수료%"
                  className="w-16 px-2 py-1 text-sm bg-dashboard-card border border-dashboard-border rounded"
                />
                <span className="text-sm text-dashboard-muted">%</span>
                <Button size="sm" onClick={handleAddChannel}>추가</Button>
                <button onClick={() => setShowAddChannel(false)} className="p-1 text-dashboard-muted hover:text-dashboard-text">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
          
          <div className="overflow-x-auto max-h-[600px] relative">
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 bg-dashboard-card z-20">
                <tr className="border-b-2 border-dashboard-border">
                  <th className="text-left py-3 px-3 font-semibold text-dashboard-muted w-20 sticky left-0 bg-dashboard-card z-30 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                    일자
                  </th>
                  {allChannels.map(ch => {
                    // 채널 코드 형식: "업체_종류" -> 분리하여 표시
                    const parts = ch.code.split('_')
                    const vendor = parts[0] || ''
                    // 중분류: 코드에서 업체 제외한 나머지
                    const channelTypeFromCode = parts.slice(1).join(' ')
                    
                    // 표시명 결정: ch.name이 코드와 같거나 없으면 코드에서 추출한 중분류 사용
                    const isNameSameAsCode = !ch.name || ch.name === ch.code || ch.name.includes('_')
                    const displayName = isNameSameAsCode ? channelTypeFromCode : ch.name
                    
                    return (
                      <th key={ch.code} className="text-center py-2 px-2 font-semibold text-dashboard-muted min-w-[100px] max-w-[140px]">
                        <div className="flex flex-col items-center gap-0.5">
                          {/* 대분류 (업체) - 작은 글씨 */}
                          <span className="text-[9px] text-dashboard-muted/60 font-normal leading-tight">
                            {vendor.slice(0, 12)}
                          </span>
                          {/* 중분류 (종류) - 큰 글씨 */}
                          <span 
                            className="text-[11px] font-medium leading-tight text-center" 
                            title={`${vendor} > ${displayName}`}
                            style={{ 
                              wordBreak: 'keep-all',
                              maxWidth: '130px',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden'
                            }}
                          >
                            {displayName}
                          </span>
                          {feeEditMode ? (
                            <div className="flex items-center gap-0.5 mt-1">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.5"
                                value={ch.defaultFeeRate}
                                onChange={(e) => handleBulkFeeRateChange(ch.code, parseFloat(e.target.value) || 0)}
                                className="w-10 text-center bg-orange-100 dark:bg-orange-900/30 border border-orange-500 rounded px-0.5 py-0.5 text-[10px] text-orange-600 dark:text-orange-400 focus:outline-none"
                                title="전체 일자에 일괄 적용"
                              />
                              <span className="text-[10px] text-orange-500">%</span>
                            </div>
                          ) : (
                            <span className="text-[9px] text-orange-500 font-medium">
                              {ch.defaultFeeRate}%
                            </span>
                          )}
                        </div>
                      </th>
                    )
                  })}
                  <th className="text-center py-3 px-3 font-semibold text-maze-500 w-20 sticky right-0 bg-dashboard-card z-30 shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                    합계
                  </th>
                </tr>
              </thead>
              <tbody>
                {dates.map(date => {
                  const data = dailyData.get(date)
                  const dayOfWeek = new Date(date).getDay()
                  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
                  const dayNum = date.split('-')[2]

                  return (
                    <tr
                      key={date}
                      className={cn(
                        'border-b border-dashboard-border/50',
                        isWeekend && 'bg-red-500/5'
                      )}
                    >
                      <td className="py-2 px-2 sticky left-0 bg-dashboard-card">
                        <span className={cn(
                          'text-xs font-medium',
                          isWeekend ? 'text-red-500' : 'text-dashboard-text'
                        )}>
                          {dayNum}일
                        </span>
                      </td>
                      {allChannels.map(ch => {
                        const channelData = data?.channelSales?.find(c => c.channelCode === ch.code)
                        const currentFeeRate = channelData?.feeRate ?? ch.defaultFeeRate
                        const defaultFeeRate = getFeeRateForChannel(ch.code, date)
                        const hasCustomFee = channelData?.feeRate !== undefined && channelData.feeRate !== defaultFeeRate
                        
                        return (
                          <td key={ch.code} className="py-1 px-1 text-center">
                            <div className="flex flex-col items-center gap-0.5">
                              <input
                                type="number"
                                min="0"
                                value={channelData?.count || ''}
                                onChange={(e) => handleChannelCountChange(date, ch.code, parseInt(e.target.value) || 0)}
                                placeholder="0"
                                className="w-full max-w-[60px] text-center bg-dashboard-bg border border-transparent focus:border-maze-500 rounded px-1 py-1 text-xs text-dashboard-text focus:outline-none"
                              />
                              {feeEditMode && (
                                <div className="flex items-center gap-0.5">
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="0.5"
                                    value={currentFeeRate}
                                    onChange={(e) => handleChannelFeeRateChange(date, ch.code, parseFloat(e.target.value) || 0)}
                                    className={cn(
                                      "w-10 text-center border rounded px-0.5 py-0.5 text-[9px] focus:outline-none",
                                      hasCustomFee
                                        ? "bg-orange-100 dark:bg-orange-900/40 border-orange-500 text-orange-600 dark:text-orange-400"
                                        : "bg-dashboard-bg/50 border-dashboard-border text-dashboard-muted"
                                    )}
                                  />
                                  <span className="text-[9px] text-dashboard-muted">%</span>
                                </div>
                              )}
                            </div>
                          </td>
                        )
                      })}
                      <td className="py-2 px-2 text-center sticky right-0 bg-dashboard-card">
                        <span className="text-xs font-semibold text-maze-500">
                          {formatNumber(getDailyTotal(date, 'internet'))}
                        </span>
                      </td>
                    </tr>
                  )
                })}
                {/* 합계 행 */}
                <tr className="bg-maze-500/10 font-bold">
                  <td className="py-3 px-2 sticky left-0 bg-maze-500/10 text-dashboard-text">합계</td>
                  {allChannels.map(ch => (
                    <td key={ch.code} className="py-3 px-2 text-center text-maze-500">
                      {formatNumber(totals.channelTotals[ch.code] || 0)}
                    </td>
                  ))}
                  <td className="py-3 px-2 text-center sticky right-0 bg-maze-500/10 text-maze-500">
                    {formatNumber(totals.onlineTotal)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* 현장 판매 테이블 */}
      {activeTab === 'onsite' && (
        <Card>
          <CardHeader
            title="일자별 구분 판매 입력"
            description="각 일자의 구분별 판매 건수를 입력하세요"
          />
          
          {/* 카테고리 추가 버튼 */}
          <div className="mb-4 flex justify-end">
            {!showAddCategory ? (
              <Button size="sm" variant="outline" onClick={() => setShowAddCategory(true)}>
                <Plus className="w-4 h-4 mr-1" />
                구분 추가
              </Button>
            ) : (
              <div className="flex items-center gap-2 p-3 bg-dashboard-bg rounded-lg">
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="구분명"
                  className="w-32 px-2 py-1 text-sm bg-dashboard-card border border-dashboard-border rounded"
                />
                <Button size="sm" onClick={handleAddCategory}>추가</Button>
                <button onClick={() => setShowAddCategory(false)} className="p-1 text-dashboard-muted hover:text-dashboard-text">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-dashboard-card z-10">
                <tr className="border-b border-dashboard-border">
                  <th className="text-left py-3 px-2 font-semibold text-dashboard-muted w-24 sticky left-0 bg-dashboard-card">
                    일자
                  </th>
                  {allCategories.map(cat => (
                    <th key={cat.code} className="text-center py-3 px-2 font-semibold text-dashboard-muted min-w-[70px]">
                      <span className="text-xs">{cat.name}</span>
                    </th>
                  ))}
                  <th className="text-center py-3 px-2 font-semibold text-blue-500 w-20 sticky right-0 bg-dashboard-card">
                    합계
                  </th>
                </tr>
              </thead>
              <tbody>
                {dates.map(date => {
                  const data = dailyData.get(date)
                  const dayOfWeek = new Date(date).getDay()
                  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
                  const dayNum = date.split('-')[2]

                  return (
                    <tr
                      key={date}
                      className={cn(
                        'border-b border-dashboard-border/50',
                        isWeekend && 'bg-red-500/5'
                      )}
                    >
                      <td className="py-2 px-2 sticky left-0 bg-dashboard-card">
                        <span className={cn(
                          'text-xs font-medium',
                          isWeekend ? 'text-red-500' : 'text-dashboard-text'
                        )}>
                          {dayNum}일
                        </span>
                      </td>
                      {allCategories.map(cat => {
                        const catData = data?.categorySales?.find(c => c.categoryCode === cat.code)
                        return (
                          <td key={cat.code} className="py-1 px-1 text-center">
                            <input
                              type="number"
                              min="0"
                              value={catData?.count || ''}
                              onChange={(e) => handleCategoryCountChange(date, cat.code, parseInt(e.target.value) || 0)}
                              placeholder="0"
                              className="w-full max-w-[50px] text-center bg-dashboard-bg border border-transparent focus:border-blue-500 rounded px-1 py-1 text-xs text-dashboard-text focus:outline-none"
                            />
                          </td>
                        )
                      })}
                      <td className="py-2 px-2 text-center sticky right-0 bg-dashboard-card">
                        <span className="text-xs font-semibold text-blue-500">
                          {formatNumber(getDailyTotal(date, 'onsite'))}
                        </span>
                      </td>
                    </tr>
                  )
                })}
                {/* 합계 행 */}
                <tr className="bg-blue-500/10 font-bold">
                  <td className="py-3 px-2 sticky left-0 bg-blue-500/10 text-dashboard-text">합계</td>
                  {allCategories.map(cat => (
                    <td key={cat.code} className="py-3 px-2 text-center text-blue-500">
                      {formatNumber(totals.categoryTotals[cat.code] || 0)}
                    </td>
                  ))}
                  <td className="py-3 px-2 text-center sticky right-0 bg-blue-500/10 text-blue-500">
                    {formatNumber(totals.offlineTotal)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* 요약 및 저장 */}
      <Card className="bg-gradient-to-br from-dashboard-card to-dashboard-bg">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-dashboard-bg/50 rounded-lg">
              <p className="text-xs text-dashboard-muted">인터넷 판매</p>
              <p className="text-lg font-bold text-maze-500">{formatNumber(totals.onlineTotal)}명</p>
            </div>
            <div className="text-center p-3 bg-dashboard-bg/50 rounded-lg">
              <p className="text-xs text-dashboard-muted">현장 판매</p>
              <p className="text-lg font-bold text-blue-500">{formatNumber(totals.offlineTotal)}명</p>
            </div>
            <div className="text-center p-3 bg-dashboard-bg/50 rounded-lg">
              <p className="text-xs text-dashboard-muted">총 판매</p>
              <p className="text-lg font-bold text-dashboard-text">
                {formatNumber(totals.onlineTotal + totals.offlineTotal)}명
              </p>
            </div>
            <div className="text-center p-3 bg-maze-500/10 rounded-lg border border-maze-500/30">
              <p className="text-xs text-dashboard-muted">입력 일수</p>
              <p className="text-lg font-bold text-maze-500">
                {Array.from(dailyData.values()).filter(d => 
                  (d.channelSales?.some(ch => ch.count > 0)) || 
                  (d.categorySales?.some(cat => cat.count > 0))
                ).length}일
              </p>
            </div>
          </div>

          <div className="flex-shrink-0">
            <Button
              onClick={handleSave}
              disabled={isSaving || !hasChanges}
              isLoading={isSaving}
              size="lg"
            >
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? '저장 중...' : '일자별 데이터 저장'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
