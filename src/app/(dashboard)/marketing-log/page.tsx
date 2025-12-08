'use client'

import { useState, useEffect } from 'react'
import { Header } from '@/components/dashboard/Header'
import { Card, CardHeader, Button, Input, Select } from '@/components/ui'
import { formatDate, formatDateTime } from '@/lib/utils'
import { cn } from '@/lib/utils'
import {
  Plus,
  Calendar,
  Tag,
  FileText,
  Trash2,
  Edit,
  X,
  Megaphone,
  Cloud,
  PartyPopper,
  Wrench,
  MoreHorizontal,
} from 'lucide-react'

interface MarketingLog {
  id: string
  logDate: string
  logType: 'CAMPAIGN' | 'WEATHER' | 'EVENT' | 'MAINTENANCE' | 'OTHER'
  title: string
  content: string
  impact?: string
  createdBy: {
    name: string
    email: string
  }
  createdAt: string
}

const LOG_TYPES = [
  { value: 'CAMPAIGN', label: '캠페인', icon: Megaphone, color: 'text-blue-500 bg-blue-500/20' },
  { value: 'WEATHER', label: '날씨', icon: Cloud, color: 'text-yellow-500 bg-yellow-500/20' },
  { value: 'EVENT', label: '행사', icon: PartyPopper, color: 'text-purple-500 bg-purple-500/20' },
  { value: 'MAINTENANCE', label: '공사/점검', icon: Wrench, color: 'text-orange-500 bg-orange-500/20' },
  { value: 'OTHER', label: '기타', icon: MoreHorizontal, color: 'text-gray-500 bg-gray-500/20' },
]

// 임시 데이터
const mockLogs: MarketingLog[] = [
  {
    id: '1',
    logDate: '2024-11-11',
    logType: 'CAMPAIGN',
    title: '네이버 쿠폰 이벤트 시작',
    content: '네이버 스마트스토어 10% 할인 쿠폰 이벤트 시작. 11월 말까지 진행 예정.',
    impact: '일 평균 방문객 15% 증가 예상',
    createdBy: { name: 'SKP 담당자', email: 'skp@mazeland.com' },
    createdAt: '2024-11-11T09:00:00Z',
  },
  {
    id: '2',
    logDate: '2024-11-17',
    logType: 'EVENT',
    title: '제주 마라톤 대회',
    content: '제주 국제 마라톤 대회로 인해 주변 관광객 급증. 셔틀버스 추가 운행.',
    impact: '일 최고 방문객 155명 달성',
    createdBy: { name: '메이즈랜드 담당자', email: 'maze@mazeland.com' },
    createdAt: '2024-11-17T10:30:00Z',
  },
  {
    id: '3',
    logDate: '2024-11-24',
    logType: 'WEATHER',
    title: '기온 급강하',
    content: '한파 경보로 기온 영하 5도. 실외 활동 위축.',
    impact: '전일 대비 방문객 20% 감소',
    createdBy: { name: '운영대행사 담당자', email: 'agency@mazeland.com' },
    createdAt: '2024-11-24T08:00:00Z',
  },
]

