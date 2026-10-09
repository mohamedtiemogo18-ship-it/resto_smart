import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth/profile'
import { StudentShell } from '@/components/layout/student-shell'

export const metadata = { title: 'Mon espace' }

export default async function EtudiantLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile()

  if (!profile) redirect('/login')
  if (!profile.is_active) redirect('/login?error=ACCOUNT_DISABLED')
  if (profile.role !== 'student') redirect('/')

  return (
    <StudentShell profile={profile}>
      <main className="pb-24">{children}</main>
    </StudentShell>
  )
}
