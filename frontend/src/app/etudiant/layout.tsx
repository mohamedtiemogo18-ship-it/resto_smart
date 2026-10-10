import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth/profile'
import { StudentShell } from '@/components/layout/student-shell'

export const metadata = { title: 'Mon espace' }

export default async function EtudiantLayout({ children }: { children: React.ReactNode }) {
  const result = await getProfile()

  if (result.kind === 'anonymous') redirect('/login')
  if (result.kind === 'unresolved') redirect('/probleme-acces')
  if (!result.profile.is_active) redirect('/login?error=ACCOUNT_DISABLED')
  if (result.profile.role !== 'student') redirect('/')

  return (
    <StudentShell profile={result.profile}>
      <main className="pb-24">{children}</main>
    </StudentShell>
  )
}
