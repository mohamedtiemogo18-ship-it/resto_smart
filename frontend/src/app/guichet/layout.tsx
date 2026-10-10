import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth/profile'
import { DeskShell } from '@/components/layout/desk-shell'

export const metadata = { title: 'Guichet' }

export default async function GuichetLayout({ children }: { children: React.ReactNode }) {
  const result = await getProfile()

  if (result.kind === 'anonymous') redirect('/login')
  if (result.kind === 'unresolved') redirect('/probleme-acces')
  if (!result.profile.is_active) redirect('/login?error=ACCOUNT_DISABLED')
  if (!['logistician', 'admin'].includes(result.profile.role)) redirect('/interdit')

  return (
    <DeskShell profile={result.profile}>
      <main className="lg:pl-64">{children}</main>
    </DeskShell>
  )
}
