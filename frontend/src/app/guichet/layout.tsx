import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth/profile'
import { DeskShell } from '@/components/layout/desk-shell'

export const metadata = { title: 'Guichet' }

export default async function GuichetLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile()

  if (!profile) redirect('/login')
  if (!profile.is_active) redirect('/login?error=ACCOUNT_DISABLED')
  if (!['logistician', 'admin'].includes(profile.role)) redirect('/interdit')

  return (
    <DeskShell profile={profile}>
      <main className="lg:pl-64">{children}</main>
    </DeskShell>
  )
}
