import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AdminShell } from '@/components/layout/admin-shell'

export const metadata = {
  title: 'Administration',
}

export default async function AdminLayout({
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

  if (profile.role !== 'admin') {
    redirect('/interdit')
  }

  return (
    <AdminShell profile={profile}>
      <main className="lg:pl-64">{children}</main>
    </AdminShell>
  )
}