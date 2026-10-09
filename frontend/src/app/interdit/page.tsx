export default function ForbiddenPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4 text-center">
      <p className="text-6xl font-bold text-destructive">403</p>
      <h1 className="text-xl font-semibold">Accès refusé</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Votre rôle ne permet pas d'accéder à cet espace. Contactez l'administrateur si vous pensez
        qu'il s'agit d'une erreur.
      </p>
      <a
        href="/"
        className="mt-2 h-10 rounded-md bg-primary px-4 text-sm font-medium leading-10 text-primary-foreground"
      >
        Retour à l'accueil
      </a>
    </div>
  )
}