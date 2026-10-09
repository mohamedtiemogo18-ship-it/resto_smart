import { createBrowserClient } from '@supabase/ssr'

/**
 * Client Supabase pour le navigateur.
 *
 * Les deux valeurs sont des variables `NEXT_PUBLIC_*` : la clé anonyme est
 * publique par conception, la protection vient de la RLS, pas du secret.
 */
function required(name: 'NEXT_PUBLIC_SUPABASE_URL' | 'NEXT_PUBLIC_SUPABASE_ANON_KEY'): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `${name} est requise. Copiez .env.example vers .env.local et renseignez vos valeurs Supabase.`
    )
  }
  return value
}

export function createClient() {
  return createBrowserClient(
    required('NEXT_PUBLIC_SUPABASE_URL'),
    required('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  )
}
