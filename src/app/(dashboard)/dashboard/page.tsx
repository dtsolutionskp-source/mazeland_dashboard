import { getCurrentUser } from '@/lib/auth'
import { Header } from '@/components/dashboard/Header'
import { DashboardClient } from './DashboardClient'

export default async function DashboardPage() {
  const user = await getCurrentUser()
  
  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen">
      <Header
        title="대시보드"
        description="메이즈랜드 매출 및 정산 현황을 한눈에 확인하세요"
      />
      <div className="p-8">
        <DashboardClient userRole={user.role} companyCode={user.company?.code} />
      </div>
    </div>
  )
}
