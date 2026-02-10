'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { useDropzone } from 'react-dropzone'
import { Header } from '@/components/dashboard/Header'
import { MonthSelector } from '@/components/dashboard/MonthSelector'
import { FeeSettingsPanel } from '@/components/sales/FeeSettingsPanel'
import { DailyInputTable } from '@/components/sales/DailyInputTable'
import { Card, CardHeader, Button } from '@/components/ui'
import { formatNumber, formatCurrency, cn } from '@/lib/utils'
import { useDashboardStore } from '@/stores/dashboard-store'
import {
  DataSource,
  DailyAggData,
  MonthlyAggData,
  MonthlyFeeSettings,
  MasterData,
} from '@/types/sales-data'
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  Loader2,
  Database,
  Calendar,
  FileUp,
  ListOrdered,
  Save,
  Edit3,
  RefreshCw,
  Percent,
  Plus,
  X,
  Trash2,
} from 'lucide-react'

const BASE_PRICE = 3000

// 입력 모드 옵션 (2가지만)
const INPUT_MODES = [
  { value: 'file' as const, label: '엑셀 업로드', icon: FileUp, description: '엑셀 파일 업로드 후 데이터 확인/수정' },
  { value: 'daily' as const, label: '일자별 입력', icon: ListOrdered, description: '일자 × 채널/구분별 직접 입력' },
]

type InputModeType = 'file' | 'daily'

// 채널 이름 매핑
const CHANNEL_NAMES: Record<string, string> = {
  NAVER_MAZE_25: '네이버 메이즈랜드25년',
  GENERAL_TICKET: '일반채널 입장권',
  MAZE_TICKET: '메이즈랜드 입장권',
  MAZE_TICKET_SINGLE: '메이즈랜드 입장권(단품)',
  OTHER: '기타',
}

// 카테고리 이름 매핑
const CATEGORY_NAMES: Record<string, string> = {
  INDIVIDUAL: '개인',
  TRAVEL_AGENCY: '여행사',
  TAXI: '택시',
  RESIDENT: '도민',
  ALL_PASS: '올패스',
  SHUTTLE_DISCOUNT: '순환버스할인',
  SCHOOL_GROUP: '학단',
  OTHER: '기타',
}

// 기본 채널 수수료율
const DEFAULT_CHANNEL_FEE_RATES: Record<string, number> = {
  NAVER_MAZE_25: 10,
  GENERAL_TICKET: 15,
  MAZE_TICKET: 12,
  MAZE_TICKET_SINGLE: 12,
  OTHER: 15,
}

interface DailyData {
  date: string
  online: number
  offline: number
  total: number
  isEdited?: boolean
  channelData?: Record<string, { count: number; feeRate: number }>
  categoryData?: Record<string, { count: number }>
}

interface ChannelData {
  name: string
  count: number
  feeRate: number
}

interface CategoryData {
  name: string
  count: number
}

interface DataValidation {
  excelOnlineTotal: number
  excelOfflineTotal: number
  calculatedOnlineTotal: number
  calculatedOfflineTotal: number
  hasOnlineMismatch: boolean
  hasOfflineMismatch: boolean
  hasMismatch: boolean
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
  }
  dailyData?: DailyData[]
  channels?: Record<string, ChannelData>
  categories?: Record<string, CategoryData>
  monthly?: any
  settlement?: any
  message?: string
  error?: string
  // 기존 데이터 병합용
  existingData?: {
    periodStart: string
    periodEnd: string
    dates: string[]
    summary: { onlineCount: number; offlineCount: number; totalCount: number }
  }
  overlappingDates?: string[]
  hasOverlap?: boolean
  // 데이터 검증 결과
  validation?: DataValidation
}

