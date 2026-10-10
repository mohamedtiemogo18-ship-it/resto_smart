'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Inbox, Search } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/alert'
import { ErrorState } from '@/components/ui/error-state'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/ui/layout'
import { useDebounce } from '@/hooks/use-debounce'
import { useReservations } from '@/hooks/use-api'
import { formatMoney } from '@/lib/format/money'
import { formatRelative } from '@/lib/format/date'
import { statusLabel } from '@/lib/format/status'
import type { Reservation } from '@/types'

export default function EncaisserPage() {
  const [recherche, setRecherche] = useState('')
  const valeurDebouncee = useDebounce(recherche, 350)

  // À partir de 4 caractères, on cherche par numéro ; sinon file d'attente
  const estNumero = valeurDebouncee.trim().length >= 4

  const { data, isLoading, isError, error, refetch } = useReservations({
    status: estNumero ? undefined : 'PENDING_PAYMENT',
    number: estNumero ? valeurDebouncee.trim().toUpperCase() : undefined,
    page_size: 20,
  })

  const resultats = data?.items ?? []

  return (
    <div className="page">
      <PageHeader
        title="Encaisser"
        description="Recherchez une réservation, vérifiez le montant, confirmez le paiement."
      />

      {/* Recherche */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Numéro de réservation (ex. RES-2026-000137)"
          aria-label="Rechercher une réservation"
          className="pl-9 font-mono"
          autoComplete="off"
        />
      </div>

      {!estNumero && (
        <p className="text-xs text-muted-foreground">
          File d'attente — les réservations en attente de paiement, les plus
          anciennes d'abord. Saisissez un numéro pour une recherche ciblée.
        </p>
      )}

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      )}

      {isError && <ErrorState error={error} onRetry={refetch} />}

      {!isLoading && !isError && resultats.length === 0 && (
        <EmptyState
          icon={valeurDebouncee ? <Search className="h-5 w-5" /> : <Inbox className="h-5 w-5" />}
          title={valeurDebouncee ? 'Aucun résultat' : 'File vide'}
          description={
            valeurDebouncee
              ? `Aucune réservation ne correspond à « ${valeurDebouncee} ».`
              : 'Aucune réservation en attente. Les nouvelles demandes apparaissent ici automatiquement.'
          }
        />
      )}

      {!isLoading && !isError && resultats.length > 0 && (
        <ul className="space-y-3">
          {resultats.map((reservation) => (
            <ReservationCard key={reservation.id} reservation={reservation} />
          ))}
        </ul>
      )}
    </div>
  )
}

function ReservationCard({ reservation }: { reservation: Reservation }) {
  const encaissable = reservation.status === 'PENDING_PAYMENT'

  return (
    <Card className={encaissable ? 'border-warning/40' : undefined}>
      <CardContent className="flex flex-wrap items-center gap-4 p-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-semibold">
              {reservation.reservation_number}
            </span>
            <Badge status={reservation.status}>
              {statusLabel(reservation.status)}
            </Badge>
          </div>
          <p className="mt-1 truncate text-sm">
            {reservation.student.full_name}
            {reservation.student.matricule && (
              <span className="text-muted-foreground">
                {' '}
                · {reservation.student.matricule}
              </span>
            )}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {reservation.items_count} repas ·{' '}
            {formatRelative(reservation.created_at)}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-lg font-bold tabular-nums">
            {formatMoney(reservation.total_amount)}
          </p>
          <p className="text-xs text-muted-foreground">à encaisser</p>
        </div>

        <Button
          asChild
          size="sm"
          variant={encaissable ? 'default' : 'outline'}
          className="shrink-0"
        >
          <Link href={`/guichet/encaisser/${reservation.id}`}>
            {encaissable ? 'Encaisser' : 'Voir'}
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}
