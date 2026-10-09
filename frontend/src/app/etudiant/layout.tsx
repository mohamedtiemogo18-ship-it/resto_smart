import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { StudentShell } from '@/components/layout/student-shell'

export const metadata = {
  title: 'Mon espace',
}

export default async function EtudiantLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, is_active, full_name, matricule, room')
    .eq('id', user.id)
    .single()

  if (!profile || !profile.is_active) {
    redirect('/login?error=ACCOUNT_DISABLED')
  }

  if (profile.role !== 'student') redirect('/')

  return (
    <StudentShell profile={profile}>
      <main className="pb-24">{children}</main>
    </StudentShell>
  )
}