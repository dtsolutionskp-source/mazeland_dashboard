'use client'

import { useState, useMemo } from 'react'
import { Header } from '@/components/dashboard/Header'
import { Card, CardHeader, Button, Select } from '@/components/ui'
import { cn } from '@/lib/utils'
import {
  Sparkles,
  RefreshCw,
  Calendar,
  TrendingUp,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

type InsightType = 'weekly' | 'monthly'

const INSIGHT_TYPES = [
  { id: 'weekly' as const, label: '주간 분석', icon: Calendar, description: '선택한 주의 핵심 지표와 전략' },
  { id: 'monthly' as const, label: '월간 분석', icon: TrendingUp, description: '선택한 월의 종합 분석' },
]

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

// 해당 주의 시작일(일요일)과 종료일(토요일) 계산
function getWeekRange(date: Date) {
  const start = new Date(date)
  start.setDate(date.getDate() - date.getDay())
  start.setHours(0, 0, 0, 0)
  
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  end.setHours(23, 59, 59, 999)
  
  return { start, end }
}

// 주차 계산
function getWeekNumber(date: Date) {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1)
  const dayOfMonth = date.getDate()
  const dayOfWeek = firstDay.getDay()
  return Math.ceil((dayOfMonth + dayOfWeek) / 7)
}

