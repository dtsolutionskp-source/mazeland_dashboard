import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { Sidebar } from '@/components/dashboard/Sidebar'
import { AuthWrapper } from '@/components/auth/AuthWrapper'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <AuthWrapper>
      <div className="min-h-screen bg-dashboard-bg">
        <Sidebar
          userRole={user.role}
          userName={user.name}
          companyName={user.company?.name}
        />
        <main className="ml-64">
          {children}
        </main>
      </div>
    </AuthWrapper>
  )
}



