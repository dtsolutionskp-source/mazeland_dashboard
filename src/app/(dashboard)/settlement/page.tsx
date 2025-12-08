import { getCurrentUser, getViewableCompanyCodes, canViewAllData } from '@/lib/auth'
import { Header } from '@/components/dashboard/Header'
import { Card, CardHeader } from '@/components/ui'
import { SettlementTable } from '@/components/charts'
import { formatCurrency } from '@/lib/utils'
import { getUploadData } from '@/lib/data-store'

export default async function SettlementPage() {
  const user = await getCurrentUser()
  
  if (!user) {
    return null
  }

  const viewableCompanies = getViewableCompanyCodes(user.role, user.company?.code)
  const showAllData = canViewAllData(user.role)

  // 저장된 데이터에서 정산 정보 가져오기
  const uploadedData = await getUploadData()
  
  // 정산 데이터 (저장된 데이터가 없으면 빈 배열)
  const settlementData = uploadedData?.settlement?.companies || []

  // 필터링된 데이터
  const filteredData = showAllData 
    ? settlementData 
    : settlementData.filter((d: any) => viewableCompanies.includes(d.code || d.companyCode))

  // SKP 매출 (총 매출로 표시)
  const skpData = settlementData.find((d: any) => (d.code || d.companyCode) === 'SKP')
  const totalRevenue = skpData?.revenue || 0

  return (
    <div className="min-h-screen">
      <Header
        title="정산 현황"
        description="회사별 매출 현황을 확인합니다"
      />
      
      <div className="p-8 space-y-6">
        {/* 요약 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <div className="text-center">
              <p className="text-sm text-dashboard-muted">조회 가능 회사</p>
              <p className="text-3xl font-bold text-dashboard-text mt-2">
                {filteredData.length}개사
              </p>
            </div>
          </Card>
          <Card>
            <div className="text-center">
              <p className="text-sm text-dashboard-muted">SKP 매출 (수수료 제외)</p>
              <p className="text-3xl font-bold text-maze-500 mt-2">
                {formatCurrency(totalRevenue)}
              </p>
            </div>
          </Card>
        </div>

        {/* 정산 테이블 */}
        <Card>
          <CardHeader
            title="회사별 정산 상세"
            description={showAllData ? '전체 회사 데이터' : `${user.company?.name || '내'} 회사 관점 데이터`}
          />
          {settlementData.length > 0 ? (
            <SettlementTable
              data={settlementData}
              viewableCompanies={viewableCompanies}
              showDetails={showAllData}
            />
          ) : (
            <div className="text-center py-8 text-dashboard-muted">
              정산 데이터가 없습니다. 먼저 데이터를 업로드해주세요.
            </div>
          )}
        </Card>

        {/* 정산 흐름 설명 */}
        {showAllData && (
          <Card>
            <CardHeader title="정산 계산 방식" description="모든 금액은 수수료 차감 후 기준" />
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-dashboard-bg rounded-lg">
                <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <span className="text-blue-500 font-bold">SKP</span>
                </div>
                <div className="flex-1">
                  <p className="text-dashboard-text font-medium">SKP</p>
                  <p className="text-sm text-dashboard-muted">
                    매출: 3,000원/인 | 비용: 메이즈 1,000원 + 컬처 500원 + FMC 수수료 | 수입: 플랫폼료 200원
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 bg-dashboard-bg rounded-lg">
                <div className="w-12 h-12 bg-maze-500/20 rounded-lg flex items-center justify-center">
                  <span className="text-maze-500 font-bold">M</span>
                </div>
                <div className="flex-1">
                  <p className="text-dashboard-text font-medium">메이즈랜드</p>
                  <p className="text-sm text-dashboard-muted">
                    수입: SKP에서 1,000원/인 | 비용: 컬처커넥션에 500원/인 | 이익: 500원/인
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 bg-dashboard-bg rounded-lg">
                <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center">
                  <span className="text-purple-500 font-bold">C</span>
                </div>
                <div className="flex-1">
                  <p className="text-dashboard-text font-medium">컬처커넥션</p>
                  <p className="text-sm text-dashboard-muted">
                    수입: SKP 500원 + 메이즈 500원 = 1,000원/인 | 비용: 플랫폼료 200원/인 | 이익: 800원/인
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 bg-dashboard-bg rounded-lg">
                <div className="w-12 h-12 bg-orange-500/20 rounded-lg flex items-center justify-center">
                  <span className="text-orange-500 font-bold">F</span>
                </div>
                <div className="flex-1">
                  <p className="text-dashboard-text font-medium">FMC 운영 수수료</p>
                  <p className="text-sm text-dashboard-muted">
                    (SKP 매출 - 메이즈 지급 - SKP→컬처 지급) × 20% = (3,000 - 1,000 - 500) × 20% = 300원/인
                  </p>
                </div>
              </div>
              <div className="p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/30">
                <p className="text-sm text-yellow-500">
                  💡 채널 수수료가 있는 경우 모든 금액이 (1 - 수수료율)로 조정됩니다. 예: 10% 수수료 시 3,000원 → 2,700원
                </p>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
