import { redirect } from 'next/navigation'
import { getCurrentUser, canManageUsers } from '@/lib/auth'
import { Header } from '@/components/dashboard/Header'
import { Card, CardHeader } from '@/components/ui'
import { cn } from '@/lib/utils'
import { Building2, Users } from 'lucide-react'

// 임시 회사 데이터
const mockCompanies = [
  { id: '1', name: 'SKP', code: 'SKP', description: '주식회사 SKP', _count: { users: 1 }, createdAt: '2024-01-01' },
  { id: '2', name: '메이즈랜드', code: 'MAZE', description: '메이즈랜드 운영사', _count: { users: 1 }, createdAt: '2024-01-01' },
  { id: '3', name: '컬처커넥션', code: 'CULTURE', description: '컬처커넥션', _count: { users: 1 }, createdAt: '2024-01-01' },
  { id: '4', name: '운영대행사', code: 'AGENCY', description: '운영대행사', _count: { users: 1 }, createdAt: '2024-01-01' },
]

export default async function CompaniesPage() {
  const user = await getCurrentUser()
  
  if (!user || !canManageUsers(user.role)) {
    redirect('/dashboard')
  }

  // 임시 데이터 사용
  const companies = mockCompanies as any[]

  const getCompanyColor = (code: string) => {
    switch (code) {
      case 'SKP': return 'bg-blue-500'
      case 'MAZE': return 'bg-maze-500'
      case 'CULTURE': return 'bg-purple-500'
      case 'AGENCY': return 'bg-orange-500'
      default: return 'bg-gray-500'
    }
  }

  return (
    <div className="min-h-screen">
      <Header
        title="회사 관리"
        description="정산 대상 회사를 관리합니다"
      />
      
      <div className="p-8 space-y-6">
        {/* 회사 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {companies.map((company: any, index: number) => (
            <Card 
              key={company.id}
              hover
              className="animate-slide-up"
              style={{ animationDelay: `${index * 100}ms` } as any}
            >
              <div className="flex items-start gap-4">
                <div className={cn(
                  'w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg',
                  getCompanyColor(company.code)
                )}>
                  {company.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-dashboard-text">{company.name}</h3>
                  <p className="text-xs text-dashboard-muted mt-0.5">{company.code}</p>
                </div>
              </div>
              
              <p className="text-sm text-dashboard-muted mt-4">
                {company.description || '-'}
              </p>
              
              <div className="flex items-center gap-4 mt-4 pt-4 border-t border-dashboard-border">
                <div className="flex items-center gap-2 text-sm text-dashboard-muted">
                  <Users className="w-4 h-4" />
                  <span>사용자 {company._count?.users || 0}명</span>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* 정산 구조 설명 */}
        <Card>
          <CardHeader
            title="정산 구조"
            description="회사 간 자금 흐름"
          />
          <div className="space-y-6">
            {/* 정산 흐름도 */}
            <div className="relative p-8 bg-dashboard-bg rounded-xl overflow-hidden">
              {/* 배경 그라데이션 */}
              <div className="absolute inset-0 bg-gradient-to-br from-maze-500/5 to-purple-500/5" />
              
              <div className="relative flex items-center justify-center gap-4 flex-wrap">
                {/* 고객 */}
                <div className="text-center">
                  <div className="w-16 h-16 bg-dashboard-card border border-dashboard-border rounded-full flex items-center justify-center mx-auto">
                    <Users className="w-8 h-8 text-dashboard-muted" />
                  </div>
                  <p className="text-sm text-dashboard-text mt-2">고객</p>
                  <p className="text-xs text-dashboard-muted">3,000원</p>
                </div>
                
                <div className="text-dashboard-muted">→</div>
                
                {/* SKP */}
                <div className="text-center">
                  <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mx-auto">
                    <span className="text-white font-bold text-xl">S</span>
                  </div>
                  <p className="text-sm text-dashboard-text mt-2">SKP</p>
                  <p className="text-xs text-blue-500">순매출 수취</p>
                </div>
                
                <div className="flex flex-col items-center text-dashboard-muted">
                  <span>→ 1,000원</span>
                  <span className="text-xs">+ 500원</span>
                </div>
                
                {/* 메이즈랜드 */}
                <div className="text-center">
                  <div className="w-16 h-16 bg-maze-500 rounded-full flex items-center justify-center mx-auto">
                    <span className="text-white font-bold text-xl">M</span>
                  </div>
                  <p className="text-sm text-dashboard-text mt-2">메이즈랜드</p>
                  <p className="text-xs text-maze-500">1,000원</p>
                </div>
                
                <div className="text-dashboard-muted">→ 500원</div>
                
                {/* 컬처커넥션 */}
                <div className="text-center">
                  <div className="w-16 h-16 bg-purple-500 rounded-full flex items-center justify-center mx-auto">
                    <span className="text-white font-bold text-xl">C</span>
                  </div>
                  <p className="text-sm text-dashboard-text mt-2">컬처커넥션</p>
                  <p className="text-xs text-purple-500">1,000원</p>
                </div>
                
                <div className="text-dashboard-muted">→ 200원</div>
                
                {/* 다시 SKP */}
                <div className="text-center">
                  <div className="w-12 h-12 bg-blue-500/30 border-2 border-blue-500 rounded-full flex items-center justify-center mx-auto">
                    <span className="text-blue-500 font-bold">S</span>
                  </div>
                  <p className="text-xs text-dashboard-muted mt-2">플랫폼료</p>
                </div>
              </div>
            </div>

            {/* 회사별 정산 요약 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <h4 className="font-semibold text-blue-500">SKP</h4>
                <ul className="text-sm text-dashboard-muted mt-2 space-y-1">
                  <li>• 순매출 수취</li>
                  <li>• 메이즈랜드 1,000원 지급</li>
                  <li>• 컬처커넥션 500원 지급</li>
                  <li>• 플랫폼 이용료 200원 수입</li>
                </ul>
              </div>
              
              <div className="p-4 bg-maze-500/10 border border-maze-500/30 rounded-lg">
                <h4 className="font-semibold text-maze-500">메이즈랜드</h4>
                <ul className="text-sm text-dashboard-muted mt-2 space-y-1">
                  <li>• SKP로부터 1,000원 수취</li>
                  <li>• 컬처커넥션 500원 지급</li>
                  <li>• 순이익: 500원</li>
                </ul>
              </div>
              
              <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                <h4 className="font-semibold text-purple-500">컬처커넥션</h4>
                <ul className="text-sm text-dashboard-muted mt-2 space-y-1">
                  <li>• SKP 500원 + 메이즈 500원 수취</li>
                  <li>• SKP에 200원 지급</li>
                  <li>• 순이익: 800원</li>
                </ul>
              </div>
              
              <div className="p-4 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                <h4 className="font-semibold text-orange-500">운영대행사</h4>
                <ul className="text-sm text-dashboard-muted mt-2 space-y-1">
                  <li>• 별도 수수료 계약</li>
                  <li>• 현재 0% 설정</li>
                  <li>• 추후 조정 가능</li>
                </ul>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
