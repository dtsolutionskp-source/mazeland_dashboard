'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { useDropzone } from 'react-dropzone'
import { Header } from '@/components/dashboard/Header'
import { MonthSelector } from '@/components/dashboard/MonthSelector'
import { ManualInputForm } from '@/components/sales/ManualInputForm'
import { Card, CardHeader, Button } from '@/components/ui'
import { formatNumber, cn } from '@/lib/utils'
import { useDashboardStore } from '@/stores/dashboard-store'
import type {
  DataSource,
  ChannelSalesData,
  CategorySalesData,
  MonthlyAggData,
  MasterData,
} from '@/types/sales-input'
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  Loader2,
  Database,
  Calendar,
  FileUp,
  PenLine,
  Layers,
} from 'lucide-react'

const BASE_PRICE = 3000

type InputModeOption = {
  value: DataSource
  label: string
  icon: React.ComponentType<any>
  description: string
}

const INPUT_MODES: InputModeOption[] = [
  {
    value: 'file',
    label: '엑셀 업로드',
    icon: FileUp,
    description: '엑셀 파일을 업로드하여 데이터 입력',
  },
  {
    value: 'manual',
    label: '수기 입력',
    icon: PenLine,
    description: '채널별/구분별로 직접 입력',
  },
  {
    value: 'mixed',
    label: '혼합',
    icon: Layers,
    description: '업로드 후 수기 수정',
  },
]

interface DailyData {
  date: string
  online: number
  offline: number
  total: number
  isEdited?: boolean
}

interface UploadResult {
  success: boolean
  uploadId?: string
  dbSaved?: boolean
  summary?: {
    periodStart: string
    periodEnd: string
    onlineCount: number
    offlineCount: number
    totalCount: number
    onlineRecords: number
    offlineRecords: number
  }
  dailyData?: DailyData[]
  channels?: Record<string, { name: string; count: number; feeRate: number }>
  categories?: Record<string, { name: string; count: number }>
  monthly?: any
  settlement?: any
  message?: string
  error?: string
}

