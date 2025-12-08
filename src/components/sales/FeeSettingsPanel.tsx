'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, Button } from '@/components/ui'
import { formatNumber, cn } from '@/lib/utils'
import {
  ChannelMonthlyFee,
  ChannelFeeOverride,
  MonthlyFeeSettings,
} from '@/types/sales-data'
import {
  Settings,
  Save,
  Plus,
  Trash2,
  Calendar,
  Percent,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

interface FeeSettingsPanelProps {
  year: number
  month: number
  settings: MonthlyFeeSettings | null
  onSave: (settings: MonthlyFeeSettings) => Promise<void>
  isSaving?: boolean
  isCollapsible?: boolean
  defaultCollapsed?: boolean
}

export function FeeSettingsPanel({
  year,
  month,
  settings,
  onSave,
  isSaving = false,
  isCollapsible = true,
  defaultCollapsed = true,
}: FeeSettingsPanelProps) {
  const [channels, setChannels] = useState<ChannelMonthlyFee[]>([])
  const [overrides, setOverrides] = useState<ChannelFeeOverride[]>([])
  const [isExpanded, setIsExpanded] = useState(!defaultCollapsed)
  const [hasChanges, setHasChanges] = useState(false)
  const [showOverrideForm, setShowOverrideForm] = useState(false)
  
  // Override 폼 상태
  const [newOverride, setNewOverride] = useState<Partial<ChannelFeeOverride>>({
    channelCode: '',
    startDate: '',
    endDate: '',
    feeRate: 0,
    reason: '',
  })

  // 설정 초기화
  useEffect(() => {
    if (settings) {
      setChannels(settings.channels)
      setOverrides(settings.overrides)
      setHasChanges(false)
    }
  }, [settings])

  // 채널 수수료 변경
  const handleChannelFeeChange = (channelCode: string, feeRate: number) => {
    setChannels(prev =>
      prev.map(ch =>
        ch.channelCode === channelCode
          ? { ...ch, feeRate, source: 'manual' as const }
          : ch
      )
    )
    setHasChanges(true)
  }

  // Override 추가
  const handleAddOverride = () => {
    if (!newOverride.channelCode || !newOverride.startDate || !newOverride.endDate) {
      alert('채널, 시작일, 종료일을 입력해주세요.')
      return
    }

    const override: ChannelFeeOverride = {
      id: `${newOverride.channelCode}-${newOverride.startDate}-${Date.now()}`,
      channelCode: newOverride.channelCode,
      startDate: newOverride.startDate,
      endDate: newOverride.endDate,
      feeRate: newOverride.feeRate || 0,
      reason: newOverride.reason,
    }

    setOverrides(prev => [...prev, override])
    setNewOverride({
      channelCode: '',
      startDate: '',
      endDate: '',
      feeRate: 0,
      reason: '',
    })
    setShowOverrideForm(false)
    setHasChanges(true)
  }

  // Override 삭제
  const handleRemoveOverride = (id: string) => {
    setOverrides(prev => prev.filter(o => o.id !== id))
    setHasChanges(true)
  }

  // 저장
  const handleSave = async () => {
    const newSettings: MonthlyFeeSettings = {
      year,
      month,
      channels,
      overrides,
      updatedAt: new Date().toISOString(),
    }
    await onSave(newSettings)
    setHasChanges(false)
  }

  return (
    <Card className="overflow-hidden">
      {/* 헤더 */}
      <div
        className={cn(
          'flex items-center justify-between p-4 bg-gradient-to-r from-orange-500/10 to-transparent border-b border-dashboard-border',
          isCollapsible && 'cursor-pointer'
        )}
        onClick={() => isCollapsible && setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-500/20 rounded-lg">
            <Percent className="w-5 h-5 text-orange-500" />
          </div>
          <div>
            <h3 className="font-semibold text-dashboard-text">
              {year}년 {month}월 수수료 설정
            </h3>
            <p className="text-xs text-dashboard-muted">
              채널별 기본 수수료율 {channels.length}개
              {overrides.length > 0 && ` · 기간별 예외 ${overrides.length}개`}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {hasChanges && (
            <span className="px-2 py-1 bg-orange-500/20 text-orange-500 text-xs rounded-full">
              변경사항 있음
            </span>
          )}
          {isCollapsible && (
            isExpanded ? <ChevronUp className="w-5 h-5 text-dashboard-muted" /> : <ChevronDown className="w-5 h-5 text-dashboard-muted" />
          )}
        </div>
      </div>

      {/* 본문 */}
      {isExpanded && (
        <div className="p-4 space-y-6">
          {/* 채널별 기본 수수료 */}
          <div>
            <h4 className="text-sm font-medium text-dashboard-text mb-3">채널별 기본 수수료율</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {channels.map(ch => (
                <div
                  key={ch.channelCode}
                  className="flex items-center justify-between p-3 bg-dashboard-bg rounded-lg border border-dashboard-border"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-dashboard-text truncate">{ch.channelName}</p>
                    <p className="text-xs text-dashboard-muted">
                      {ch.source === 'excel' ? '엑셀' : ch.source === 'manual' ? '수동' : '기본값'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-3">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={ch.feeRate}
                      onChange={(e) => handleChannelFeeChange(ch.channelCode, parseFloat(e.target.value) || 0)}
                      className="w-16 text-center bg-dashboard-card border border-dashboard-border rounded px-2 py-1 text-sm text-orange-500 font-medium"
                    />
                    <span className="text-sm text-dashboard-muted">%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 기간별 예외 (Override) */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-dashboard-text">기간별 예외 수수료</h4>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowOverrideForm(!showOverrideForm)}
              >
                <Plus className="w-4 h-4 mr-1" />
                예외 추가
              </Button>
            </div>

            {/* Override 추가 폼 */}
            {showOverrideForm && (
              <div className="p-4 bg-dashboard-bg rounded-lg border border-dashed border-dashboard-border mb-4">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                  <select
                    value={newOverride.channelCode}
                    onChange={(e) => setNewOverride(prev => ({ ...prev, channelCode: e.target.value }))}
                    className="bg-dashboard-card border border-dashboard-border rounded px-3 py-2 text-sm text-dashboard-text"
                  >
                    <option value="">채널 선택</option>
                    {channels.map(ch => (
                      <option key={ch.channelCode} value={ch.channelCode}>{ch.channelName}</option>
                    ))}
                  </select>
                  <input
                    type="date"
                    value={newOverride.startDate}
                    onChange={(e) => setNewOverride(prev => ({ ...prev, startDate: e.target.value }))}
                    className="bg-dashboard-card border border-dashboard-border rounded px-3 py-2 text-sm text-dashboard-text"
                    placeholder="시작일"
                  />
                  <input
                    type="date"
                    value={newOverride.endDate}
                    onChange={(e) => setNewOverride(prev => ({ ...prev, endDate: e.target.value }))}
                    className="bg-dashboard-card border border-dashboard-border rounded px-3 py-2 text-sm text-dashboard-text"
                    placeholder="종료일"
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={newOverride.feeRate}
                      onChange={(e) => setNewOverride(prev => ({ ...prev, feeRate: parseFloat(e.target.value) || 0 }))}
                      className="flex-1 bg-dashboard-card border border-dashboard-border rounded px-3 py-2 text-sm text-dashboard-text"
                      placeholder="수수료율"
                    />
                    <span className="text-sm text-dashboard-muted">%</span>
                  </div>
                  <Button onClick={handleAddOverride}>
                    <Plus className="w-4 h-4 mr-1" />
                    추가
                  </Button>
                </div>
                <input
                  type="text"
                  value={newOverride.reason || ''}
                  onChange={(e) => setNewOverride(prev => ({ ...prev, reason: e.target.value }))}
                  className="mt-3 w-full bg-dashboard-card border border-dashboard-border rounded px-3 py-2 text-sm text-dashboard-text"
                  placeholder="변경 사유 (선택)"
                />
              </div>
            )}

            {/* Override 목록 */}
            {overrides.length > 0 ? (
              <div className="space-y-2">
                {overrides.map(override => {
                  const channel = channels.find(c => c.channelCode === override.channelCode)
                  return (
                    <div
                      key={override.id}
                      className="flex items-center justify-between p-3 bg-orange-500/5 border border-orange-500/20 rounded-lg"
                    >
                      <div className="flex items-center gap-4">
                        <div>
                          <p className="text-sm font-medium text-dashboard-text">
                            {channel?.channelName || override.channelCode}
                          </p>
                          <p className="text-xs text-dashboard-muted">
                            {override.startDate} ~ {override.endDate}
                          </p>
                        </div>
                        <span className="px-2 py-1 bg-orange-500/20 text-orange-500 text-sm font-medium rounded">
                          {override.feeRate}%
                        </span>
                        {override.reason && (
                          <span className="text-xs text-dashboard-muted">
                            ({override.reason})
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => handleRemoveOverride(override.id)}
                        className="p-2 text-red-500 hover:bg-red-500/10 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-dashboard-muted text-center py-4">
                기간별 예외 수수료가 없습니다.
              </p>
            )}
          </div>

          {/* 저장 버튼 */}
          <div className="flex justify-end pt-4 border-t border-dashboard-border">
            <Button
              onClick={handleSave}
              disabled={isSaving || !hasChanges}
              isLoading={isSaving}
            >
              <Save className="w-4 h-4 mr-2" />
              수수료 설정 저장
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}

