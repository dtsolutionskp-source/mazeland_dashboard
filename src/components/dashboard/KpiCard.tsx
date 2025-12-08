'use client'

import { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react'
import { ComparisonData } from '@/types/dashboard'

interface KpiCardProps {
  title: string
  value: string | number
  icon?: ReactNode
  comparison?: ComparisonData | null
  className?: string
  variant?: 'default' | 'success' | 'warning' | 'error'
  subtitle?: string
}

export function KpiCard({
  title,
  value,
  icon,
  comparison,
  className,
  variant = 'default',
  subtitle,
}: KpiCardProps) {
  const variantStyles = {
    default: 'bg-dashboard-card border-dashboard-border',
    success: 'bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/30',
    warning: 'bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/30',
    error: 'bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/30',
  }

  return (
    <div
      className={cn(
        'rounded-xl border p-6 transition-all hover:shadow-lg',
        variantStyles[variant],
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm text-dashboard-muted font-medium">{title}</p>
            {subtitle && (
              <span className="text-xs text-dashboard-muted/60 px-1.5 py-0.5 bg-dashboard-bg rounded">
                {subtitle}
              </span>
            )}
          </div>
          <p className="text-2xl font-bold text-dashboard-text mt-2">{value}</p>
          
          {/* 전월비 표시 */}
          {comparison && (
            <div className="flex items-center gap-1 mt-2">
              <ComparisonBadge comparison={comparison} />
            </div>
          )}
        </div>
        
        {icon && (
          <div className="p-3 rounded-xl bg-maze-500/20 text-maze-500">
            {icon}
          </div>
        )}
      </div>
    </div>
  )
}

// 전월비 배지 컴포넌트
interface ComparisonBadgeProps {
  comparison: ComparisonData
  showLabel?: boolean
}

export function ComparisonBadge({ comparison, showLabel = true }: ComparisonBadgeProps) {
  const { type, percent } = comparison

  const styles = {
    increase: {
      bg: 'bg-green-500/20',
      text: 'text-green-500',
      icon: ArrowUpRight,
    },
    decrease: {
      bg: 'bg-red-500/20',
      text: 'text-red-500',
      icon: ArrowDownRight,
    },
    same: {
      bg: 'bg-gray-500/20',
      text: 'text-gray-500',
      icon: Minus,
    },
  }

  const style = styles[type]
  const Icon = style.icon

  return (
    <div className={cn('flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium', style.bg, style.text)}>
      <Icon className="w-3 h-3" />
      <span>
        {type === 'increase' && '+'}
        {type === 'decrease' && '-'}
        {Math.abs(percent).toFixed(1)}%
      </span>
      {showLabel && (
        <span className="text-dashboard-muted ml-1">전월비</span>
      )}
    </div>
  )
}

// 미니 KPI 카드 (그리드용)
interface MiniKpiCardProps {
  title: string
  value: string | number
  comparison?: ComparisonData | null
  className?: string
}

export function MiniKpiCard({ title, value, comparison, className }: MiniKpiCardProps) {
  return (
    <div className={cn('p-4 rounded-lg bg-dashboard-bg', className)}>
      <p className="text-xs text-dashboard-muted">{title}</p>
      <div className="flex items-center gap-2 mt-1">
        <p className="text-lg font-bold text-dashboard-text">{value}</p>
        {comparison && (
          <ComparisonBadge comparison={comparison} showLabel={false} />
        )}
      </div>
    </div>
  )
}

