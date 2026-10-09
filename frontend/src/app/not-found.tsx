export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4 text-center">
      <p className="text-6xl font-bold text-muted-foreground">404</p>
      <h1 className="text-xl font-semibold">Page introuvable</h1>
      <p className="text-sm text-muted-foreground">
        La page demandée n'existe pas ou a été déplacée.
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