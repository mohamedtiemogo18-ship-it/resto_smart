import { API_URL } from './api-url'

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/**
 * Appelle le backend depuis le navigateur.
 *
 * Le jeton de session est dans un cookie HttpOnly posé par Supabase : il
 * voyage automatiquement avec `credentials: 'include'` et n'est jamais
 * manipulé en JavaScript.
 */
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
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
