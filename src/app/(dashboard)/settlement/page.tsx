import { getCurrentUser, canViewAllData } from '@/lib/auth'
import { SettlementClient } from './SettlementClient'

export default async function SettlementPage() {
  const user = await getCurrentUser()
  
  if (!user) {
    return null
  }

  const showAllData = canViewAllData(user.role)

  return <SettlementClient userRole={user.role} showAllData={showAllData} userName={user.name} />
}
