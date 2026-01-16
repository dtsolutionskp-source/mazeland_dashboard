'use client'

import { useState, useEffect, useCallback } from 'react'
import { Header } from '@/components/dashboard/Header'
import { Card, CardHeader, Button, Input, Select } from '@/components/ui'
import { formatDate, formatNumber } from '@/lib/utils'
import { cn } from '@/lib/utils'
import {
  Plus,
  Calendar,
  Trash2,
  Edit,
  X,
  Eye,
  MousePointer,
  Percent,
  Megaphone,
  TrendingUp,
  FileText,
} from 'lucide-react'

interface MarketingLog {
  id: string
  logType: 'CAMPAIGN' | 'PERFORMANCE'
  startDate: string
  endDate: string
  // 캠페인용
  title?: string
  content?: string
  // 퍼포먼스용
  subType?: string
  impressions: number
  clicks: number
  createdBy?: {
    name: string
    email: string
  }
  createdAt: string
}

const LOG_TYPES = [
  { value: 'CAMPAIGN', label: '캠페인', icon: Megaphone, color: 'text-blue-500 bg-blue-500/20' },
  { value: 'PERFORMANCE', label: '퍼포먼스', icon: TrendingUp, color: 'text-green-500 bg-green-500/20' },
]

function calculateClickRate(clicks: number, impressions: number): string {
  if (impressions === 0) return '0.00'
  return ((clicks / impressions) * 100).toFixed(2)
}

