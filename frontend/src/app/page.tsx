import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth/profile'

export default async function HomePage() {
  const profile = await getProfile()

  if (!profile) redirect('/login')
  if (!profile.is_active) redirect('/login?error=ACCOUNT_DISABLED')

  if (profile.role === 'student') redirect('/etudiant/tableau-de-bord')
  if (profile.role === 'logistician') redirect('/guichet/tableau-de-bord')
  if (profile.role === 'admin') redirect('/admin/tableau-de-bord')

  redirect('/login')
}
