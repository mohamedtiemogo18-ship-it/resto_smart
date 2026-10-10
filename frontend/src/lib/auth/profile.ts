import { createClient } from '@/lib/supabase/server'

export type ProfileResult =
  | { kind: 'anonymous' }
  | { kind: 'unresolved' }
  | {
      kind: 'ok'
      profile: {
        id: string
        full_name: string
        matricule: string | null
        room: string | null
        role: 'student' | 'logistician' | 'admin'
        is_active: boolean
      }
    }

/**
 * Profil applicatif, résolu par le backend à partir du jeton de session.
 *
 * Le frontend ne lit JAMAIS la table `profiles` via Supabase/PostgREST :
 * le rôle est une donnée de sécurité, et sa source de vérité doit être le
 * backend, pas le navigateur. Cela supprime aussi une dépendance entière au
 * service REST de Supabase.
 *
 * Le résultat est discriminant, ce qui évite une boucle de redirections :
 * si un utilisateur EST connecté mais que le backend ne renvoie pas de
 * profil, renvoyer vers `/login` ferait rebondir le middleware — qui
 * renvoie les utilisateurs connectés vers `/` — à l'infini.
 */
export async function getProfile(): Promise<ProfileResult> {
  const supabase = createClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.access_token) return { kind: 'anonymous' }

  try {
    const res = await fetch(`${process.env.API_INTERNAL_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: 'no-store',
    })

    if (!res.ok) {
      // Backend injoignable ou jeton refusé : on NE renvoie PAS vers /login,
      // sinon boucle infinie avec le middleware.
      return { kind: 'unresolved' }
    }

    const body = await res.json()
    const data = body.data ?? body
    if (!data?.id || !data?.role) return { kind: 'unresolved' }

    return {
      kind: 'ok',
      profile: {
        id: data.id,
        full_name: data.full_name,
        matricule: data.matricule ?? null,
        room: data.room ?? null,
        role: data.role,
        is_active: data.is_active ?? true,
      },
    }
  } catch {
    return { kind: 'unresolved' }
  }
}