export default function MarketingLogPage() {
  const [logs, setLogs] = useState<MarketingLog[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isFetching, setIsFetching] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingLog, setEditingLog] = useState<MarketingLog | null>(null)
  const [filter, setFilter] = useState('ALL')
  const [error, setError] = useState<string | null>(null)
  
  // 폼 상태
  const [formData, setFormData] = useState({
    logType: 'CAMPAIGN' as 'CAMPAIGN' | 'PERFORMANCE',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    title: '',
    content: '',
    subType: '',
    impressions: 0,
    clicks: 0,
  })

  // 로그 목록 조회
  const fetchLogs = useCallback(async () => {
    setIsFetching(true)
    setError(null)
    try {
      const response = await fetch('/api/marketing-log')
      if (!response.ok) throw new Error('로그 조회 실패')
      const data = await response.json()
      setLogs(data.logs || [])
    } catch (err) {
      console.error('Fetch logs error:', err)
      setError('마케팅 로그를 불러오는데 실패했습니다.')
    } finally {
      setIsFetching(false)
    }
  }, [])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    
    try {
      const url = editingLog ? `/api/marketing-log/${editingLog.id}` : '/api/marketing-log'
      const method = editingLog ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '저장 실패')
      }
      
      await fetchLogs() // 목록 새로고침
      setShowModal(false)
      setEditingLog(null)
      resetForm()
    } catch (err: any) {
      console.error('Submit error:', err)
      setError(err.message || '저장 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      logType: 'CAMPAIGN',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
      title: '',
      content: '',
      subType: '',
      impressions: 0,
      clicks: 0,
    })
  }

  const handleEdit = (log: MarketingLog) => {
    setEditingLog(log)
    setFormData({
      logType: log.logType,
      startDate: log.startDate?.split('T')[0] || '',
      endDate: log.endDate?.split('T')[0] || '',
      title: log.title || '',
      content: log.content || '',
      subType: log.subType || '',
      impressions: log.impressions || 0,
      clicks: log.clicks || 0,
    })
    setShowModal(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return
    
    setError(null)
    try {
      const response = await fetch(`/api/marketing-log/${id}`, {
        method: 'DELETE',
      })
      
      if (!response.ok) {
        throw new Error('삭제 실패')
      }
      
      await fetchLogs() // 목록 새로고침
    } catch (err) {
      console.error('Delete error:', err)
      setError('삭제 중 오류가 발생했습니다.')
    }
  }

  const filteredLogs = filter === 'ALL' 
    ? logs 
    : logs.filter(l => l.logType === filter)

  const getLogTypeInfo = (type: string) => {
    return LOG_TYPES.find(t => t.value === type) || LOG_TYPES[0]
  }

  // 퍼포먼스 로그 통계
  const performanceLogs = logs.filter(l => l.logType === 'PERFORMANCE')
  const performanceStats = performanceLogs.reduce((acc, log) => ({
    impressions: acc.impressions + (log.impressions || 0),
    clicks: acc.clicks + (log.clicks || 0),
  }), { impressions: 0, clicks: 0 })

  return (
    <div className="min-h-screen">
      <Header
        title="마케팅 로그"
        description="캠페인과 퍼포먼스 광고 기록을 관리합니다"
      />
      
      <div className="p-8 space-y-6">
        {/* 에러 메시지 */}
        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-500 text-sm">
            {error}
          </div>
        )}

        {/* 퍼포먼스 통계 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-blue-500/20">
                <Megaphone className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-dashboard-muted">캠페인</p>
                <p className="text-2xl font-bold text-dashboard-text">
                  {logs.filter(l => l.logType === 'CAMPAIGN').length}건
                </p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-green-500/20">
                <Eye className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-dashboard-muted">총 노출량</p>
                <p className="text-2xl font-bold text-dashboard-text">
                  {formatNumber(performanceStats.impressions)}
                </p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-orange-500/20">
                <MousePointer className="w-6 h-6 text-orange-500" />
              </div>
              <div>
                <p className="text-sm text-dashboard-muted">총 클릭수</p>
                <p className="text-2xl font-bold text-dashboard-text">
                  {formatNumber(performanceStats.clicks)}
                </p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-purple-500/20">
                <Percent className="w-6 h-6 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-dashboard-muted">평균 클릭율</p>
                <p className="text-2xl font-bold text-dashboard-text">
                  {calculateClickRate(performanceStats.clicks, performanceStats.impressions)}%
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* 필터 및 추가 버튼 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              options={[
                { value: 'ALL', label: '전체 보기' },
                ...LOG_TYPES.map(t => ({ value: t.value, label: t.label })),
              ]}
              className="w-48"
            />
          </div>
          <Button onClick={() => setShowModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            새 로그 등록
          </Button>
        </div>

        {/* 로그 테이블 */}
        <Card>
          {isFetching ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-maze-500" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-dashboard-border">
                    <th className="text-left py-4 px-4 text-sm font-semibold text-dashboard-muted">유형</th>
                    <th className="text-left py-4 px-4 text-sm font-semibold text-dashboard-muted">기간</th>
                    <th className="text-left py-4 px-4 text-sm font-semibold text-dashboard-muted">내용</th>
                    <th className="text-right py-4 px-4 text-sm font-semibold text-dashboard-muted">노출량</th>
                    <th className="text-right py-4 px-4 text-sm font-semibold text-dashboard-muted">클릭수</th>
                    <th className="text-right py-4 px-4 text-sm font-semibold text-dashboard-muted">클릭율</th>
                    <th className="text-center py-4 px-4 text-sm font-semibold text-dashboard-muted">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12">
                        <p className="text-dashboard-muted">등록된 로그가 없습니다.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log) => {
                      const typeInfo = getLogTypeInfo(log.logType)
                      const TypeIcon = typeInfo.icon
                      const clickRate = calculateClickRate(log.clicks || 0, log.impressions || 0)
                      
                      return (
                        <tr 
                          key={log.id} 
                          className="border-b border-dashboard-border/50 hover:bg-dashboard-border/30 transition-colors"
                        >
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-2">
                              <div className={cn('p-1.5 rounded', typeInfo.color)}>
                                <TypeIcon className="w-4 h-4" />
                              </div>
                              <span className="text-sm text-dashboard-text">{typeInfo.label}</span>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-2 text-sm">
                              <Calendar className="w-4 h-4 text-dashboard-muted" />
                              <span className="text-dashboard-text">
                                {formatDate(log.startDate)} ~ {formatDate(log.endDate)}
                              </span>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            {log.logType === 'CAMPAIGN' ? (
                              <div>
                                <p className="text-sm font-medium text-dashboard-text">{log.title || '-'}</p>
                                <p className="text-xs text-dashboard-muted line-clamp-1">{log.content || ''}</p>
                              </div>
                            ) : (
                              <span className="text-sm text-dashboard-text">{log.subType || '-'}</span>
                            )}
                          </td>
                          <td className="py-4 px-4 text-right">
                            {log.logType === 'PERFORMANCE' ? (
                              <span className="text-sm font-medium text-dashboard-text">
                                {formatNumber(log.impressions || 0)}
                              </span>
                            ) : (
                              <span className="text-sm text-dashboard-muted">-</span>
                            )}
                          </td>
                          <td className="py-4 px-4 text-right">
                            {log.logType === 'PERFORMANCE' ? (
                              <span className="text-sm font-medium text-dashboard-text">
                                {formatNumber(log.clicks || 0)}
                              </span>
                            ) : (
                              <span className="text-sm text-dashboard-muted">-</span>
                            )}
                          </td>
                          <td className="py-4 px-4 text-right">
                            {log.logType === 'PERFORMANCE' ? (
                              <span className={cn(
                                'text-sm font-bold',
                                parseFloat(clickRate) >= 3 ? 'text-green-500' :
                                parseFloat(clickRate) >= 1 ? 'text-blue-500' : 'text-dashboard-muted'
                              )}>
                                {clickRate}%
                              </span>
                            ) : (
                              <span className="text-sm text-dashboard-muted">-</span>
                            )}
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleEdit(log)}
                                className="p-2 text-dashboard-muted hover:text-dashboard-text hover:bg-dashboard-border rounded-lg transition-colors"
                                title="수정"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(log.id)}
                                className="p-2 text-dashboard-muted hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                title="삭제"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* 등록/수정 모달 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-dashboard-card border border-dashboard-border rounded-2xl w-full max-w-lg animate-slide-up">
            <div className="flex items-center justify-between p-6 border-b border-dashboard-border">
              <h2 className="text-xl font-semibold text-dashboard-text">
                {editingLog ? '로그 수정' : '새 로그 등록'}
              </h2>
              <button
                onClick={() => {
                  setShowModal(false)
                  setEditingLog(null)
                  resetForm()
                }}
                className="p-2 text-dashboard-muted hover:text-dashboard-text hover:bg-dashboard-border rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* 유형 선택 */}
              <Select
                label="유형"
                value={formData.logType}
                onChange={(e) => setFormData({ ...formData, logType: e.target.value as any })}
                options={LOG_TYPES.map(t => ({ value: t.value, label: t.label }))}
              />
              
              {/* 기간 */}
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="시작일"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  required
                />
                <Input
                  label="종료일"
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  required
                />
              </div>
              
              {/* 캠페인용 필드 */}
              {formData.logType === 'CAMPAIGN' && (
                <>
                  <Input
                    label="제목"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="캠페인 제목을 입력하세요"
                    required
                  />
                  <div>
                    <label className="block text-sm font-medium text-dashboard-text mb-2">내용</label>
                    <textarea
                      value={formData.content}
                      onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                      placeholder="캠페인 내용을 입력하세요"
                      rows={4}
                      className="w-full px-4 py-3 bg-dashboard-bg border border-dashboard-border rounded-lg text-dashboard-text placeholder:text-dashboard-muted focus:outline-none focus:ring-2 focus:ring-maze-500 focus:border-transparent transition-all resize-none"
                      required
                    />
                  </div>
                </>
              )}
              
              {/* 퍼포먼스용 필드 */}
              {formData.logType === 'PERFORMANCE' && (
                <>
                  <Input
                    label="세부 유형"
                    value={formData.subType}
                    onChange={(e) => setFormData({ ...formData, subType: e.target.value })}
                    placeholder="예: OK캐쉬백 푸쉬광고"
                    required
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="노출량"
                      type="number"
                      value={formData.impressions}
                      onChange={(e) => setFormData({ ...formData, impressions: parseInt(e.target.value) || 0 })}
                      min={0}
                      required
                    />
                    <Input
                      label="클릭수"
                      type="number"
                      value={formData.clicks}
                      onChange={(e) => setFormData({ ...formData, clicks: parseInt(e.target.value) || 0 })}
                      min={0}
                      required
                    />
                  </div>
                  
                  {/* 클릭율 미리보기 */}
                  <div className="p-4 bg-dashboard-bg rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-dashboard-muted">클릭율 (자동 계산)</span>
                      <span className="text-lg font-bold text-maze-500">
                        {calculateClickRate(formData.clicks, formData.impressions)}%
                      </span>
                    </div>
                  </div>
                </>
              )}
              
              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setShowModal(false)
                    setEditingLog(null)
                    resetForm()
                  }}
                >
                  취소
                </Button>
                <Button type="submit" isLoading={isLoading}>
                  {editingLog ? '수정' : '등록'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
