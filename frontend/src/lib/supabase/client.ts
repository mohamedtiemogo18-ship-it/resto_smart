import { createBrowserClient } from '@supabase/ssr'

/**
 * Client Supabase pour le navigateur.
 *
 * IMPORTANT : les variables `NEXT_PUBLIC_*` doivent être lues par un accès
 * LITTÉRAL (`process.env.NEXT_PUBLIC_X`), jamais via un nom de variable
 * passé en paramètre. Next.js les remplace statiquement à la compilation :
 * un accès dynamique n'est pas remplacé, et `process.env` n'existe pas dans
 * le navigateur — la valeur serait donc `undefined` à l'exécution.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export function createClient() {
  // Vérification à l'intérieur de la fonction : TypeScript ne propage pas
  // le narrowing d'une garde de module vers le corps d'une fonction.
  const url = supabaseUrl
  const key = supabaseAnonKey

  if (!url || !key) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY sont requises. ' +
        'Copiez .env.example vers .env.local et renseignez vos valeurs Supabase.'
    )
  }

  return createBrowserClient(url, key)
}
