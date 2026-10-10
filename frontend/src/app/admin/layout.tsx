import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth/profile'
import { AdminShell } from '@/components/layout/admin-shell'

export const metadata = { title: 'Administration' }

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const result = await getProfile()

  if (result.kind === 'anonymous') redirect('/login')
  if (result.kind === 'unresolved') redirect('/probleme-acces')
  if (!result.profile.is_active) redirect('/login?error=ACCOUNT_DISABLED')
  if (result.profile.role !== 'admin') redirect('/interdit')

  return (
    <AdminShell profile={result.profile}>
      <main className="lg:pl-64">{children}</main>
    </AdminShell>
  )
}
