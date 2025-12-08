'use client'

import { useState } from 'react'
import { Header } from '@/components/dashboard/Header'
import { Card, CardHeader, Button, Input } from '@/components/ui'
import { cn } from '@/lib/utils'
import {
  Sparkles,
  RefreshCw,
  Calendar,
  BarChart3,
  TrendingUp,
  Lightbulb,
  Copy,
  Check,
} from 'lucide-react'

type InsightType = 'weekly' | 'monthly' | 'channel' | 'custom'

const INSIGHT_TYPES = [
  { id: 'weekly' as const, label: '주간 분석', icon: Calendar, description: '이번 주 핵심 지표와 다음 주 전략' },
  { id: 'monthly' as const, label: '월간 분석', icon: TrendingUp, description: '월 종합 분석과 다음 달 방향' },
  { id: 'channel' as const, label: '채널 분석', icon: BarChart3, description: '채널별 성과와 최적화 전략' },
  { id: 'custom' as const, label: '맞춤 질문', icon: Lightbulb, description: '원하는 질문으로 분석' },
]

export default function InsightsPage() {
  const [selectedType, setSelectedType] = useState<InsightType>('weekly')
  const [customPrompt, setCustomPrompt] = useState('')
  const [insight, setInsight] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleGenerate = async () => {
    setIsLoading(true)
    setInsight('')

    try {
      const response = await fetch('/api/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: selectedType,
          customPrompt: selectedType === 'custom' ? customPrompt : undefined,
        }),
      })

      const data = await response.json()
      
      if (response.ok) {
        setInsight(data.insight)
      } else {
        setInsight(`오류: ${data.error}`)
      }
    } catch (error) {
      setInsight('네트워크 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(insight)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // 마크다운 스타일 렌더링
  const renderInsight = (text: string) => {
    return text.split('\n').map((line, i) => {
      if (line.startsWith('## ')) {
        return <h2 key={i} className="text-xl font-bold text-dashboard-text mt-6 mb-4">{line.replace('## ', '')}</h2>
      }
      if (line.startsWith('### ')) {
        return <h3 key={i} className="text-lg font-semibold text-maze-500 mt-4 mb-2">{line.replace('### ', '')}</h3>
      }
      if (line.startsWith('- **')) {
        const match = line.match(/- \*\*(.+?)\*\*:?\s*(.*)/)
        if (match) {
          return (
            <p key={i} className="text-dashboard-muted mb-1 ml-4">
              • <strong className="text-dashboard-text">{match[1]}</strong>{match[2] ? `: ${match[2]}` : ''}
            </p>
          )
        }
      }
      if (line.match(/^\d+\./)) {
        return <p key={i} className="text-dashboard-muted mb-2 ml-4">{line}</p>
      }
      if (line.startsWith('- ')) {
        return <p key={i} className="text-dashboard-muted mb-1 ml-4">• {line.replace('- ', '')}</p>
      }
      return line ? <p key={i} className="text-dashboard-muted mb-2">{line}</p> : <br key={i} />
    })
  }

  return (
    <div className="min-h-screen">
      <Header
        title="AI 인사이트"
        description="데이터 기반 마케팅 분석 및 전략 제안"
      />
      
      <div className="p-8 space-y-6">
        {/* 분석 유형 선택 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {INSIGHT_TYPES.map((type) => {
            const Icon = type.icon
            const isSelected = selectedType === type.id
            
            return (
              <button
                key={type.id}
                onClick={() => setSelectedType(type.id)}
                className={cn(
                  'p-6 rounded-xl border text-left transition-all duration-200',
                  isSelected
                    ? 'bg-maze-500/10 border-maze-500 ring-2 ring-maze-500/20'
                    : 'bg-dashboard-card border-dashboard-border hover:border-maze-500/50'
                )}
              >
                <div className={cn(
                  'w-10 h-10 rounded-lg flex items-center justify-center mb-4',
                  isSelected ? 'bg-maze-500 text-white' : 'bg-dashboard-border text-dashboard-muted'
                )}>
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-dashboard-text">{type.label}</h3>
                <p className="text-sm text-dashboard-muted mt-1">{type.description}</p>
              </button>
            )
          })}
        </div>

        {/* 맞춤 질문 입력 */}
        {selectedType === 'custom' && (
          <Card className="animate-slide-up">
            <CardHeader
              title="맞춤 질문"
              description="AI에게 분석해달라고 싶은 내용을 입력하세요"
            />
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="예: 11월 셋째 주 방문객 감소 원인을 분석하고 대응 방안을 제시해주세요."
              rows={3}
              className="w-full px-4 py-3 rounded-lg bg-dashboard-bg border border-dashboard-border text-dashboard-text placeholder-dashboard-muted focus:outline-none focus:ring-2 focus:ring-maze-500 resize-none"
            />
          </Card>
        )}

        {/* 생성 버튼 */}
        <div className="flex justify-center">
          <Button
            onClick={handleGenerate}
            isLoading={isLoading}
            size="lg"
            className="min-w-48"
          >
            <Sparkles className="w-5 h-5 mr-2" />
            {isLoading ? 'AI 분석 중...' : '인사이트 생성'}
          </Button>
        </div>

        {/* 결과 표시 */}
        {insight && (
          <Card className="relative animate-fade-in">
            {/* 데코레이션 */}
            <div className="absolute -right-10 -top-10 w-40 h-40 bg-maze-500/10 rounded-full blur-3xl" />
            <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl" />
            
            <div className="relative">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-maze-500/20 rounded-lg">
                    <Sparkles className="w-5 h-5 text-maze-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-dashboard-text">AI 인사이트</h3>
                    <p className="text-xs text-dashboard-muted">
                      {INSIGHT_TYPES.find(t => t.id === selectedType)?.label} 분석 결과
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopy}
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4 mr-1 text-maze-500" />
                        복사됨
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 mr-1" />
                        복사
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGenerate}
                    disabled={isLoading}
                  >
                    <RefreshCw className={cn('w-4 h-4 mr-1', isLoading && 'animate-spin')} />
                    재생성
                  </Button>
                </div>
              </div>
              
              <div className="prose prose-invert prose-sm max-w-none">
                {renderInsight(insight)}
              </div>
            </div>
          </Card>
        )}

        {/* 사용 가이드 */}
        {!insight && (
          <Card>
            <CardHeader title="사용 가이드" />
            <div className="space-y-4 text-sm text-dashboard-muted">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-maze-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-maze-500 text-xs font-bold">1</span>
                </div>
                <p>분석 유형을 선택합니다. 주간/월간/채널별 분석 또는 맞춤 질문이 가능합니다.</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-maze-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-maze-500 text-xs font-bold">2</span>
                </div>
                <p>인사이트 생성 버튼을 클릭하면 AI가 현재 데이터를 분석하여 결과를 제공합니다.</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-maze-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-maze-500 text-xs font-bold">3</span>
                </div>
                <p>결과가 마음에 들지 않으면 재생성 버튼으로 다시 분석할 수 있습니다.</p>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}