export default function MarketingLogPage() {
  const [logs, setLogs] = useState<MarketingLog[]>(mockLogs)
  const [isLoading, setIsLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editingLog, setEditingLog] = useState<MarketingLog | null>(null)
  const [filter, setFilter] = useState('ALL')
  
  // 폼 상태
  const [formData, setFormData] = useState({
    logDate: new Date().toISOString().split('T')[0],
    logType: 'CAMPAIGN' as const,
    title: '',
    content: '',
    impact: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    
    try {
      // 실제로는 API 호출
      const newLog: MarketingLog = {
        id: Date.now().toString(),
        ...formData,
        createdBy: { name: '현재 사용자', email: 'user@mazeland.com' },
        createdAt: new Date().toISOString(),
      }
      
      if (editingLog) {
        setLogs(logs.map(l => l.id === editingLog.id ? { ...newLog, id: editingLog.id } : l))
      } else {
        setLogs([newLog, ...logs])
      }
      
      setShowModal(false)
      setEditingLog(null)
      setFormData({
        logDate: new Date().toISOString().split('T')[0],
        logType: 'CAMPAIGN',
        title: '',
        content: '',
        impact: '',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleEdit = (log: MarketingLog) => {
    setEditingLog(log)
    setFormData({
      logDate: log.logDate,
      logType: log.logType,
      title: log.title,
      content: log.content,
      impact: log.impact || '',
    })
    setShowModal(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return
    setLogs(logs.filter(l => l.id !== id))
  }

  const filteredLogs = filter === 'ALL' 
    ? logs 
    : logs.filter(l => l.logType === filter)

  const getLogTypeInfo = (type: string) => {
    return LOG_TYPES.find(t => t.value === type) || LOG_TYPES[4]
  }

  return (
    <div className="min-h-screen">
      <Header
        title="마케팅 로그"
        description="캠페인, 이슈, 날씨 등 마케팅 관련 이벤트를 기록합니다"
      />
      
      <div className="p-8 space-y-6">
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
              className="w-40"
            />
          </div>
          <Button onClick={() => setShowModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            새 로그 등록
          </Button>
        </div>

        {/* 로그 목록 */}
        <div className="space-y-4">
          {filteredLogs.length === 0 ? (
            <Card>
              <div className="text-center py-12">
                <FileText className="w-12 h-12 text-dashboard-muted mx-auto mb-4" />
                <p className="text-dashboard-muted">등록된 로그가 없습니다.</p>
              </div>
            </Card>
          ) : (
            filteredLogs.map((log, index) => {
              const typeInfo = getLogTypeInfo(log.logType)
              const TypeIcon = typeInfo.icon
              
              return (
                <Card
                  key={log.id}
                  className="animate-slide-up"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex items-start gap-4">
                    {/* 타입 아이콘 */}
                    <div className={cn('p-3 rounded-lg', typeInfo.color)}>
                      <TypeIcon className="w-5 h-5" />
                    </div>
                    
                    {/* 내용 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-lg font-semibold text-dashboard-text">
                            {log.title}
                          </h3>
                          <div className="flex items-center gap-4 mt-1 text-sm text-dashboard-muted">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              {formatDate(log.logDate)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Tag className="w-4 h-4" />
                              {typeInfo.label}
                            </span>
                          </div>
                        </div>
                        
                        {/* 액션 버튼 */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEdit(log)}
                            className="p-2 text-dashboard-muted hover:text-dashboard-text hover:bg-dashboard-border rounded-lg transition-colors"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(log.id)}
                            className="p-2 text-dashboard-muted hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      
                      <p className="mt-3 text-dashboard-text">{log.content}</p>
                      
                      {log.impact && (
                        <div className="mt-3 p-3 bg-maze-500/10 rounded-lg">
                          <p className="text-sm text-maze-500">
                            <strong>영향:</strong> {log.impact}
                          </p>
                        </div>
                      )}
                      
                      <p className="mt-3 text-xs text-dashboard-muted">
                        작성: {log.createdBy.name} · {formatDateTime(log.createdAt)}
                      </p>
                    </div>
                  </div>
                </Card>
              )
            })
          )}
        </div>
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
                }}
                className="p-2 text-dashboard-muted hover:text-dashboard-text hover:bg-dashboard-border rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="날짜"
                  type="date"
                  value={formData.logDate}
                  onChange={(e) => setFormData({ ...formData, logDate: e.target.value })}
                  required
                />
                <Select
                  label="유형"
                  value={formData.logType}
                  onChange={(e) => setFormData({ ...formData, logType: e.target.value as any })}
                  options={LOG_TYPES.map(t => ({ value: t.value, label: t.label }))}
                />
              </div>
              
              <Input
                label="제목"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="이벤트 제목을 입력하세요"
                required
              />
              
              <div>
                <label className="block text-sm font-medium text-dashboard-text mb-1.5">
                  내용
                </label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="상세 내용을 입력하세요"
                  rows={4}
                  className="w-full px-4 py-2.5 rounded-lg bg-dashboard-card border border-dashboard-border text-dashboard-text placeholder-dashboard-muted focus:outline-none focus:ring-2 focus:ring-maze-500 focus:border-transparent transition-all duration-200 resize-none"
                  required
                />
              </div>
              
              <Input
                label="영향/결과 (선택)"
                value={formData.impact}
                onChange={(e) => setFormData({ ...formData, impact: e.target.value })}
                placeholder="예: 방문객 15% 증가"
              />
              
              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setShowModal(false)
                    setEditingLog(null)
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



