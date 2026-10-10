import Link from 'next/link'

export const metadata = { title: 'Accès impossible' }

export default function ProblemeAccesPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 p-6 text-center">
      <h1 className="text-2xl font-bold">Votre profil n'a pas pu être chargé</h1>

      <p className="max-w-md text-sm text-muted-foreground">
        Vous êtes bien connecté, mais le serveur n'a pas renvoyé votre profil. Cela
        arrive dans trois cas :
      </p>

      <ol className="max-w-md space-y-2 text-left text-sm text-muted-foreground">
        <li>
          <strong className="text-foreground">1.</strong> Le backend n'est pas
          démarré, ou l'URL <code className="font-mono text-xs">API_INTERNAL_URL</code>{' '}
          ne pointe pas vers lui.
        </li>
        <li>
          <strong className="text-foreground">2.</strong> Votre compte existe dans
          l'authentification, mais aucun profil ne lui correspond dans la table{' '}
          <code className="font-mono text-xs">public.profiles</code>.
        </li>
        <li>
          <strong className="text-foreground">3.</strong> Votre compte a été désactivé
          par l'administrateur.
        </li>
      </ol>

      <p className="max-w-md text-sm text-muted-foreground">
        Si vous êtes administrateur, vérifiez qu'une ligne de la table{' '}
        <code className="font-mono text-xs">profiles</code> porte le même
        identifiant que votre compte, avec un rôle renseigné.
      </p>

      <div className="flex gap-3">
        <Link
          href="/"
          className="h-10 rounded-md bg-primary px-4 text-sm font-medium leading-10 text-primary-foreground"
        >
          Réessayer
        </Link>
        <Link
          href="/login"
          className="h-10 rounded-md border px-4 text-sm font-medium leading-10 hover:bg-accent"
        >
          Se reconnecter
        </Link>
      </div>
    </div>
  )
}
