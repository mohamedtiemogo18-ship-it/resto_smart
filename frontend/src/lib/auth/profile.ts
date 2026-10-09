import { createClient } from '@/lib/supabase/server'

/**
 * Profil applicatif, résolu par le backend à partir du jeton de session.
 *
 * Le frontend ne lit JAMAIS la table `profiles` via Supabase/PostgREST :
 * le rôle est une donnée de sécurité, et sa source de vérité doit être le
 * backend, pas le navigateur. Cela supprime aussi une dépendance entière au
 * service REST de Supabase.
 */
export async function getProfile(): Promise<{
  id: string
  full_name: string
  matricule: string | null
  room: string | null
  role: 'student' | 'logistician' | 'admin'
  is_active: boolean
} | null> {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.access_token) return null

  try {
    const res = await fetch(`${process.env.API_INTERNAL_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: 'no-store',
    })
    if (!res.ok) return null
    const body = await res.json()
    return body.data ?? null
  } catch {
    // Backend injoignable : le layout décide quoi faire (souvent bloquer)
    return null
  }
}
