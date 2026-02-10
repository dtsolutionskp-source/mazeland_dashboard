'use client'

import { useState, useEffect } from 'react'
import { Header } from '@/components/dashboard/Header'
import { Card } from '@/components/ui'
import { RefreshCw, Trash2, Database, AlertCircle, CheckCircle } from 'lucide-react'

interface DbStatus {
  timestamp: string
  database: {
    monthlySummaries: { id: string; year: number; month: number; onlineTotal: number; offlineTotal: number; grandTotal: number }[]
    uploadHistories: { id: string; fileName: string; periodStart: string; periodEnd: string }[]
    monthlyAggs: { id: string; year: number; month: number }[]
    onlineSaleCount: number
    offlineSaleCount: number
    error?: string
  }
  summary: {
    dbSummaryCount: number
    dbHistoryCount: number
    dbAggCount: number
  }
}

export default function DebugPage() {
  const [status, setStatus] = useState<DbStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionResult, setActionResult] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const loadStatus = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/debug-data')
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }
      const data = await res.json()
      setStatus(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '데이터 로드 실패')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStatus()
  }, [])

  const deleteMonth = async (year: number, month: number) => {
    if (!confirm(`${year}년 ${month}월 데이터를 삭제하시겠습니까?`)) return
    
    setIsDeleting(true)
    setActionResult(null)
    try {
      const res = await fetch(`/api/debug-data?year=${year}&month=${month}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      setActionResult(`삭제 완료: ${JSON.stringify(data.deletedItems)}`)
      loadStatus()
    } catch (err) {
      setActionResult(`삭제 실패: ${err instanceof Error ? err.message : '알 수 없는 오류'}`)
    } finally {
      setIsDeleting(false)
    }
  }

  const deleteAll = async () => {
    if (!confirm('모든 데이터를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return
    if (!confirm('정말로 삭제하시겠습니까?')) return
    
    setIsDeleting(true)
    setActionResult(null)
    try {
      const res = await fetch('/api/debug-data?all=true', {
        method: 'DELETE',
      })
      const data = await res.json()
      setActionResult(`전체 삭제 완료: ${data.message}`)
      loadStatus()
    } catch (err) {
      setActionResult(`삭제 실패: ${err instanceof Error ? err.message : '알 수 없는 오류'}`)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="min-h-screen bg-dashboard-bg">
      <Header title="데이터베이스 디버그" description="DB 상태 확인 및 데이터 관리" />
      
      <div className="p-8 space-y-6">
        {/* 액션 버튼 */}
        <div className="flex gap-4">
          <button
            onClick={loadStatus}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            새로고침
          </button>
          <button
            onClick={deleteAll}
            disabled={isDeleting}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            전체 삭제
          </button>
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="p-4 bg-red-500/20 border border-red-500 rounded-lg text-red-400 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        )}

        {/* 액션 결과 */}
        {actionResult && (
          <div className="p-4 bg-green-500/20 border border-green-500 rounded-lg text-green-400 flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            {actionResult}
          </div>
        )}

        {/* 요약 */}
        {status && (
          <Card className="p-6">
            <h2 className="text-lg font-bold text-dashboard-text mb-4 flex items-center gap-2">
              <Database className="w-5 h-5 text-maze-500" />
              DB 요약
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-dashboard-muted">월별 요약:</span>
                <span className="ml-2 text-dashboard-text font-bold">{status.summary?.dbSummaryCount || 0}개</span>
              </div>
              <div>
                <span className="text-dashboard-muted">업로드 기록:</span>
                <span className="ml-2 text-dashboard-text font-bold">{status.summary?.dbHistoryCount || 0}개</span>
              </div>
              <div>
                <span className="text-dashboard-muted">온라인 판매:</span>
                <span className="ml-2 text-dashboard-text font-bold">{status.database?.onlineSaleCount || 0}개</span>
              </div>
              <div>
                <span className="text-dashboard-muted">오프라인 판매:</span>
                <span className="ml-2 text-dashboard-text font-bold">{status.database?.offlineSaleCount || 0}개</span>
              </div>
            </div>
          </Card>
        )}

        {/* 월별 데이터 목록 */}
        {status?.database?.monthlySummaries && status.database.monthlySummaries.length > 0 && (
          <Card className="p-6">
            <h2 className="text-lg font-bold text-dashboard-text mb-4">저장된 월별 데이터</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-dashboard-border">
                    <th className="text-left py-2 px-3 text-dashboard-muted">연월</th>
                    <th className="text-right py-2 px-3 text-dashboard-muted">온라인</th>
                    <th className="text-right py-2 px-3 text-dashboard-muted">오프라인</th>
                    <th className="text-right py-2 px-3 text-dashboard-muted">총합</th>
                    <th className="text-center py-2 px-3 text-dashboard-muted">액션</th>
                  </tr>
                </thead>
                <tbody>
                  {status.database.monthlySummaries.map((s) => (
                    <tr key={s.id} className="border-b border-dashboard-border/50 hover:bg-dashboard-border/20">
                      <td className="py-2 px-3 text-dashboard-text font-medium">
                        {s.year}년 {s.month}월
                      </td>
                      <td className="py-2 px-3 text-right text-blue-400">
                        {s.onlineTotal?.toLocaleString()}명
                      </td>
                      <td className="py-2 px-3 text-right text-orange-400">
                        {s.offlineTotal?.toLocaleString()}명
                      </td>
                      <td className="py-2 px-3 text-right text-dashboard-text font-bold">
                        {s.grandTotal?.toLocaleString()}명
                      </td>
                      <td className="py-2 px-3 text-center">
                        <button
                          onClick={() => deleteMonth(s.year, s.month)}
                          disabled={isDeleting}
                          className="px-3 py-1 bg-red-600/20 text-red-400 rounded hover:bg-red-600/40 disabled:opacity-50"
                        >
                          삭제
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* 데이터 없음 */}
        {status && (!status.database?.monthlySummaries || status.database.monthlySummaries.length === 0) && (
          <Card className="p-6 text-center text-dashboard-muted">
            <Database className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>저장된 데이터가 없습니다.</p>
            <p className="text-sm mt-2">데이터 입력 탭에서 엑셀 파일을 업로드하세요.</p>
          </Card>
        )}

        {/* 타임스탬프 */}
        {status && (
          <div className="text-xs text-dashboard-muted text-right">
            마지막 조회: {new Date(status.timestamp).toLocaleString('ko-KR')}
          </div>
        )}
      </div>
    </div>
  )
}
