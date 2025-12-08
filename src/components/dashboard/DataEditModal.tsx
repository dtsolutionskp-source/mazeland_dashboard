'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { X, Save, Plus, Trash2 } from 'lucide-react'

// 채널 옵션 (온라인)
const ONLINE_CHANNELS = [
  { code: 'NAVER_MAZE_25', name: '네이버 메이즈랜드25년' },
  { code: 'MAZE_TICKET', name: '메이즈랜드 입장권' },
  { code: 'MAZE_TICKET_SINGLE', name: '메이즈랜드 입장권(단품)' },
  { code: 'GENERAL_TICKET', name: '일반채널 입장권' },
  { code: 'OTHER', name: '기타' },
]

// 카테고리 옵션 (현장)
const OFFLINE_CATEGORIES = [
  { code: 'INDIVIDUAL', name: '개인' },
  { code: 'TRAVEL_AGENCY', name: '여행사' },
  { code: 'TAXI', name: '택시' },
  { code: 'RESIDENT', name: '도민' },
  { code: 'ALL_PASS', name: '올패스' },
  { code: 'SHUTTLE_DISCOUNT', name: '순환버스할인' },
  { code: 'SCHOOL_GROUP', name: '학단' },
  { code: 'OTHER', name: '기타' },
]

interface DailyData {
  date: string
  online: number
  offline: number
  total: number
}

interface DataEditModalProps {
  isOpen: boolean
  onClose: () => void
  date: string
  initialData: DailyData
  onSave: (date: string, data: EditedData) => Promise<void>
}

interface EditEntry {
  id: string
  type: 'online' | 'offline'
  subType: string
  count: number
}

interface EditedData {
  online: number
  offline: number
  onlineBreakdown: Record<string, number>
  offlineBreakdown: Record<string, number>
}

