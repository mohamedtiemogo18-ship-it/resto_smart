import { AlertCircle, RefreshCw } from 'lucide-react'

import { Button } from './button'
import { Alert } from './alert'
import { ApiError } from '@/lib/api'

export function ErrorState({
  error,
  onRetry,
}: {
  error: unknown
  onRetry?: () => void
}) {
  const apiError = error instanceof ApiError ? error : null
  const message = apiError?.message ?? "Une erreur est survenue lors du chargement."
  const code = apiError?.code

  return (
    <Alert variant="destructive" title="Chargement impossible">
      <p>{message}</p>
      {code && <p className="mt-1 font-mono text-xs opacity-70">{code}</p>}
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
          <RefreshCw className="h-3.5 w-3.5" />
          Réessayer
        </Button>
      )}
    </Alert>
  )
}

/** Erreur de chargement pleine page, pour les vues serveur. */
export function ErrorPage({
  title = 'Une erreur est survenue',
  description,
  code,
}: {
  title?: string
  description?: string
  code?: string
}) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive-muted text-destructive">
        <AlertCircle className="h-6 w-6" />
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">{title}</h2>
        {description && (
          <p className="max-w-md text-pretty text-sm text-muted-foreground">{description}</p>
        )}
        {code && <p className="font-mono text-xs text-muted-foreground">{code}</p>}
      </div>
    </div>
  )
}
