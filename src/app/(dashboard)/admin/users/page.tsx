import { redirect } from 'next/navigation'
import { getCurrentUser, canManageUsers, ROLE_NAMES } from '@/lib/auth'
import { Header } from '@/components/dashboard/Header'
import { Card, CardHeader } from '@/components/ui'
import { formatDateTime } from '@/lib/utils'
import { cn } from '@/lib/utils'
import {
  Shield,
  User,
  Mail,
  Building2,
  CheckCircle,
  XCircle,
} from 'lucide-react'

// 임시 사용자 데이터
const mockUsers = [
  { id: '1', name: '시스템 관리자', email: 'admin@mazeland.com', role: 'SUPER_ADMIN', company: null, isActive: true, createdAt: '2024-01-01' },
  { id: '2', name: 'SKP 담당자', email: 'skp@mazeland.com', role: 'SKP_ADMIN', company: { name: 'SKP' }, isActive: true, createdAt: '2024-01-15' },
  { id: '3', name: '메이즈랜드 담당자', email: 'maze@mazeland.com', role: 'MAZE_ADMIN', company: { name: '메이즈랜드' }, isActive: true, createdAt: '2024-02-01' },
  { id: '4', name: '컬처커넥션 담당자', email: 'culture@mazeland.com', role: 'CULTURE_ADMIN', company: { name: '컬처커넥션' }, isActive: true, createdAt: '2024-02-15' },
  { id: '5', name: '운영대행사 담당자', email: 'agency@mazeland.com', role: 'AGENCY_ADMIN', company: { name: '운영대행사' }, isActive: false, createdAt: '2024-03-01' },
]

export default async function UsersPage() {
  const user = await getCurrentUser()
  
  if (!user || !canManageUsers(user.role)) {
    redirect('/dashboard')
  }

  // 임시 데이터 사용
  const users = mockUsers as any[]

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN': return 'bg-red-500/20 text-red-500'
      case 'SKP_ADMIN': return 'bg-blue-500/20 text-blue-500'
      case 'MAZE_ADMIN': return 'bg-maze-500/20 text-maze-500'
      case 'CULTURE_ADMIN': return 'bg-purple-500/20 text-purple-500'
      case 'AGENCY_ADMIN': return 'bg-orange-500/20 text-orange-500'
      default: return 'bg-gray-500/20 text-gray-500'
    }
  }

  return (
    <div className="min-h-screen">
      <Header
        title="사용자 관리"
        description="시스템 사용자 계정을 관리합니다"
      />
      
      <div className="p-8 space-y-6">
        {/* 통계 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="text-center">
            <p className="text-sm text-dashboard-muted">전체 사용자</p>
            <p className="text-3xl font-bold text-dashboard-text mt-2">{users.length}</p>
          </Card>
          <Card className="text-center">
            <p className="text-sm text-dashboard-muted">활성 사용자</p>
            <p className="text-3xl font-bold text-maze-500 mt-2">
              {users.filter(u => u.isActive).length}
            </p>
          </Card>
          <Card className="text-center">
            <p className="text-sm text-dashboard-muted">관리자</p>
            <p className="text-3xl font-bold text-blue-500 mt-2">
              {users.filter(u => u.role === 'SUPER_ADMIN' || u.role === 'SKP_ADMIN').length}
            </p>
          </Card>
          <Card className="text-center">
            <p className="text-sm text-dashboard-muted">비활성</p>
            <p className="text-3xl font-bold text-orange-500 mt-2">
              {users.filter(u => !u.isActive).length}
            </p>
          </Card>
        </div>

        {/* 사용자 목록 */}
        <Card>
          <CardHeader
            title="사용자 목록"
            description="등록된 모든 사용자"
          />
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dashboard-border">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-dashboard-muted">사용자</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-dashboard-muted">이메일</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-dashboard-muted">역할</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-dashboard-muted">소속</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-dashboard-muted">상태</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-dashboard-muted">가입일</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u: any, index: number) => (
                  <tr 
                    key={u.id}
                    className="border-b border-dashboard-border/50 hover:bg-dashboard-border/30 transition-colors animate-slide-up"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-dashboard-border rounded-full flex items-center justify-center">
                          <User className="w-5 h-5 text-dashboard-muted" />
                        </div>
                        <span className="text-dashboard-text font-medium">{u.name}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2 text-dashboard-muted">
                        <Mail className="w-4 h-4" />
                        {u.email}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className={cn(
                        'px-2.5 py-1 rounded-full text-xs font-medium',
                        getRoleColor(u.role)
                      )}>
                        {ROLE_NAMES[u.role as keyof typeof ROLE_NAMES] || u.role}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      {u.company ? (
                        <div className="flex items-center gap-2 text-dashboard-text">
                          <Building2 className="w-4 h-4 text-dashboard-muted" />
                          {u.company.name}
                        </div>
                      ) : (
                        <span className="text-dashboard-muted">-</span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-center">
                      {u.isActive ? (
                        <span className="inline-flex items-center gap-1 text-maze-500">
                          <CheckCircle className="w-4 h-4" />
                          활성
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-red-500">
                          <XCircle className="w-4 h-4" />
                          비활성
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-dashboard-muted text-sm">
                      {formatDateTime(u.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* 역할 설명 */}
        <Card>
          <CardHeader title="역할 권한 안내" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(ROLE_NAMES).map(([role, name]) => (
              <div key={role} className="p-4 bg-dashboard-bg rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-4 h-4 text-dashboard-muted" />
                  <span className={cn(
                    'px-2 py-0.5 rounded-full text-xs font-medium',
                    getRoleColor(role)
                  )}>
                    {name}
                  </span>
                </div>
                <p className="text-sm text-dashboard-muted">
                  {role === 'SUPER_ADMIN' && '전체 데이터 조회 및 시스템 관리'}
                  {role === 'SKP_ADMIN' && '전체 정산 및 마케팅 로그 관리'}
                  {role === 'MAZE_ADMIN' && '메이즈랜드 관점 데이터만 조회'}
                  {role === 'CULTURE_ADMIN' && '컬처커넥션 관점 데이터만 조회'}
                  {role === 'AGENCY_ADMIN' && '운영대행사 관점 데이터만 조회'}
                </p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