export default function DataInputPage() {
  // 입력 모드
  const [inputMode, setInputMode] = useState<InputModeType>('file')
  
  // 파일 업로드 관련
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null)
  
  // 수정 가능한 데이터 (엑셀 업로드 후)
  const [editableDailyData, setEditableDailyData] = useState<DailyData[]>([])
  const [editableChannels, setEditableChannels] = useState<Record<string, ChannelData>>({})
  const [editableCategories, setEditableCategories] = useState<Record<string, CategoryData>>({})
  const [hasChanges, setHasChanges] = useState(false)
  
  // 일자별 입력 모드용 데이터
  const [masterData, setMasterData] = useState<MasterData | null>(null)
  const [monthlyData, setMonthlyData] = useState<MonthlyAggData | null>(null)
  const [feeSettings, setFeeSettings] = useState<MonthlyFeeSettings | null>(null)
  const [dailyDataForInput, setDailyDataForInput] = useState<DailyAggData[]>([])
  
  // 로딩/저장 상태
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isSavingFee, setIsSavingFee] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  
  // 채널/카테고리 추가 모달
  const [showAddChannel, setShowAddChannel] = useState(false)
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [newChannelName, setNewChannelName] = useState('')
  const [newChannelFeeRate, setNewChannelFeeRate] = useState(10)
  const [newCategoryName, setNewCategoryName] = useState('')

  // Zustand store
  const { year, month, setYearMonth } = useDashboardStore()

  // 모드 변경 또는 연/월 변경 시 기존 데이터 로드
  useEffect(() => {
    loadExistingData()
  }, [year, month, inputMode])

  // 기존 데이터 로드 (엑셀 업로드 모드와 일자별 입력 모드 공통)
  const loadExistingData = async () => {
    setIsLoading(true)
    try {
      // 업로드 데이터 API에서 직접 조회 (엑셀 업로드와 일자별 입력 동일 소스)
      const response = await fetch(`/api/upload-data?year=${year}&month=${month}`)
      const result = await response.json()
      
      if (result.success) {
        setMasterData(result.masterData)
        setFeeSettings(result.feeSettings)
        
        if (result.hasData && result.uploadData) {
          const uploadData = result.uploadData
          console.log('[LoadData] Found upload data:', {
            dailyCount: uploadData.dailyData?.length,
            summary: uploadData.summary,
          })
          
          // 일별 데이터 설정 (channelData, categoryData 포함)
          const dailyList = (uploadData.dailyData || []).map((d: any) => ({
            date: d.date,
            online: d.online || 0,
            offline: d.offline || 0,
            total: d.total || (d.online || 0) + (d.offline || 0),
            isEdited: false,
            channelData: d.channelData || {},
            categoryData: d.categoryData || {},
          }))
          setEditableDailyData(dailyList)
          
          console.log('[LoadData] Daily list with channelData:', 
            dailyList.slice(0, 2).map((d: any) => ({
              date: d.date,
              online: d.online,
              hasChannelData: Object.keys(d.channelData || {}).length > 0,
              channelData: d.channelData,
            }))
          )
          
          // 채널 데이터 설정
          setEditableChannels(uploadData.channels || {})
          
          // 카테고리 데이터 설정
          setEditableCategories(uploadData.categories || {})
          
          // 일자별 입력용 DailyAggData 형식 변환
          // 일별 채널/카테고리별 데이터가 있으면 사용, 없으면 비율 배분
          const dailyAggData = (uploadData.dailyData || []).map((d: any) => {
            const hasChannelData = d.channelData && Object.keys(d.channelData).length > 0
            const hasCategoryData = d.categoryData && Object.keys(d.categoryData).length > 0
            
            // 채널별 데이터 생성
            let channelSales: any[]
            if (hasChannelData) {
              // 일별 상세 데이터 사용
              channelSales = Object.entries(d.channelData).map(([code, ch]: [string, any]) => ({
                date: d.date,
                channelCode: code,
                channelName: uploadData.channels?.[code]?.name || code,
                count: ch.count || 0,
                feeRate: ch.feeRate || uploadData.channels?.[code]?.feeRate || 10,
              }))
              
              // 월 합계에는 있지만 이 날에는 없는 채널 추가 (count: 0)
              for (const code of Object.keys(uploadData.channels || {})) {
                if (!d.channelData[code]) {
                  channelSales.push({
                    date: d.date,
                    channelCode: code,
                    channelName: uploadData.channels[code]?.name || code,
                    count: 0,
                    feeRate: uploadData.channels[code]?.feeRate || 10,
                  })
                }
              }
            } else {
              // 채널 데이터가 없으면 0으로 설정 (수기 입력 대기)
              channelSales = Object.entries(uploadData.channels || {}).map(([code, ch]: [string, any]) => ({
                date: d.date,
                channelCode: code,
                channelName: ch.name || code,
                count: 0,
                feeRate: ch.feeRate || 10,
              }))
            }
            
            // 카테고리별 데이터 생성
            let categorySales: any[]
            if (hasCategoryData) {
              categorySales = Object.entries(d.categoryData).map(([code, cat]: [string, any]) => ({
                date: d.date,
                categoryCode: code,
                categoryName: uploadData.categories?.[code]?.name || code,
                count: cat.count || 0,
              }))
              
              // 월 합계에는 있지만 이 날에는 없는 카테고리 추가
              for (const code of Object.keys(uploadData.categories || {})) {
                if (!d.categoryData[code]) {
                  categorySales.push({
                    date: d.date,
                    categoryCode: code,
                    categoryName: uploadData.categories[code]?.name || code,
                    count: 0,
                  })
                }
              }
            } else {
              categorySales = Object.entries(uploadData.categories || {}).map(([code, cat]: [string, any]) => ({
                date: d.date,
                categoryCode: code,
                categoryName: cat.name || code,
                count: 0,
              }))
            }
            
            return {
              date: d.date,
              channelSales,
              categorySales,
              summary: {
                date: d.date,
                onlineCount: d.online,
                offlineCount: d.offline,
                totalCount: d.total,
                onlineNetRevenue: 0,
                offlineRevenue: 0,
                totalNetRevenue: 0,
              },
              source: 'file' as const,
            }
          })
          setDailyDataForInput(dailyAggData)
          
          console.log('[LoadData] Daily data with channel details:', 
            dailyAggData.slice(0, 2).map((d: any) => ({
              date: d.date,
              channels: d.channelSales?.map((c: any) => `${c.channelCode}:${c.count}`),
              categories: d.categorySales?.map((c: any) => `${c.categoryCode}:${c.count}`),
            }))
          )
          
          // 업로드 결과 설정 (UI 표시용)
          setUploadResult({
            success: true,
            dbSaved: true,
            summary: {
              periodStart: uploadData.periodStart,
              periodEnd: uploadData.periodEnd,
              onlineCount: uploadData.summary.onlineCount,
              offlineCount: uploadData.summary.offlineCount,
              totalCount: uploadData.summary.totalCount,
            },
            existingData: {
              periodStart: uploadData.periodStart,
              periodEnd: uploadData.periodEnd,
              dates: dailyList.map((d: any) => d.date),
              summary: uploadData.summary,
            },
            hasOverlap: false,
            overlappingDates: [],
          })
          
          setHasChanges(false)
        } else {
          // 데이터 없음 - 초기화
          setEditableDailyData([])
          setEditableChannels({})
          setEditableCategories({})
          setDailyDataForInput([])
          setUploadResult(null)
        }
      }
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // 기존 월별 데이터로 편집 가능 데이터 초기화
  const initializeFromExistingData = (data: MonthlyAggData) => {
    // 일별 데이터 변환
    if (data.dailyData && data.dailyData.length > 0) {
      const dailyList = data.dailyData.map(d => ({
        date: d.date,
        online: d.summary?.onlineCount || d.channelSales?.reduce((sum, ch) => sum + ch.count, 0) || 0,
        offline: d.summary?.offlineCount || d.categorySales?.reduce((sum, cat) => sum + cat.count, 0) || 0,
        total: d.summary?.totalCount || 0,
        isEdited: false,
      }))
      setEditableDailyData(dailyList)
    }

    // 채널 데이터
    const channels: Record<string, ChannelData> = {}
    for (const ch of data.channelAggs || []) {
      channels[ch.channelCode] = {
        name: ch.channelName,
        count: ch.totalCount,
        feeRate: ch.avgFeeRate || DEFAULT_CHANNEL_FEE_RATES[ch.channelCode] || 10,
      }
    }
    setEditableChannels(channels)

    // 카테고리 데이터
    const categories: Record<string, CategoryData> = {}
    for (const cat of data.categoryAggs || []) {
      categories[cat.categoryCode] = {
        name: cat.categoryName,
        count: cat.totalCount,
      }
    }
    setEditableCategories(categories)

    // 업로드 결과 설정 (기존 데이터 표시용)
    setUploadResult({
      success: true,
      dbSaved: true,
      summary: {
        periodStart: `${data.year}-${String(data.month).padStart(2, '0')}-01`,
        periodEnd: `${data.year}-${String(data.month).padStart(2, '0')}-30`,
        onlineCount: data.summary.onlineCount,
        offlineCount: data.summary.offlineCount,
        totalCount: data.summary.totalCount,
      },
      message: '기존 저장된 데이터를 불러왔습니다.',
    })
  }

  // 파일 드롭
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0])
      // 파일 선택 시 기존 결과 초기화하지 않음 (기존 데이터 유지)
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

  // 파일 업로드 (파싱) - 기존 데이터와 병합
  const handleUpload = async () => {
    if (!file) return

    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (response.ok) {
        // 새로 파싱된 데이터로 업데이트 (기존 데이터 덮어쓰기)
        setUploadResult({ success: true, ...data })
        
        // 수정 가능 데이터 초기화 (channelData, categoryData 포함)
        setEditableDailyData(
          (data.dailyData || []).map((d: any) => ({
            date: d.date,
            online: d.online || 0,
            offline: d.offline || 0,
            total: (d.online || 0) + (d.offline || 0),
            isEdited: false,
            channelData: d.channelData || {},
            categoryData: d.categoryData || {},
          }))
        )
        
        console.log('[Upload] Daily data with channelData:', 
          (data.dailyData || []).slice(0, 2).map((d: any) => ({
            date: d.date,
            hasChannelData: !!d.channelData,
            channelData: d.channelData,
          }))
        )
        
        // 채널 데이터 - 기존 수수료 설정 유지
        const newChannels: Record<string, ChannelData> = {}
        for (const [code, chData] of Object.entries(data.channels || {})) {
          const existingFeeRate = editableChannels[code]?.feeRate
          newChannels[code] = {
            ...(chData as ChannelData),
            feeRate: existingFeeRate || (chData as ChannelData).feeRate || DEFAULT_CHANNEL_FEE_RATES[code] || 10,
          }
        }
        setEditableChannels(newChannels)
        
        setEditableCategories(data.categories || {})
        setHasChanges(true)
        setFile(null)
        
        // 연/월 동기화
        if (data.summary?.periodStart) {
          const date = new Date(data.summary.periodStart)
          setYearMonth(date.getFullYear(), date.getMonth() + 1)
        }
        
        // 데이터 검증 경고 표시
        if (data.validation?.hasMismatch) {
          const v = data.validation
          let message = '⚠️ 엑셀 데이터 검증 필요!\n\n엑셀 "계" 행 값과 개별 행 합계가 다릅니다.\n업로드된 데이터를 확인해주세요.\n\n'
          
          if (v.hasOnlineMismatch) {
            message += `[인터넷 판매]\n- 엑셀 계 행: ${formatNumber(v.excelOnlineTotal)}명\n- 개별 행 합산: ${formatNumber(v.calculatedOnlineTotal)}명\n- 차이: ${formatNumber(Math.abs(v.excelOnlineTotal - v.calculatedOnlineTotal))}명\n\n`
          }
          if (v.hasOfflineMismatch) {
            message += `[현장 판매]\n- 엑셀 계 행: ${formatNumber(v.excelOfflineTotal)}명\n- 개별 행 합산: ${formatNumber(v.calculatedOfflineTotal)}명\n- 차이: ${formatNumber(Math.abs(v.excelOfflineTotal - v.calculatedOfflineTotal))}명\n\n`
          }
          
          message += '※ 현재 개별 행 합산 값으로 저장됩니다.\n원본 엑셀 파일의 수식/데이터를 확인하세요.'
          
          alert(message)
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

  // 일별 데이터 수정
  const handleDayEdit = (index: number, field: 'online' | 'offline', value: number) => {
    setEditableDailyData(prev => {
      const updated = [...prev]
      updated[index] = {
        ...updated[index],
        [field]: value,
        total: field === 'online' ? value + updated[index].offline : updated[index].online + value,
        isEdited: true,
      }
      return updated
    })
    setHasChanges(true)
  }

  // 채널별 건수 수정
  const handleChannelCountEdit = (code: string, value: number) => {
    setEditableChannels(prev => ({
      ...prev,
      [code]: {
        ...prev[code],
        count: value,
      },
    }))
    setHasChanges(true)
  }

  // 채널별 수수료율 수정 (신규 기능)
  const handleChannelFeeRateEdit = (code: string, value: number) => {
    setEditableChannels(prev => ({
      ...prev,
      [code]: {
        ...prev[code],
        feeRate: value,
      },
    }))
    setHasChanges(true)
  }

  // 카테고리별 데이터 수정
  const handleCategoryEdit = (code: string, value: number) => {
    setEditableCategories(prev => ({
      ...prev,
      [code]: {
        ...prev[code],
        count: value,
      },
    }))
    setHasChanges(true)
  }

  // 채널 추가
  const handleAddChannel = () => {
    if (!newChannelName.trim()) return
    
    const code = `CUSTOM_${Date.now()}`
    setEditableChannels(prev => ({
      ...prev,
      [code]: {
        name: newChannelName.trim(),
        count: 0,
        feeRate: newChannelFeeRate,
      }
    }))
    
    setNewChannelName('')
    setNewChannelFeeRate(10)
    setShowAddChannel(false)
    setHasChanges(true)
  }

  // 카테고리 추가
  const handleAddCategory = () => {
    if (!newCategoryName.trim()) return
    
    const code = `CUSTOM_${Date.now()}`
    setEditableCategories(prev => ({
      ...prev,
      [code]: {
        name: newCategoryName.trim(),
        count: 0,
      }
    }))
    
    setNewCategoryName('')
    setShowAddCategory(false)
    setHasChanges(true)
  }

  // 엑셀 업로드 데이터 저장
  const handleSaveUploadData = async (mergeMode?: boolean) => {
    if (!uploadResult && editableDailyData.length === 0) return

    // 기존 데이터가 있는 경우 처리
    if (uploadResult?.existingData) {
      // 겹치는 날짜가 있으면 사용자에게 확인
      if (uploadResult.hasOverlap && mergeMode === undefined) {
        const overlappingCount = uploadResult.overlappingDates?.length || 0
        const choice = window.confirm(
          `⚠️ 기존 데이터와 ${overlappingCount}일이 겹칩니다.\n\n` +
          `[확인] - 기존 데이터와 병합 (겹치는 날짜는 새 데이터로 덮어쓰기)\n` +
          `[취소] - 전체 덮어쓰기 (기존 데이터 삭제)`
        )
        return handleSaveUploadData(choice)
      }
      
      // 겹치는 날짜가 없으면 자동으로 병합
      if (!uploadResult.hasOverlap && mergeMode === undefined) {
        mergeMode = true  // 자동 병합
        console.log('[Save] Auto-merging with existing data (no overlap)')
      }
    }
    
    // 기본값 설정
    const finalMergeMode = mergeMode ?? false

    setIsSaving(true)

    try {
      const response = await fetch('/api/upload/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dailyData: editableDailyData,
          channels: editableChannels,
          categories: editableCategories,
          summary: {
            onlineCount: editableDailyData.reduce((sum, d) => sum + d.online, 0),
            offlineCount: editableDailyData.reduce((sum, d) => sum + d.offline, 0),
            totalCount: editableDailyData.reduce((sum, d) => sum + d.total, 0),
          },
          year,
          month,
          mergeMode: finalMergeMode,  // 병합 모드 전달
        }),
      })

      const data = await response.json()

      if (response.ok) {
        const modeText = finalMergeMode ? '병합 저장' : '저장'
        alert(`데이터가 성공적으로 ${modeText}되었습니다.\n대시보드, 판매분석, 정산현황에 모두 반영됩니다.`)
        setHasChanges(false)
        
        setUploadResult(prev => prev ? {
          ...prev,
          dbSaved: true,
          summary: data.summary,
          settlement: data.settlement,
          hasOverlap: false,  // 저장 후 겹침 상태 초기화
          overlappingDates: [],
        } : {
          success: true,
          dbSaved: true,
          summary: data.summary,
          settlement: data.settlement,
        })
        
        // 데이터 새로고침
        await loadExistingData()
      } else {
        alert(data.error || '저장 실패')
      }
    } catch (error) {
      alert('네트워크 오류가 발생했습니다.')
    } finally {
      setIsSaving(false)
    }
  }

  // 월별 데이터 삭제
  const handleDeleteMonthData = async () => {
    if (!uploadResult?.existingData && editableDailyData.length === 0) {
      alert('삭제할 데이터가 없습니다.')
      return
    }

    const confirmed = window.confirm(
      `⚠️ ${year}년 ${month}월 데이터를 정말 삭제하시겠습니까?\n\n` +
      `이 작업은 되돌릴 수 없습니다.\n` +
      `대시보드, 정산현황 등 모든 관련 데이터가 삭제됩니다.`
    )

    if (!confirmed) return

    setIsDeleting(true)

    try {
      const response = await fetch(`/api/upload/save?year=${year}&month=${month}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (response.ok) {
        alert(data.message || `${year}년 ${month}월 데이터가 삭제되었습니다.`)
        
        // 상태 초기화
        setUploadResult(null)
        setEditableDailyData([])
        setEditableChannels({})
        setEditableCategories({})
        setHasChanges(false)
        
        // 데이터 새로고침
        await loadExistingData()
      } else {
        alert(data.error || '삭제 실패')
      }
    } catch (error) {
      alert('네트워크 오류가 발생했습니다.')
    } finally {
      setIsDeleting(false)
    }
  }

  // 수수료 설정 저장 (일자별 입력 모드)
  const handleSaveFeeSettings = async (settings: MonthlyFeeSettings) => {
    setIsSavingFee(true)
    try {
      const response = await fetch('/api/sales-data-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'saveFee',
          year,
          month,
          channels: settings.channels,
          overrides: settings.overrides,
        }),
      })

      const result = await response.json()

      if (result.success) {
        setFeeSettings(result.feeSettings)
        setMonthlyData(result.monthlyData)
        alert('수수료 설정이 저장되었습니다.')
      } else {
        alert(result.error || '저장 실패')
      }
    } catch (error) {
      alert('네트워크 오류가 발생했습니다.')
    } finally {
      setIsSavingFee(false)
    }
  }

  // 일자별 데이터 저장 (upload-data와 동기화)
  const handleSaveDailyData = async (dataList: DailyAggData[]) => {
    setIsSaving(true)
    try {
      // DailyAggData를 간단한 형식으로 변환
      const dailyData = dataList.map(d => ({
        date: d.date,
        online: d.channelSales?.reduce((sum, ch) => sum + ch.count, 0) || 0,
        offline: d.categorySales?.reduce((sum, cat) => sum + cat.count, 0) || 0,
        total: (d.channelSales?.reduce((sum, ch) => sum + ch.count, 0) || 0) + 
               (d.categorySales?.reduce((sum, cat) => sum + cat.count, 0) || 0),
      }))
      
      // 채널별 합계 계산
      const channelTotals: Record<string, { name: string; count: number; feeRate: number }> = {}
      dataList.forEach(d => {
        d.channelSales?.forEach(ch => {
          if (!channelTotals[ch.channelCode]) {
            channelTotals[ch.channelCode] = {
              name: ch.channelName,
              count: 0,
              feeRate: ch.feeRate || 10,
            }
          }
          channelTotals[ch.channelCode].count += ch.count
        })
      })
      
      // 카테고리별 합계 계산
      const categoryTotals: Record<string, { name: string; count: number }> = {}
      dataList.forEach(d => {
        d.categorySales?.forEach(cat => {
          if (!categoryTotals[cat.categoryCode]) {
            categoryTotals[cat.categoryCode] = {
              name: cat.categoryName,
              count: 0,
            }
          }
          categoryTotals[cat.categoryCode].count += cat.count
        })
      })
      
      // upload/save API 사용 (upload-data와 동기화)
      const response = await fetch('/api/upload/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dailyData,
          channels: channelTotals,
          categories: categoryTotals,
          year,
          month,
          mergeMode: false,  // 전체 덮어쓰기
        }),
      })

      const result = await response.json()

      if (result.success) {
        setDailyDataForInput(dataList)
        
        // 편집 가능 데이터도 업데이트
        setEditableDailyData(dailyData)
        setEditableChannels(channelTotals)
        setEditableCategories(categoryTotals)
        
        alert(`${dataList.length}일 데이터가 저장되었습니다.`)
        
        // 데이터 새로고침
        await loadExistingData()
      } else {
        alert(result.error || '저장 실패')
      }
    } catch (error) {
      console.error('Save error:', error)
      alert('네트워크 오류가 발생했습니다.')
    } finally {
      setIsSaving(false)
    }
  }

  // 채널/카테고리 합계 (엑셀 업로드용 - 월 계 데이터 기준)
  const channelSum = useMemo(() => 
    Object.values(editableChannels).reduce((sum, ch) => sum + (ch.count || 0), 0), 
    [editableChannels]
  )
  const categorySum = useMemo(() => 
    Object.values(editableCategories).reduce((sum, cat) => sum + (cat.count || 0), 0), 
    [editableCategories]
  )
  
  // 일별 데이터 합계 (일별 레코드 기준)
  const dailyTotals = useMemo(() => {
    const online = editableDailyData.reduce((sum, d) => sum + (d.online || 0), 0)
    const offline = editableDailyData.reduce((sum, d) => sum + (d.offline || 0), 0)
    return { online, offline, total: online + offline }
  }, [editableDailyData])

  // 합계 계산 (채널/카테고리 합계 우선 사용, 없으면 일별 합계)
  const totals = useMemo(() => {
    // 채널/카테고리 합계가 있으면 그것을 사용 (월 계 데이터)
    const online = channelSum > 0 ? channelSum : dailyTotals.online
    const offline = categorySum > 0 ? categorySum : dailyTotals.offline
    return { online, offline, total: online + offline }
  }, [channelSum, categorySum, dailyTotals])

  // 불일치 체크 (일별 합계와 채널/카테고리 합계 비교)
  const channelMismatch = channelSum !== dailyTotals.online && dailyTotals.online > 0 && channelSum > 0
  const categoryMismatch = categorySum !== dailyTotals.offline && dailyTotals.offline > 0 && categorySum > 0

  // SKP 매출 계산 (수정된 수수료율 반영)
  const calculateSkpRevenue = useMemo(() => {
    let onlineNetRevenue = 0
    for (const [code, data] of Object.entries(editableChannels)) {
      const feeRate = data.feeRate || DEFAULT_CHANNEL_FEE_RATES[code] || 10
      const netPrice = BASE_PRICE * (1 - feeRate / 100)
      onlineNetRevenue += netPrice * (data.count || 0)
    }
    const offlineRevenue = totals.offline * BASE_PRICE
    return Math.round(onlineNetRevenue + offlineRevenue)
  }, [editableChannels, totals.offline])

  // 총 수수료 계산
  const totalFee = useMemo(() => {
    let fee = 0
    for (const [code, data] of Object.entries(editableChannels)) {
      const feeRate = data.feeRate || DEFAULT_CHANNEL_FEE_RATES[code] || 10
      fee += Math.round(BASE_PRICE * (feeRate / 100) * (data.count || 0))
    }
    return fee
  }, [editableChannels])

  // 기존 데이터 유무 확인
  const hasExistingData = editableDailyData.length > 0 || Object.keys(editableChannels).length > 0

  return (
    <div className="min-h-screen">
      <Header
        title="데이터 입력"
        description="판매 데이터를 업로드하거나 직접 입력합니다"
      />
      
      <div className="p-8 space-y-6">
        {/* 입력 모드 선택 */}
        <Card>
          <CardHeader title="입력 방식 선택" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {INPUT_MODES.map(mode => {
              const Icon = mode.icon
              return (
                <button
                  key={mode.value}
                  onClick={() => {
                    setInputMode(mode.value)
                    setFile(null)
                  }}
                  className={cn(
                    'flex items-center gap-4 p-6 rounded-xl border-2 transition-all text-left',
                    inputMode === mode.value
                      ? 'border-maze-500 bg-maze-500/10'
                      : 'border-dashboard-border hover:border-maze-500/50 hover:bg-dashboard-border/30'
                  )}
                >
                  <div className={cn(
                    'p-3 rounded-xl',
                    inputMode === mode.value ? 'bg-maze-500/20' : 'bg-dashboard-bg'
                  )}>
                    <Icon className={cn(
                      'w-6 h-6',
                      inputMode === mode.value ? 'text-maze-500' : 'text-dashboard-muted'
                    )} />
                  </div>
                  <div>
                    <span className={cn(
                      'text-base font-medium block',
                      inputMode === mode.value ? 'text-maze-500' : 'text-dashboard-text'
                    )}>
                      {mode.label}
                    </span>
                    <span className="text-xs text-dashboard-muted">
                      {mode.description}
                    </span>
                  </div>
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
            {hasExistingData && (
              <span className="flex items-center gap-1 px-3 py-1 bg-blue-500/20 text-blue-500 text-xs rounded-full">
                <Database className="w-3 h-3" />
                기존 데이터 있음 ({formatNumber(totals.total || monthlyData?.summary.totalCount || 0)}명)
              </span>
            )}
          </div>
        </Card>

        {/* 로딩 */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-maze-500 animate-spin" />
          </div>
        )}

        {/* ========== 엑셀 업로드 모드 ========== */}
        {inputMode === 'file' && !isLoading && (
          <>
            {/* 파일 업로드 영역 */}
            <Card>
              <CardHeader
                title="엑셀 파일 업로드"
                description={hasExistingData 
                  ? "새 파일을 업로드하면 기존 데이터에 덮어씁니다" 
                  : "판매인원공유 형식의 엑셀 파일(.xlsx, .xls)을 업로드해주세요"
                }
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
                      <p className="text-sm text-dashboard-muted mt-1">
                        {(file.size / 1024).toFixed(1)} KB
                      </p>
                    </>
                  ) : (
                    <>
                      <Upload className="w-12 h-12 text-dashboard-muted mb-3" />
                      <p className="text-base font-medium text-dashboard-text">
                        {isDragActive ? '파일을 놓으세요' : '파일을 드래그하거나 클릭하여 선택'}
                      </p>
                      <p className="text-sm text-dashboard-muted mt-1">
                        .xlsx, .xls 파일 지원
                      </p>
                    </>
                  )}
                </div>
              </div>

              {file && (
                <div className="mt-4 flex justify-end">
                  <Button
                    onClick={handleUpload}
                    isLoading={isUploading}
                    disabled={isUploading}
                  >
                    {isUploading ? '분석 중...' : '파일 분석'}
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
            </Card>

            {/* 데이터 미리보기 및 수정 (기존 데이터 또는 새 업로드 데이터) */}
            {hasExistingData && (
              <>
                {/* 요약 정보 */}
                <Card>
                  <CardHeader 
                    title="데이터 요약" 
                    description={uploadResult?.dbSaved ? "저장된 데이터입니다. 수정 후 다시 저장할 수 있습니다." : undefined}
                  />
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="text-center p-4 bg-maze-500/10 rounded-lg">
                      <p className="text-sm text-dashboard-muted">인터넷 판매</p>
                      <p className="text-2xl font-bold text-maze-500">{formatNumber(totals.online)}명</p>
                    </div>
                    <div className="text-center p-4 bg-blue-500/10 rounded-lg">
                      <p className="text-sm text-dashboard-muted">현장 판매</p>
                      <p className="text-2xl font-bold text-blue-500">{formatNumber(totals.offline)}명</p>
                    </div>
                    <div className="text-center p-4 bg-dashboard-bg rounded-lg">
                      <p className="text-sm text-dashboard-muted">총 판매</p>
                      <p className="text-2xl font-bold text-dashboard-text">{formatNumber(totals.total)}명</p>
                    </div>
                  </div>
                </Card>

                {/* 일별 데이터 수정 */}
                <Card>
                  <CardHeader 
                    title="일별 데이터" 
                    description="오류가 있는 경우 직접 수정하세요"
                  />
                  <div className="overflow-x-auto max-h-[400px]">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-dashboard-card">
                        <tr className="border-b border-dashboard-border">
                          <th className="text-left py-3 px-4 font-semibold text-dashboard-muted">날짜</th>
                          <th className="text-center py-3 px-4 font-semibold text-maze-500">인터넷</th>
                          <th className="text-center py-3 px-4 font-semibold text-blue-500">현장</th>
                          <th className="text-center py-3 px-4 font-semibold text-dashboard-text">합계</th>
                        </tr>
                      </thead>
                      <tbody>
                        {editableDailyData.map((day, index) => (
                          <tr 
                            key={day.date} 
                            className={cn(
                              'border-b border-dashboard-border/50',
                              day.isEdited && 'bg-yellow-500/5'
                            )}
                          >
                            <td className="py-2 px-4 text-dashboard-text">
                              {new Date(day.date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                              {day.isEdited && <span className="ml-2 text-xs text-yellow-500">수정됨</span>}
                            </td>
                            <td className="py-2 px-4 text-center">
                              <input
                                type="number"
                                min="0"
                                value={day.online || ''}
                                onChange={(e) => handleDayEdit(index, 'online', parseInt(e.target.value) || 0)}
                                className="w-20 text-center bg-dashboard-bg border border-dashboard-border rounded px-2 py-1 text-maze-500 font-medium"
                              />
                            </td>
                            <td className="py-2 px-4 text-center">
                              <input
                                type="number"
                                min="0"
                                value={day.offline || ''}
                                onChange={(e) => handleDayEdit(index, 'offline', parseInt(e.target.value) || 0)}
                                className="w-20 text-center bg-dashboard-bg border border-dashboard-border rounded px-2 py-1 text-blue-500 font-medium"
                              />
                            </td>
                            <td className="py-2 px-4 text-center font-semibold text-dashboard-text">
                              {formatNumber(day.total)}
                            </td>
                          </tr>
                        ))}
                        {/* 합계 행 */}
                        <tr className="bg-dashboard-bg font-bold">
                          <td className="py-3 px-4 text-dashboard-text">합계</td>
                          <td className="py-3 px-4 text-center text-maze-500">{formatNumber(totals.online)}</td>
                          <td className="py-3 px-4 text-center text-blue-500">{formatNumber(totals.offline)}</td>
                          <td className="py-3 px-4 text-center text-dashboard-text">{formatNumber(totals.total)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </Card>

                {/* 채널별 인터넷 판매 (수수료율 수정 가능) */}
                <Card>
                <CardHeader
                  title="채널별 인터넷 판매"
                  description={
                    channelMismatch
                      ? `⚠️ 일별 합계(${formatNumber(totals.online)})와 채널 합계(${formatNumber(channelSum)})가 다릅니다`
                      : `수수료율도 수정 가능합니다`
                  }
                />

                <div className="mt-2">
                  {channelMismatch ? (
                    <span className="text-red-500">
                      ⚠️ 일별 합계({formatNumber(totals.online)})와 채널 합계({formatNumber(channelSum)})가 다릅니다
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-dashboard-muted">
                      <Percent className="w-3 h-3" />
                      수수료율도 수정 가능합니다
                    </span>
                  )}
                </div>

                  
                  
                  {/* 채널 추가 버튼 */}
                  <div className="mb-4 flex justify-end">
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
                          className="w-32 px-2 py-1 text-sm bg-dashboard-card border border-dashboard-border rounded text-dashboard-text"
                        />
                        <input
                          type="number"
                          value={newChannelFeeRate}
                          onChange={(e) => setNewChannelFeeRate(parseFloat(e.target.value) || 0)}
                          placeholder="수수료%"
                          className="w-16 px-2 py-1 text-sm bg-dashboard-card border border-dashboard-border rounded text-dashboard-text"
                        />
                        <span className="text-sm text-dashboard-muted">%</span>
                        <Button size="sm" onClick={handleAddChannel}>추가</Button>
                        <button onClick={() => setShowAddChannel(false)} className="p-1 text-dashboard-muted hover:text-dashboard-text">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-3">
                    {Object.entries(editableChannels).map(([code, data]) => (
                      <div key={code} className="flex items-center justify-between p-4 bg-dashboard-bg rounded-lg">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-dashboard-text">
                            {CHANNEL_NAMES[code] || data.name || code}
                          </p>
                        </div>
                        <div className="flex items-center gap-4">
                          {/* 수수료율 입력 */}
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-dashboard-muted">수수료</span>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.1"
                              value={data.feeRate || DEFAULT_CHANNEL_FEE_RATES[code] || ''}
                              onChange={(e) => handleChannelFeeRateEdit(code, parseFloat(e.target.value) || 0)}
                              className="w-16 text-center bg-dashboard-card border border-orange-500/50 rounded px-2 py-1 text-orange-500 font-medium text-sm"
                            />
                            <span className="text-xs text-orange-500">%</span>
                          </div>
                          {/* 건수 입력 */}
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-dashboard-muted">건수</span>
                            <input
                              type="number"
                              min="0"
                              value={data.count || ''}
                              onChange={(e) => handleChannelCountEdit(code, parseInt(e.target.value) || 0)}
                              className="w-24 text-center bg-dashboard-card border border-dashboard-border rounded px-2 py-1 text-maze-500 font-semibold"
                            />
                            <span className="text-xs text-dashboard-muted">명</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 pt-4 border-t border-dashboard-border flex justify-between items-center">
                    <span className="text-sm text-dashboard-muted">채널 합계</span>
                    <span className={cn(
                      'text-lg font-bold',
                      channelMismatch ? 'text-red-500' : 'text-maze-500'
                    )}>
                      {formatNumber(channelSum)}명
                    </span>
                  </div>
                </Card>

                {/* 구분별 현장 판매 */}
                <Card>
                <CardHeader
                  title="구분별 현장 판매"
                  description={
                    categoryMismatch
                      ? `⚠️ 일별 합계(${formatNumber(totals.offline)})와 구분 합계(${formatNumber(categorySum)})가 다릅니다`
                      : '구분별 판매 건수를 입력/수정할 수 있습니다'
                  }
                />
                  
                  {/* 구분 추가 버튼 */}
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
                          className="w-32 px-2 py-1 text-sm bg-dashboard-card border border-dashboard-border rounded text-dashboard-text"
                        />
                        <Button size="sm" onClick={handleAddCategory}>추가</Button>
                        <button onClick={() => setShowAddCategory(false)} className="p-1 text-dashboard-muted hover:text-dashboard-text">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {Object.entries(editableCategories).map(([code, data]) => (
                      <div key={code} className="flex items-center justify-between p-3 bg-dashboard-bg rounded-lg">
                        <p className="text-sm font-medium text-dashboard-text">
                          {CATEGORY_NAMES[code] || data.name || code}
                        </p>
                        <input
                          type="number"
                          min="0"
                          value={data.count || ''}
                          onChange={(e) => handleCategoryEdit(code, parseInt(e.target.value) || 0)}
                          className="w-20 text-center bg-dashboard-card border border-dashboard-border rounded px-2 py-1 text-blue-500 font-semibold"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 pt-4 border-t border-dashboard-border flex justify-between items-center">
                    <span className="text-sm text-dashboard-muted">구분 합계</span>
                    <span className={cn(
                      'text-lg font-bold',
                      categoryMismatch ? 'text-red-500' : 'text-blue-500'
                    )}>
                      {formatNumber(categorySum)}명
                    </span>
                  </div>
                </Card>

                {/* 기존 데이터 병합 안내 */}
                {uploadResult?.existingData && (
                  <Card className="bg-blue-500/10 border border-blue-500/30">
                    <div className="flex items-start gap-3">
                      <Database className="w-5 h-5 text-blue-500 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-blue-500">기존 데이터 발견</p>
                        <p className="text-sm text-dashboard-muted mt-1">
                          기간: {uploadResult.existingData.periodStart.split('T')[0]} ~ {uploadResult.existingData.periodEnd.split('T')[0]}
                          {' '}({uploadResult.existingData.dates.length}일, {formatNumber(uploadResult.existingData.summary.totalCount)}명)
                        </p>
                        {uploadResult.hasOverlap ? (
                          <p className="text-sm text-yellow-500 mt-1">
                            ⚠️ {uploadResult.overlappingDates?.length}일 겹침 - 저장 시 병합/덮어쓰기 선택
                          </p>
                        ) : (
                          <p className="text-sm text-green-500 mt-1">
                            ✓ 겹치는 날짜 없음 - 저장 시 기존 데이터와 자동 병합됩니다
                          </p>
                        )}
                      </div>
                    </div>
                  </Card>
                )}

                {/* 저장 버튼 */}
                <Card className="bg-gradient-to-br from-maze-500/10 to-transparent">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                      <p className="text-lg font-semibold text-dashboard-text">데이터 반영</p>
                      <p className="text-sm text-dashboard-muted">
                        {uploadResult?.existingData 
                          ? (uploadResult.hasOverlap 
                              ? '겹치는 날짜가 있어 저장 시 선택이 필요합니다' 
                              : '기존 데이터와 자동으로 병합됩니다')
                          : '수정이 완료되면 저장하여 대시보드에 반영하세요'}
                      </p>
                      {hasChanges && (
                        <p className="text-sm text-yellow-500 mt-1">⚠️ 저장되지 않은 변경사항이 있습니다</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {uploadResult?.existingData && (
                        <>
                          <Button
                            onClick={handleDeleteMonthData}
                            disabled={isSaving || isDeleting}
                            isLoading={isDeleting}
                            variant="danger"
                            size="lg"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            {isDeleting ? '삭제 중...' : '데이터 삭제'}
                          </Button>
                          <Button
                            onClick={() => handleSaveUploadData(false)}
                            disabled={isSaving || isDeleting}
                            variant="outline"
                            size="lg"
                          >
                            <X className="w-4 h-4 mr-2" />
                            전체 덮어쓰기
                          </Button>
                        </>
                      )}
                      <Button
                        onClick={() => handleSaveUploadData()}
                        disabled={isSaving || isDeleting}
                        isLoading={isSaving}
                        size="lg"
                      >
                        <Save className="w-4 h-4 mr-2" />
                        {isSaving ? '저장 중...' : (uploadResult?.existingData ? '데이터 병합 저장' : '데이터 반영')}
                      </Button>
                    </div>
                  </div>
                </Card>
              </>
            )}
          </>
        )}

        {/* ========== 일자별 입력 모드 ========== */}
        {inputMode === 'daily' && !isLoading && (
          <>
            {/* 수수료 설정 */}
            <FeeSettingsPanel
              year={year}
              month={month}
              settings={feeSettings}
              onSave={handleSaveFeeSettings}
              isSaving={isSavingFee}
              isCollapsible={true}
              defaultCollapsed={true}
            />

            {/* 일자별 입력 테이블 */}
            {masterData ? (
              <DailyInputTable
                year={year}
                month={month}
                channels={
                  Object.keys(editableChannels).length > 0
                    ? Object.entries(editableChannels).map(([code, ch], idx) => ({
                        code,
                        name: ch.name || code,
                        defaultFeeRate: ch.feeRate ?? 0,
                        active: true,
                        order: idx + 1,
                      }))
                    : masterData.channels
                }
                categories={
                  Object.keys(editableCategories).length > 0
                    ? Object.entries(editableCategories).map(([code, cat], idx) => ({
                        code,
                        name: cat.name || code,
                        active: true,
                        order: idx + 1,
                      }))
                    : masterData.categories
                }
                feeSettings={feeSettings}
                initialDailyData={dailyDataForInput}
                onSave={handleSaveDailyData}
                isSaving={isSaving}
              />
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}
