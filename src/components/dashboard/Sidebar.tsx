'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  BarChart3,
  Calculator,
  FileText,
  Lightbulb,
  Users,
  Building2,
  Settings,
  LogOut,
  ClipboardEdit,
  KeyRound,
} from 'lucide-react'
import { Role } from '@prisma/client'

interface SidebarProps {
  userRole: Role
  userName: string
  companyName?: string
}

interface NavItem {
  href: string
  label: string
  icon: React.ReactNode
  roles: Role[] | 'all'
}

const navItems: NavItem[] = [
  {
    href: '/dashboard',
    label: '대시보드',
    icon: <LayoutDashboard size={20} />,
    roles: 'all',
  },
  {
    href: '/data-input',
    label: '데이터 입력',
    icon: <ClipboardEdit size={20} />,
    roles: 'all', // 모든 계정에서 접근 가능
  },
  {
    href: '/settlement',
    label: '정산 현황',
    icon: <Calculator size={20} />,
    roles: 'all',
  },
  {
    href: '/marketing-log',
    label: '마케팅 로그',
    icon: <FileText size={20} />,
    roles: 'all',
  },
  {
    href: '/insights',
    label: '인사이트',
    icon: <Lightbulb size={20} />,
    roles: 'all',
  },
  {
    href: '/admin/accounts',
    label: '계정 관리',
    icon: <KeyRound size={20} />,
    roles: ['SUPER_ADMIN', 'SKP_ADMIN'], // SKP만 접근 가능
  },
]

export function Sidebar({ userRole, userName, companyName }: SidebarProps) {
  const pathname = usePathname()

  const filteredItems = navItems.filter(
    (item) => item.roles === 'all' || item.roles.includes(userRole)
  )

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/login'
  }

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-dashboard-card border-r border-dashboard-border flex flex-col z-50">
      {/* Logo */}
      <div className="p-6 border-b border-dashboard-border">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-maze-500 to-maze-700 rounded-xl flex items-center justify-center">
            <span className="text-white font-bold text-lg">M</span>
          </div>
          <div>
            <h1 className="font-bold text-dashboard-text">메이즈랜드</h1>
            <p className="text-xs text-dashboard-muted">대시보드</p>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 overflow-y-auto">
        <ul className="space-y-1">
          {filteredItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200',
                    isActive
                      ? 'bg-maze-500/10 text-maze-500 font-medium'
                      : 'text-dashboard-muted hover:text-dashboard-text hover:bg-dashboard-border/50'
                  )}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* User Info */}
      <div className="p-4 border-t border-dashboard-border">
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-dashboard-bg">
          <div className="w-10 h-10 bg-maze-500/20 rounded-full flex items-center justify-center">
            <span className="text-maze-500 font-medium">
              {userName.charAt(0)}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-dashboard-text truncate">
              {userName}
            </p>
            <p className="text-xs text-dashboard-muted truncate">
              {companyName || '시스템'}
            </p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full mt-2 flex items-center gap-3 px-4 py-3 rounded-lg text-dashboard-muted hover:text-red-500 hover:bg-red-500/10 transition-all duration-200"
        >
          <LogOut size={20} />
          <span>로그아웃</span>
        </button>
      </div>
    </aside>
  )
}



