'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Le détail complet part dans la console, jamais à l'utilisateur
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4 text-center">
      <h1 className="text-xl font-semibold">Une erreur est survenue</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Le problème a été enregistré. Vous pouvez réessayer ou revenir à l'accueil.
      </p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          Réessayer
        </button>
        <a
          href="/"
          className="h-10 rounded-md border px-4 text-sm font-medium leading-10 hover:bg-accent"
        >
          Accueil
        </a>
      </div>
    </div>
  )
}