export default function UploadPage() {
  // 입력 모드(DataSource로 통일)
  const [inputMode, setInputMode] = useState<DataSource>('file')

  // 파일 업로드 관련
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null)

  // 수기 입력 관련
  const [masterData, setMasterData] = useState<MasterData | null>(null)
  const [existingData, setExistingData] = useState<MonthlyAggData | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoadingData, setIsLoadingData] = useState(false)

  // 혼합 모드: 업로드 후 수기 수정용 데이터
  const [editableChannels, setEditableChannels] = useState<ChannelSalesData[]>([])
  const [editableCategories, setEditableCategories] = useState<CategorySalesData[]>([])
  const [hasChanges, setHasChanges] = useState(false)

  // Zustand store
  const { year, month, setYearMonth } = useDashboardStore()

  // 마스터 데이터 및 기존 데이터 로드
  useEffect(() => {
    void loadMasterAndData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month])

  const loadMasterAndData = async () => {
    setIsLoadingData(true)
    try {
      const response = await fetch(`/api/sales-data?year=${year}&month=${month}`)
      const result = await response.json()

      if (result.masterData) {
        setMasterData(result.masterData)
      }

      if (result.data) {
        setExistingData(result.data)
        // 혼합 모드용 데이터 초기화
        setEditableChannels(result.data.channels || [])
        setEditableCategories(result.data.categories || [])
      } else {
        setExistingData(null)
        setEditableChannels([])
        setEditableCategories([])
      }
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setIsLoadingData(false)
    }
  }

  // 파일 드롭
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0])
      setUploadResult(null)
      setHasChanges(false)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
    maxFiles: 1,
  })

  // 업로드 결과로 수정 가능 데이터 초기화
  const initializeEditableDataFromUpload = (data: any) => {
    if (!masterData) return

    const channels: ChannelSalesData[] = masterData.channels.map((master: any) => {
      const uploaded = data.channels?.[master.code]
      return {
        channelCode: master.code,
        channelName: master.name,
        feeRate: master.defaultFeeRate,
        count: uploaded?.count || 0,
      }
    })
    setEditableChannels(channels)

    const categories: CategorySalesData[] = masterData.categories.map((master: any) => {
      const uploaded = data.categories?.[master.code]
      return {
        categoryCode: master.code,
        categoryName: master.name,
        count: uploaded?.count || 0,
      }
    })
    setEditableCategories(categories)
  }

  // 파일 업로드 (파싱)
  const handleUpload = async () => {
    if (!file) return

    setIsUploading(true)
    setUploadResult(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (response.ok) {
        setUploadResult({ success: true, ...data })

        // 혼합 모드: 업로드 결과로 수정 가능 데이터 초기화
        if (inputMode === 'mixed' && masterData) {
          initializeEditableDataFromUpload(data)
        }

        // 연/월 동기화
        if (data.summary?.periodStart) {
          const date = new Date(data.summary.periodStart)
          setYearMonth(date.getFullYear(), date.getMonth() + 1)
        }
      } else {
        setUploadResult({ success: false, error: data.error || '업로드 실패' })
      }
    } catch (error) {
      setUploadResult({ success: false, error: '네트워크 오류가 발생했습니다.' })
    } finally {
      setIsUploading(false)
    }
  }

  // 수기 입력/혼합 모드 저장
  const handleSaveManualData = async (saveData: {
    channels: ChannelSalesData[]
    categories: CategorySalesData[]
    source: DataSource
  }) => {
    setIsSaving(true)
    try {
      const response = await fetch('/api/sales-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year,
          month,
          source: saveData.source,
          channels: saveData.channels,
          categories: saveData.categories,
          dailyData: uploadResult?.dailyData || existingData?.dailyData,
        }),
      })

      const result = await response.json()

      if (response.ok) {
        alert(`${year}년 ${month}월 데이터가 저장되었습니다.\n대시보드에 반영됩니다.`)
        setHasChanges(false)
        await loadMasterAndData() // 데이터 새로고침
      } else {
        alert(result.error || '저장 실패')
      }
    } catch (error) {
      alert('네트워크 오류가 발생했습니다.')
    } finally {
      setIsSaving(false)
    }
  }

  // 실시간 정산 계산 (혼합 모드용)
  const calculatedSettlement = useMemo(() => {
    if (editableChannels.length === 0) return null

    const MAZE_UNIT = 1000
    const CULTURE_UNIT = 1000
    const PLATFORM_FEE_UNIT = 200
    const AGENCY_RATE = 0.2

    let skpOnlineNet = 0
    let mazeOnlineNet = 0
    let cultureOnlineNet = 0
    let platformFeeOnline = 0
    let onlineCount = 0

    for (const ch of editableChannels) {
      const feeRatio = (ch.feeRate || 10) / 100
      skpOnlineNet += Math.round(BASE_PRICE * (1 - feeRatio) * ch.count)
      mazeOnlineNet += Math.round(MAZE_UNIT * (1 - feeRatio) * ch.count)
      cultureOnlineNet += Math.round(CULTURE_UNIT * (1 - feeRatio) * ch.count)
      platformFeeOnline += Math.round(PLATFORM_FEE_UNIT * (1 - feeRatio) * ch.count)
      onlineCount += ch.count
    }

    let offlineCount = 0
    for (const cat of editableCategories) {
      offlineCount += cat.count
    }

    const skpOffline = BASE_PRICE * offlineCount
    const mazeOffline = MAZE_UNIT * offlineCount
    const cultureOffline = CULTURE_UNIT * offlineCount
    const platformFeeOffline = PLATFORM_FEE_UNIT * offlineCount

    const skpTicketRevenue = skpOnlineNet + skpOffline
    const mazeRevenue = mazeOnlineNet + mazeOffline
    const cultureGrossRevenue = cultureOnlineNet + cultureOffline
    const totalPlatformFee = platformFeeOnline + platformFeeOffline

    const skpNetBeforeAgency = skpTicketRevenue - mazeRevenue - cultureGrossRevenue
    const agencyRevenue = Math.round(skpNetBeforeAgency * AGENCY_RATE)

    const cultureCost = totalPlatformFee
    const cultureProfit = cultureGrossRevenue - cultureCost

    const skpTotalIncome = skpTicketRevenue + totalPlatformFee
    const skpCost = mazeRevenue + cultureGrossRevenue + agencyRevenue
    const skpProfit = skpTotalIncome - skpCost

    return {
      skp: { revenue: skpTicketRevenue, income: skpTotalIncome, profit: skpProfit },
      maze: { revenue: mazeRevenue, profit: mazeRevenue },
      culture: { revenue: cultureGrossRevenue, cost: cultureCost, profit: cultureProfit },
      agency: { revenue: agencyRevenue, profit: agencyRevenue },
      platformFee: totalPlatformFee,
      totalNet: skpTicketRevenue,
      onlineCount,
      offlineCount,
      totalCount: onlineCount + offlineCount,
    }
  }, [editableChannels, editableCategories])

  return (
    <div className="min-h-screen">
      <Header title="데이터 입력" description="판매 데이터를 업로드하거나 직접 입력합니다" />

      <div className="p-8 space-y-6">
        {/* 입력 모드 선택 */}
        <Card>
          <CardHeader title="입력 방식 선택" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {INPUT_MODES.map((mode) => {
              const Icon = mode.icon
              return (
                <button
                  key={mode.value}
                  onClick={() => {
                    setInputMode(mode.value)
                    setUploadResult(null)
                    setFile(null)
                    setHasChanges(false)
                  }}
                  className={cn(
                    'flex flex-col items-center gap-3 p-6 rounded-xl border-2 transition-all',
                    inputMode === mode.value
                      ? 'border-maze-500 bg-maze-500/10'
                      : 'border-dashboard-border hover:border-maze-500/50 hover:bg-dashboard-border/30'
                  )}
                >
                  <Icon
                    className={cn(
                      'w-8 h-8',
                      inputMode === mode.value ? 'text-maze-500' : 'text-dashboard-muted'
                    )}
                  />
                  <span
                    className={cn(
                      'font-medium',
                      inputMode === mode.value ? 'text-maze-500' : 'text-dashboard-text'
                    )}
                  >
                    {mode.label}
                  </span>
                  <span className="text-xs text-dashboard-muted text-center">{mode.description}</span>
                </button>
              )
            })}
          </div>
        </Card>

        {/* 월 선택 */}
        <Card>
          <CardHeader title="데이터 기간 선택" />
          <div className="flex items-center gap-4">
            <Calendar className="w-5 h-5 text-dashboard-muted" />
            <MonthSelector />
            {existingData && (
              <span className="flex items-center gap-1 px-3 py-1 bg-blue-500/20 text-blue-500 text-xs rounded-full">
                <Database className="w-3 h-3" />
                기존 데이터 있음 (
                {existingData.source === 'manual'
                  ? '수기'
                  : existingData.source === 'file'
                    ? '업로드'
                    : '혼합'}
                )
              </span>
            )}
          </div>
        </Card>

        {/* 엑셀 업로드 모드 */}
        {(inputMode === 'file' || inputMode === 'mixed') && (
          <Card>
            <CardHeader
              title="엑셀 파일 업로드"
              description="판매인원공유 형식의 엑셀 파일(.xlsx, .xls)을 업로드해주세요"
            />

            <div
              {...getRootProps()}
              className={cn(
                'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200',
                isDragActive
                  ? 'border-maze-500 bg-maze-500/10'
                  : 'border-dashboard-border hover:border-maze-500/50 hover:bg-dashboard-border/30'
              )}
            >
              <input {...getInputProps()} />

              <div className="flex flex-col items-center">
                {file ? (
                  <>
                    <FileSpreadsheet className="w-12 h-12 text-maze-500 mb-3" />
                    <p className="text-lg font-medium text-dashboard-text">{file.name}</p>
                    <p className="text-sm text-dashboard-muted mt-1">{(file.size / 1024).toFixed(1)} KB</p>
                  </>
                ) : (
                  <>
                    <Upload className="w-12 h-12 text-dashboard-muted mb-3" />
                    <p className="text-base font-medium text-dashboard-text">
                      {isDragActive ? '파일을 놓으세요' : '파일을 드래그하거나 클릭하여 선택'}
                    </p>
                    <p className="text-sm text-dashboard-muted mt-1">.xlsx, .xls 파일 지원</p>
                  </>
                )}
              </div>
            </div>

            {file && !uploadResult?.success && (
              <div className="mt-4 flex justify-end">
                <Button onClick={handleUpload} isLoading={isUploading} disabled={isUploading}>
                  {isUploading ? '파싱 중...' : '파일 분석'}
                </Button>
              </div>
            )}

            {/* 업로드 실패 */}
            {uploadResult && !uploadResult.success && (
              <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-3">
                <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-red-500">업로드 실패</p>
                  <p className="text-xs text-dashboard-muted mt-1">{uploadResult.error}</p>
                </div>
              </div>
            )}

            {/* 업로드 성공(파일 모드일 때만 표시) */}
            {uploadResult?.success && inputMode === 'file' && (
              <div className="mt-4 p-4 bg-maze-500/10 border border-maze-500/30 rounded-lg flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-maze-500 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-maze-500">업로드 성공</p>
                  <p className="text-xs text-dashboard-muted mt-1">
                    인터넷 {formatNumber(uploadResult.summary?.onlineCount || 0)}명, 현장{' '}
                    {formatNumber(uploadResult.summary?.offlineCount || 0)}명 (총{' '}
                    {formatNumber(uploadResult.summary?.totalCount || 0)}명)
                  </p>
                </div>
              </div>
            )}
          </Card>
        )}

        {/* 수기 입력 모드 */}
        {inputMode === 'manual' && masterData && (
          <ManualInputForm
            year={year}
            month={month}
            mode={inputMode}
            masterChannels={masterData.channels}
            masterCategories={masterData.categories}
            initialData={existingData}
            onSave={handleSaveManualData}
            isSaving={isSaving}
          />
        )}

        {/* 혼합 모드 */}
        {inputMode === 'mixed' && uploadResult?.success && masterData && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <Layers className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-sm font-medium text-blue-500">혼합 모드</p>
                <p className="text-xs text-dashboard-muted">
                  업로드된 데이터를 기반으로 수정할 수 있습니다. 아래에서 값을 수정한 후 저장하세요.
                </p>
              </div>
            </div>

            <ManualInputForm
              year={year}
              month={month}
              mode={inputMode}
              masterChannels={masterData.channels}
              masterCategories={masterData.categories}
              initialData={{
                year,
                month,
                source: 'mixed',
                uploadedAt: new Date().toISOString(),
                channels: editableChannels,
                categories: editableCategories,
                summary: {
                  onlineCount: calculatedSettlement?.onlineCount || 0,
                  offlineCount: calculatedSettlement?.offlineCount || 0,
                  totalCount: calculatedSettlement?.totalCount || 0,
                  onlineRevenue: 0,
                  onlineFee: 0,
                  onlineNetRevenue: calculatedSettlement?.totalNet || 0,
                  offlineRevenue: 0,
                  totalRevenue: 0,
                  totalNetRevenue: calculatedSettlement?.totalNet || 0,
                },
                dailyData: uploadResult.dailyData,
              }}
              onSave={handleSaveManualData}
              isSaving={isSaving}
            />
          </div>
        )}

        {/* 로딩 */}
        {isLoadingData && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-maze-500 animate-spin" />
          </div>
        )}
      </div>
    </div>
  )
}
