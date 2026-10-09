import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function HomePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role === 'student') redirect('/etudiant/tableau-de-bord')
  if (profile?.role === 'logistician') redirect('/guichet/tableau-de-bord')
  if (profile?.role === 'admin') redirect('/admin/tableau-de-bord')

  redirect('/login')
}