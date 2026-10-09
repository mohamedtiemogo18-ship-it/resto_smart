'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Search } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState, EmptyState } from '@/components/ui/error-state'
import { useDebounce } from '@/hooks/use-debounce'
import { useReservations } from '@/hooks/use-api'
import { formatDate, formatDateTime, formatRelative, toApiDate } from '@/lib/format/date'
import { formatMoney, computeChange, formatAmount } from '@/lib/format/money'
import { statusLabel } from '@/lib/format/status'

export default function EncaisserPage() {
  const [query, setQuery] = useState('')
  const debounced = useDebounce(query, 350)

  const { data, isLoading, isError, error, refetch } = useReservations({
    status: debounced.length >= 4 ? undefined : 'PENDING_PAYMENT',
    number: debounced.length >= 4 ? debounced.toUpperCase() : undefined,
    page_size: 20,
  })

  const items = data?.items ?? []

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div>
        <h1 className="text-2xl font-bold">Encaisser</h1>
        <p className="text-sm text-muted-foreground">
          Recherchez une réservation, vérifiez le montant, confirmez le paiement.
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Numéro de réservation ou matricule (ex. RES-2026-000137)"
          aria-label="Rechercher une réservation"
          className="pl-9"
        />
      </div>

      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      )}

      {isError && <ErrorState error={error} onRetry={refetch} />}

      {!isLoading && !isError && items.length === 0 && (
        <EmptyState
          title="Aucune réservation"
          description={
            debounced
              ? `Aucun résultat pour « ${debounced} ».`
              : "La file d'attente est vide. Les nouvelles réservations apparaissent ici automatiquement."
          }
        />
      )}

      {!isLoading && !isError && items.length > 0 && (
        <ul className="space-y-3">
          {items.map((r) => (
            <li key={r.id}>
              <Card>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm">{r.reservation_number}</span>
                      <Badge status={r.status}>{statusLabel(r.status)}</Badge>
                    </div>
                    <p className="text-sm">
                      {r.student.full_name}
                      {r.student.matricule && (
                        <span className="text-muted-foreground"> · {r.student.matricule}</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {r.items_count} repas · il y a {formatRelative(r.created_at).replace('il y a ', '')}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-lg font-bold tabular-nums">
                        {formatMoney(r.total_amount)}
                      </p>
                      <p className="text-xs text-muted-foreground">à encaisser</p>
                    </div>
                    {r.status === 'PENDING_PAYMENT' ? (
                      <Button asChild>
                        <Link href={`/guichet/encaisser/${r.id}`}>Encaisser</Link>
                      </Button>
                    ) : (
                      <Button asChild variant="outline">
                        <Link href={`/guichet/encaisser/${r.id}`}>Voir</Link>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
