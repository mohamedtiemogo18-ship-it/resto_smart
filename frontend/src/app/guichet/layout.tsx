import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DeskShell } from '@/components/layout/desk-shell'

export const metadata = {
  title: 'Guichet',
}

export default async function GuichetLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, is_active, full_name')
    .eq('id', user.id)
    .single()

  if (!profile || !profile.is_active) {
    redirect('/login?error=ACCOUNT_DISABLED')
  }

  if (!['logistician', 'admin'].includes(profile.role)) {
    redirect('/interdit')
  }

  return (
    <DeskShell profile={profile}>
      <main className="lg:pl-64">{children}</main>
    </DeskShell>
  )
}