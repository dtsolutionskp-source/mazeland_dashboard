'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface CardProps {
  children: ReactNode
  className?: string
  hover?: boolean
}

export function Card({ children, className, hover = false }: CardProps) {
  return (
    <div
      className={cn(
        'bg-dashboard-card border border-dashboard-border rounded-xl p-6',
        hover && 'transition-all duration-200 hover:border-maze-500/50 hover:shadow-lg hover:shadow-maze-500/10',
        className
      )}
    >
      {children}
    </div>
  )
}

interface CardHeaderProps {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
}

export function CardHeader({ title, description, action, className }: CardHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between mb-4', className)}>
      <div>
        <h3 className="text-lg font-semibold text-dashboard-text">{title}</h3>
        {description && (
          <div className="text-sm text-dashboard-muted mt-1">{description}</div>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}

interface StatCardProps {
  title: string
  value: string | number
  change?: {
    value: number
    type: 'increase' | 'decrease' | 'neutral'
  }
  icon?: ReactNode
  className?: string
}

export function StatCard({ title, value, change, icon, className }: StatCardProps) {
  return (
    <Card className={cn('relative overflow-hidden', className)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-dashboard-muted">{title}</p>
          <p className="text-2xl font-bold text-dashboard-text mt-1">{value}</p>
          {change && (
            <div className={cn(
              'flex items-center mt-2 text-sm',
              change.type === 'increase' && 'text-green-500',
              change.type === 'decrease' && 'text-red-500',
              change.type === 'neutral' && 'text-dashboard-muted'
            )}>
              {change.type === 'increase' && '▲'}
              {change.type === 'decrease' && '▼'}
              <span className="ml-1">{Math.abs(change.value)}%</span>
              <span className="ml-1 text-dashboard-muted">전월 대비</span>
            </div>
          )}
        </div>
        {icon && (
          <div className="p-3 bg-maze-500/10 rounded-lg text-maze-500">
            {icon}
          </div>
        )}
      </div>
      <div className="absolute -right-8 -bottom-8 w-24 h-24 bg-maze-500/5 rounded-full blur-2xl" />
    </Card>
  )
}
