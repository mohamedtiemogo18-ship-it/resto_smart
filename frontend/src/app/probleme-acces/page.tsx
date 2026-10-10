import { PageHeader } from '@/components/ui/layout'
import { EmptyState } from '@/components/ui/alert'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function ProblemeAccesPage() {
  return (
    <div className="grid min-h-screen place-items-center bg-muted/25 px-4 py-10">
      <div className="w-full max-w-lg">
        <PageHeader
          title="Profil non chargé"
          description="Vous êtes connecté, mais le serveur n'a pas renvoyé votre profil."
        />

        <div className="mt-6 space-y-4">
          <Alert variant="warning" title="Trois causes possibles">
            <ol className="mt-1 list-decimal space-y-1.5 pl-4">
              <li>
                Le backend n'est pas démarré, ou la variable{' '}
                <code className="rounded bg-background/60 px-1 font-mono text-xs">
                  API_INTERNAL_URL
                </code>{' '}
                ne pointe pas vers lui.
              </li>
              <li>
                Votre compte existe dans l'authentification, mais aucune ligne
                ne lui correspond dans la table{' '}
                <code className="rounded bg-background/60 px-1 font-mono text-xs">
                  public.profiles
                </code>
                .
              </li>
              <li>Votre compte a été désactivé par l'administrateur.</li>
            </ol>
          </Alert>

          <EmptyState
            icon={<span aria-hidden="true">🔍</span>}
            title="Vérifier votre profil"
            description="Si vous êtes administrateur, assurez-vous qu'une ligne de la table profiles porte le même identifiant que votre compte, avec un rôle renseigné."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button asChild>
                  <Link href="/">Réessayer</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/login">Se reconnecter</Link>
                </Button>
              </div>
            }
          />
        </div>
      </div>
    </div>
  )
}
