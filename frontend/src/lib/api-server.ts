import { ApiError } from './api'

/**
 * Client API pour les Server Components Next.js.
 *
 * Passe le jeton Supabase en en-tête. Contrairement au client navigateur,
 * il ne peut pas rafraîchir la session : c'est le rôle du middleware.
 */

const BASE_URL =
  process.env.API_INTERNAL_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:8000/api/v1'

export async function apiServer<T>(
  path: string,
  token: string,
  init: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
  })

  const body = await res.json().catch(() => null)

  if (!res.ok || !body?.success) {
    throw new ApiError(
      body?.error?.code ?? `HTTP_${res.status}`,
      body?.error?.message ?? "Une erreur est survenue lors de l'appel au serveur.",
      res.status,
      body?.error?.details
    )
  }

  return body.data as T
}

/** Alias court, utilisé dans les pages. */
export const api = apiServer
