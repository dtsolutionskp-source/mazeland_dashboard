'use client'

import { formatCurrency, formatPercent } from '@/lib/utils'
import { cn } from '@/lib/utils'

// 회사 코드 → 이름 매핑
const COMPANY_NAMES: Record<string, string> = {
  SKP: 'SKP',
  MAZE: '메이즈랜드',
  CULTURE: '컬처커넥션',
  AGENCY: 'FMC',
}

interface SettlementData {
  companyName?: string
  companyCode?: string
  name?: string
  code?: string
  revenue: number
  income?: number
  cost: number
  profit: number
  profitRate: number
}

interface SettlementTableProps {
  data: SettlementData[]
  viewableCompanies?: string[]
  showDetails?: boolean
}

export function SettlementTable({ 
  data = [], 
  viewableCompanies,
  showDetails = true 
}: SettlementTableProps) {
  // 데이터가 없으면 빈 상태 표시
  if (!data || data.length === 0) {
    return (
      <div className="text-center py-8 text-dashboard-muted">
        정산 데이터가 없습니다.
      </div>
    )
  }

  // 데이터 정규화 (companyCode/code, companyName/name 둘 다 지원)
  const normalizedData = data.map(row => ({
    ...row,
    companyCode: row.companyCode || row.code || 'UNKNOWN',
    companyName: row.companyName || row.name || COMPANY_NAMES[row.companyCode || row.code || ''] || '알 수 없음',
    income: row.income ?? row.revenue ?? 0,
  }))

  // 조회 가능한 회사만 필터링
  const filteredData = viewableCompanies 
    ? normalizedData.filter(d => viewableCompanies.includes(d.companyCode))
    : normalizedData

  // 비용 마스킹 필요 여부 (다른 회사 데이터 숨기기)
  const shouldMask = (companyCode: string) => {
    if (!viewableCompanies) return false
    // SKP, SUPER_ADMIN은 마스킹 없음
    if (viewableCompanies.length === 4) return false
    // 자기 회사가 아니면 마스킹
    return !viewableCompanies.includes(companyCode)
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-dashboard-border">
            <th className="text-left py-3 px-4 text-sm font-semibold text-dashboard-muted">회사</th>
            <th className="text-right py-3 px-4 text-sm font-semibold text-dashboard-muted">매출</th>
            {showDetails && (
              <>
                <th className="text-right py-3 px-4 text-sm font-semibold text-dashboard-muted">수익</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-dashboard-muted">비용</th>
              </>
            )}
            <th className="text-right py-3 px-4 text-sm font-semibold text-dashboard-muted">이익</th>
            <th className="text-right py-3 px-4 text-sm font-semibold text-dashboard-muted">이익률</th>
          </tr>
        </thead>
        <tbody>
          {filteredData.map((row, index) => {
            const masked = shouldMask(row.companyCode)
            const displayName = row.companyName || COMPANY_NAMES[row.companyCode] || row.companyCode
            const firstChar = displayName ? displayName.charAt(0) : '?'
            
            return (
              <tr 
                key={row.companyCode || index}
                className={cn(
                  'border-b border-dashboard-border/50 transition-colors',
                  'hover:bg-dashboard-border/30'
                )}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <td className="py-4 px-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold',
                      row.companyCode === 'SKP' && 'bg-blue-500/20 text-blue-500',
                      row.companyCode === 'MAZE' && 'bg-maze-500/20 text-maze-500',
                      row.companyCode === 'CULTURE' && 'bg-purple-500/20 text-purple-500',
                      row.companyCode === 'AGENCY' && 'bg-orange-500/20 text-orange-500',
                      !['SKP', 'MAZE', 'CULTURE', 'AGENCY'].includes(row.companyCode) && 'bg-gray-500/20 text-gray-500',
                    )}>
                      {firstChar}
                    </div>
                    <span className="text-dashboard-text font-medium">{displayName}</span>
                  </div>
                </td>
                <td className="py-4 px-4 text-right text-dashboard-text">
                  {masked ? '****' : formatCurrency(row.revenue)}
                </td>
                {showDetails && (
                  <>
                    <td className="py-4 px-4 text-right text-dashboard-text">
                      {masked ? '****' : formatCurrency(row.income)}
                    </td>
                    <td className="py-4 px-4 text-right text-dashboard-muted">
                      {masked ? '****' : formatCurrency(row.cost)}
                    </td>
                  </>
                )}
                <td className={cn(
                  'py-4 px-4 text-right font-semibold',
                  (row.profit ?? 0) >= 0 ? 'text-maze-500' : 'text-red-500'
                )}>
                  {masked ? '****' : formatCurrency(row.profit)}
                </td>
                <td className="py-4 px-4 text-right">
                  {masked ? '****' : (
                    <span className={cn(
                      'inline-block px-2 py-1 rounded-full text-xs font-medium',
                      (row.profitRate ?? 0) >= 50 && 'bg-maze-500/20 text-maze-500',
                      (row.profitRate ?? 0) >= 30 && (row.profitRate ?? 0) < 50 && 'bg-blue-500/20 text-blue-500',
                      (row.profitRate ?? 0) >= 0 && (row.profitRate ?? 0) < 30 && 'bg-orange-500/20 text-orange-500',
                      (row.profitRate ?? 0) < 0 && 'bg-red-500/20 text-red-500',
                    )}>
                      {formatPercent(row.profitRate)}
                    </span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