export function DataEditModal({ isOpen, onClose, date, initialData, onSave }: DataEditModalProps) {
  const [entries, setEntries] = useState<EditEntry[]>([])
  const [isSaving, setIsSaving] = useState(false)

  // 초기 데이터로 엔트리 생성
  useEffect(() => {
    if (isOpen && initialData) {
      const initialEntries: EditEntry[] = []
      
      // 온라인 엔트리
      if (initialData.online > 0) {
        initialEntries.push({
          id: `online-${Date.now()}`,
          type: 'online',
          subType: 'NAVER_MAZE_25',
          count: initialData.online,
        })
      }
      
      // 오프라인 엔트리
      if (initialData.offline > 0) {
        initialEntries.push({
          id: `offline-${Date.now()}`,
          type: 'offline',
          subType: 'INDIVIDUAL',
          count: initialData.offline,
        })
      }
      
      setEntries(initialEntries.length > 0 ? initialEntries : [{
        id: `new-${Date.now()}`,
        type: 'online',
        subType: 'NAVER_MAZE_25',
        count: 0,
      }])
    }
  }, [isOpen, initialData])

  const addEntry = () => {
    setEntries([...entries, {
      id: `new-${Date.now()}`,
      type: 'online',
      subType: 'NAVER_MAZE_25',
      count: 0,
    }])
  }

  const removeEntry = (id: string) => {
    setEntries(entries.filter(e => e.id !== id))
  }

  const updateEntry = (id: string, field: keyof EditEntry, value: any) => {
    setEntries(entries.map(e => {
      if (e.id !== id) return e
      
      const updated = { ...e, [field]: value }
      
      // type 변경 시 subType 초기화
      if (field === 'type') {
        updated.subType = value === 'online' ? 'NAVER_MAZE_25' : 'INDIVIDUAL'
      }
      
      return updated
    }))
  }

  // 합계 계산
  const totals = entries.reduce((acc, e) => {
    if (e.type === 'online') {
      acc.online += e.count
      acc.onlineBreakdown[e.subType] = (acc.onlineBreakdown[e.subType] || 0) + e.count
    } else {
      acc.offline += e.count
      acc.offlineBreakdown[e.subType] = (acc.offlineBreakdown[e.subType] || 0) + e.count
    }
    return acc
  }, {
    online: 0,
    offline: 0,
    onlineBreakdown: {} as Record<string, number>,
    offlineBreakdown: {} as Record<string, number>,
  })

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await onSave(date, totals)
      onClose()
    } catch (error) {
      console.error('저장 실패:', error)
      alert('저장에 실패했습니다.')
    } finally {
      setIsSaving(false)
    }
  }

  if (!isOpen) return null

  const formattedDate = date.replace(/-/g, '/').slice(5) // "11/08" 형식

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 배경 오버레이 */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* 모달 */}
      <div className="relative bg-dashboard-card border border-dashboard-border rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-hidden animate-fade-in">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b border-dashboard-border">
          <div>
            <h2 className="text-lg font-bold text-dashboard-text">데이터 수정</h2>
            <p className="text-sm text-dashboard-muted">{date} ({formattedDate})</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-dashboard-border transition-colors"
          >
            <X className="w-5 h-5 text-dashboard-muted" />
          </button>
        </div>

        {/* 본문 */}
        <div className="p-4 max-h-[50vh] overflow-y-auto space-y-3">
          {entries.map((entry, index) => (
            <div key={entry.id} className="p-3 bg-dashboard-bg rounded-xl space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-dashboard-muted w-8">#{index + 1}</span>
                
                {/* 1차: 온라인/현장 선택 */}
                <select
                  value={entry.type}
                  onChange={(e) => updateEntry(entry.id, 'type', e.target.value)}
                  className="flex-1 bg-dashboard-card border border-dashboard-border rounded-lg px-3 py-2 text-sm text-dashboard-text"
                >
                  <option value="online">인터넷</option>
                  <option value="offline">현장</option>
                </select>

                {/* 삭제 버튼 */}
                <button
                  onClick={() => removeEntry(entry.id)}
                  className="p-2 rounded-lg hover:bg-red-500/20 text-red-500 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-2">
                {/* 2차: 세부 항목 선택 */}
                <select
                  value={entry.subType}
                  onChange={(e) => updateEntry(entry.id, 'subType', e.target.value)}
                  className="flex-1 bg-dashboard-card border border-dashboard-border rounded-lg px-3 py-2 text-sm text-dashboard-text"
                >
                  {entry.type === 'online' ? (
                    ONLINE_CHANNELS.map(ch => (
                      <option key={ch.code} value={ch.code}>{ch.name}</option>
                    ))
                  ) : (
                    OFFLINE_CATEGORIES.map(cat => (
                      <option key={cat.code} value={cat.code}>{cat.name}</option>
                    ))
                  )}
                </select>

                {/* 인원수 입력 */}
                <input
                  type="number"
                  value={entry.count}
                  onChange={(e) => updateEntry(entry.id, 'count', parseInt(e.target.value) || 0)}
                  min={0}
                  className="w-24 bg-dashboard-card border border-dashboard-border rounded-lg px-3 py-2 text-sm text-dashboard-text text-right"
                  placeholder="인원"
                />
                <span className="text-sm text-dashboard-muted">명</span>
              </div>
            </div>
          ))}

          {/* 항목 추가 버튼 */}
          <button
            onClick={addEntry}
            className="w-full py-3 border-2 border-dashed border-dashboard-border rounded-xl text-dashboard-muted hover:border-maze-500/50 hover:text-maze-500 transition-all flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>항목 추가</span>
          </button>
        </div>

        {/* 요약 */}
        <div className="p-4 border-t border-dashboard-border bg-dashboard-bg/50">
          <div className="grid grid-cols-3 gap-4 text-center mb-4">
            <div>
              <p className="text-xs text-dashboard-muted">인터넷</p>
              <p className="text-lg font-bold text-maze-500">{totals.online}명</p>
            </div>
            <div>
              <p className="text-xs text-dashboard-muted">현장</p>
              <p className="text-lg font-bold text-blue-500">{totals.offline}명</p>
            </div>
            <div>
              <p className="text-xs text-dashboard-muted">합계</p>
              <p className="text-lg font-bold text-dashboard-text">{totals.online + totals.offline}명</p>
            </div>
          </div>

          {/* 버튼 */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-dashboard-border text-dashboard-muted hover:bg-dashboard-border transition-all"
            >
              취소
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 py-3 rounded-xl bg-maze-500 text-white hover:bg-maze-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSaving ? (
                <span>저장 중...</span>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>저장</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