export default function InsightsPage() {
  const [selectedType, setSelectedType] = useState<InsightType>('weekly')
  const [insight, setInsight] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  
  // 날짜 선택 상태
  const now = new Date()
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1)
  const [selectedWeekStart, setSelectedWeekStart] = useState(() => {
    const { start } = getWeekRange(now)
    return start
  })
  
  // 캘린더 표시 상태
  const [calendarYear, setCalendarYear] = useState(now.getFullYear())
  const [calendarMonth, setCalendarMonth] = useState(now.getMonth() + 1)
  const [showWeekCalendar, setShowWeekCalendar] = useState(false)
  
  // 연도 옵션 생성 (2024~현재+1)
  const yearOptions = useMemo(() => {
    const years = []
    for (let y = 2024; y <= now.getFullYear() + 1; y++) {
      years.push({ value: y.toString(), label: `${y}년` })
    }
    return years
  }, [now])
  
  // 월 옵션 생성
  const monthOptions = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => ({
      value: (i + 1).toString(),
      label: `${i + 1}월`,
    }))
  }, [])
  
  // 캘린더 데이터
  const calendarData = useMemo(() => {
    const firstDay = new Date(calendarYear, calendarMonth - 1, 1)
    const lastDay = new Date(calendarYear, calendarMonth, 0)
    const daysInMonth = lastDay.getDate()
    const startWeekday = firstDay.getDay()
    
    return { daysInMonth, startWeekday }
  }, [calendarYear, calendarMonth])
  
  // 선택된 기간 라벨
  const selectedPeriodLabel = useMemo(() => {
    if (selectedType === 'weekly') {
      const weekNum = getWeekNumber(selectedWeekStart)
      const endDate = new Date(selectedWeekStart)
      endDate.setDate(selectedWeekStart.getDate() + 6)
      return `${selectedWeekStart.getFullYear()}년 ${selectedWeekStart.getMonth() + 1}월 ${weekNum}주차 (${selectedWeekStart.getMonth() + 1}/${selectedWeekStart.getDate()} ~ ${endDate.getMonth() + 1}/${endDate.getDate()})`
    } else if (selectedType === 'monthly') {
      return `${selectedYear}년 ${selectedMonth}월`
    }
    return ''
  }, [selectedType, selectedWeekStart, selectedYear, selectedMonth])

  const handleGenerate = async () => {
    setIsLoading(true)
    setInsight('')

    try {
      // 선택한 날짜 정보 생성
      let startDate: string | undefined
      let endDate: string | undefined
      
      if (selectedType === 'weekly') {
        const { start, end } = getWeekRange(selectedWeekStart)
        startDate = start.toISOString()
        endDate = end.toISOString()
      } else if (selectedType === 'monthly') {
        const start = new Date(selectedYear, selectedMonth - 1, 1)
        const end = new Date(selectedYear, selectedMonth, 0, 23, 59, 59, 999)
        startDate = start.toISOString()
        endDate = end.toISOString()
      }
      
      const response = await fetch('/api/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: selectedType,
          startDate,
          endDate,
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
  
  // 주 선택 핸들러
  const handleWeekSelect = (day: number) => {
    const selectedDate = new Date(calendarYear, calendarMonth - 1, day)
    const { start } = getWeekRange(selectedDate)
    setSelectedWeekStart(start)
    setShowWeekCalendar(false)
  }
  
  // 캘린더 월 이동
  const handlePrevMonth = () => {
    if (calendarMonth === 1) {
      setCalendarMonth(12)
      setCalendarYear(calendarYear - 1)
    } else {
      setCalendarMonth(calendarMonth - 1)
    }
  }
  
  const handleNextMonth = () => {
    if (calendarMonth === 12) {
      setCalendarMonth(1)
      setCalendarYear(calendarYear + 1)
    } else {
      setCalendarMonth(calendarMonth + 1)
    }
  }
  
  // 날짜가 선택된 주에 포함되는지 확인
  const isInSelectedWeek = (day: number) => {
    const date = new Date(calendarYear, calendarMonth - 1, day)
    const { start, end } = getWeekRange(selectedWeekStart)
    return date >= start && date <= end
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
        
        {/* 날짜 선택 영역 */}
        <Card className="animate-slide-up">
            <CardHeader
              title="분석 기간 선택"
              description={selectedType === 'weekly' ? '분석할 주를 선택하세요' : '분석할 연월을 선택하세요'}
            />
            
            {selectedType === 'weekly' ? (
              // 주간 분석: 캘린더로 주 선택
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setShowWeekCalendar(!showWeekCalendar)}
                    className="flex items-center gap-2 px-4 py-3 bg-dashboard-bg border border-dashboard-border rounded-lg hover:border-maze-500 transition-colors"
                  >
                    <Calendar className="w-5 h-5 text-maze-500" />
                    <span className="text-dashboard-text font-medium">{selectedPeriodLabel}</span>
                  </button>
                </div>
                
                {showWeekCalendar && (
                  <div className="p-4 bg-dashboard-bg border border-dashboard-border rounded-lg max-w-md">
                    {/* 캘린더 헤더 */}
                    <div className="flex items-center justify-between mb-4">
                      <button
                        onClick={handlePrevMonth}
                        className="p-2 hover:bg-dashboard-border rounded-lg transition-colors"
                      >
                        <ChevronLeft className="w-5 h-5 text-dashboard-muted" />
                      </button>
                      <span className="text-sm font-medium text-dashboard-text">
                        {calendarYear}년 {calendarMonth}월
                      </span>
                      <button
                        onClick={handleNextMonth}
                        className="p-2 hover:bg-dashboard-border rounded-lg transition-colors"
                      >
                        <ChevronRight className="w-5 h-5 text-dashboard-muted" />
                      </button>
                    </div>
                    
                    {/* 요일 헤더 */}
                    <div className="grid grid-cols-7 gap-1 mb-2">
                      {WEEKDAYS.map((day, idx) => (
                        <div
                          key={day}
                          className={cn(
                            'text-center text-xs font-medium py-2',
                            idx === 0 ? 'text-red-400' : idx === 6 ? 'text-blue-400' : 'text-dashboard-muted'
                          )}
                        >
                          {day}
                        </div>
                      ))}
                    </div>
                    
                    {/* 날짜 그리드 */}
                    <div className="grid grid-cols-7 gap-1">
                      {/* 빈 칸 */}
                      {Array.from({ length: calendarData.startWeekday }).map((_, idx) => (
                        <div key={`empty-${idx}`} className="h-10" />
                      ))}
                      
                      {/* 날짜 */}
                      {Array.from({ length: calendarData.daysInMonth }).map((_, idx) => {
                        const day = idx + 1
                        const dayOfWeek = (calendarData.startWeekday + idx) % 7
                        const inSelectedWeek = isInSelectedWeek(day)
                        const isToday = 
                          calendarYear === now.getFullYear() &&
                          calendarMonth === now.getMonth() + 1 &&
                          day === now.getDate()
                        
                        return (
                          <button
                            key={day}
                            onClick={() => handleWeekSelect(day)}
                            className={cn(
                              'h-10 flex items-center justify-center rounded-lg transition-all text-sm',
                              inSelectedWeek
                                ? 'bg-maze-500 text-white font-semibold'
                                : 'hover:bg-dashboard-border',
                              !inSelectedWeek && isToday && 'ring-2 ring-maze-500',
                              !inSelectedWeek && dayOfWeek === 0 && 'text-red-400',
                              !inSelectedWeek && dayOfWeek === 6 && 'text-blue-400',
                              !inSelectedWeek && dayOfWeek !== 0 && dayOfWeek !== 6 && 'text-dashboard-text'
                            )}
                          >
                            {day}
                          </button>
                        )
                      })}
                    </div>
                    
                    <p className="text-xs text-dashboard-muted mt-4 text-center">
                      클릭하면 해당 날짜가 포함된 주(일~토)가 선택됩니다
                    </p>
                  </div>
                )}
              </div>
            ) : (
              // 월간 분석: 연월 선택
              <div className="flex items-center gap-4">
                <Select
                  value={selectedYear.toString()}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  options={yearOptions}
                  className="w-32"
                />
                <Select
                  value={selectedMonth.toString()}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                  options={monthOptions}
                  className="w-28"
                />
                <span className="text-dashboard-muted text-sm">
                  선택: <span className="text-dashboard-text font-medium">{selectedPeriodLabel}</span>
                </span>
              </div>
            )}
          </Card>

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
                <p><strong>분석 기간을 선택합니다.</strong> 주간 분석은 캘린더에서 원하는 주를 선택하고, 월간/채널 분석은 연월을 선택합니다.</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-maze-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-maze-500 text-xs font-bold">3</span>
                </div>
                <p>인사이트 생성 버튼을 클릭하면 AI가 선택한 기간의 데이터를 분석하여 결과를 제공합니다.</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-maze-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-maze-500 text-xs font-bold">4</span>
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
