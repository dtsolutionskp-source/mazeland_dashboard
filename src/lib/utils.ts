import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatNumber(num: number | undefined | null): string {
  if (num === undefined || num === null || isNaN(num)) return '0'
  return num.toLocaleString('ko-KR')
}

export function formatCurrency(num: number | undefined | null): string {
  if (num === undefined || num === null || isNaN(num)) return '0원'
  return `${num.toLocaleString('ko-KR')}원`
}

export function formatPercent(num: number | undefined | null, decimals: number = 1): string {
  if (num === undefined || num === null || isNaN(num)) return '0%'
  return `${num.toFixed(decimals)}%`
}

export function formatDate(date: Date | string | undefined | null): string {
  if (!date) return '-'
  try {
    const d = typeof date === 'string' ? new Date(date) : date
    return d.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  } catch {
    return '-'
  }
}

export function formatDateShort(date: Date | string | undefined | null): string {
  if (!date) return '-'
  try {
    const d = typeof date === 'string' ? new Date(date) : date
    return d.toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return '-'
  }
}

export function formatDateTime(date: Date | string | undefined | null): string {
  if (!date) return '-'
  try {
    const d = typeof date === 'string' ? new Date(date) : date
    return d.toLocaleString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return '-'
  }
}
