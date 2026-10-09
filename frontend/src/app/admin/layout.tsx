import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth/profile'
import { AdminShell } from '@/components/layout/admin-shell'

export const metadata = { title: 'Administration' }

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile()

  if (!profile) redirect('/login')
  if (!profile.is_active) redirect('/login?error=ACCOUNT_DISABLED')
  if (profile.role !== 'admin') redirect('/interdit')

  return (
    <AdminShell profile={profile}>
      <main className="lg:pl-64">{children}</main>
    </AdminShell>
  )
}
