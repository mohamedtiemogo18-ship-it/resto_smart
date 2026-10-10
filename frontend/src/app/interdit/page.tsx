import { EmptyState } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/layout'
import Link from 'next/link'

export default function InterditPage() {
  return (
    <div className="grid min-h-screen place-items-center bg-muted/25 px-4 py-10">
      <div className="w-full max-w-md">
        <PageHeader
          title="Accès refusé"
          description="Votre rôle ne permet pas d'accéder à cet espace."
          className="mb-8"
        />

        <EmptyState
          icon={<span aria-hidden="true">🔒</span>}
          title="403 — Espace interdit"
          description="Si vous pensez qu'il s'agit d'une erreur, contactez l'administrateur pour qu'il modifie votre rôle."
          action={
            <Button asChild>
              <Link href="/">Retour à l'accueil</Link>
            </Button>
          }
        />
      </div>
    </div>
  )
}
