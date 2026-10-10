import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth/profile'

export default async function HomePage() {
  const result = await getProfile()

  if (result.kind === 'anonymous') redirect('/login')

  // Utilisateur connecté mais profil non résolu : on affiche un message
  // clair plutôt que de rediriger vers /login, ce qui créerait une boucle
  // infinie avec le middleware.
  if (result.kind === 'unresolved') redirect('/probleme-acces')

  if (!result.profile.is_active) redirect('/login?error=ACCOUNT_DISABLED')

  if (result.profile.role === 'student') redirect('/etudiant/tableau-de-bord')
  if (result.profile.role === 'logistician') redirect('/guichet/tableau-de-bord')
  if (result.profile.role === 'admin') redirect('/admin/tableau-de-bord')

  redirect('/probleme-acces')
}
