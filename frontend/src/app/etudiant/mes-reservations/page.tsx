import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/error-state'
import { Button } from '@/components/ui/button'
import { formatDate, formatDateTime, formatRelative, toApiDate } from '@/lib/format/date'
import { formatMoney, computeChange, formatAmount } from '@/lib/format/money'
import { statusLabel } from '@/lib/format/status'
import type { Reservation } from '@/types'

export const metadata = { title: 'Mes réservations' }

async function fetchReservations(token: string, status?: string) {
  const params = new URLSearchParams({ page_size: '20' })
  if (status) params.set('status', status)

  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/reservations/mine?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!res.ok) return []
  const body = await res.json()
  return (body.data?.items ?? []) as Reservation[]
}

export default async function MesReservationsPage({
  searchParams,
}: {
  searchParams: { status?: string }
}) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const reservations = session ? await fetchReservations(session.access_token, searchParams.status) : []

  const filters = [
    { value: undefined, label: 'Toutes' },
    { value: 'PENDING_PAYMENT', label: 'En attente' },
    { value: 'PAID', label: 'Payées' },
    { value: 'CANCELLED', label: 'Annulées' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mes réservations</h1>
        <p className="text-sm text-muted-foreground">
          Historique de vos demandes de repas.
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {filters.map((f) => {
          const active = (searchParams.status ?? undefined) === f.value
          return (
            <Link
              key={f.label}
              href={f.value ? `/etudiant/mes-reservations?status=${f.value}` : '/etudiant/mes-reservations'}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent'
              }`}
              aria-current={active ? 'true' : undefined}
            >
              {f.label}
            </Link>
          )
        })}
      </div>

      {reservations.length === 0 ? (
        <EmptyState
          title="Aucune réservation"
          description="Vos demandes apparaîtront ici."
          action={
            <Button asChild>
              <Link href="/etudiant/reserver">Réserver</Link>
            </Button>
          }
        />
      ) : (
        <ul className="space-y-3">
          {reservations.map((r) => (
            <li key={r.id}>
              <Link href={`/etudiant/mes-reservations/${r.id}`}>
                <Card className="transition-shadow hover:shadow-md">
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="space-y-1">
                      <p className="font-mono text-sm">{r.reservation_number}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(r.created_at)} · {r.items_count} repas
                      </p>
                      {r.status === 'PAID' && (
                        <p className="text-xs text-muted-foreground">
                          {r.tickets_used} consommés · {r.tickets_pending} en attente
                        </p>
                      )}
                    </div>
                    <div className="text-right space-y-1">
                      <p className="font-semibold tabular-nums">{formatMoney(r.total_amount)}</p>
                      <Badge status={r.status}>{statusLabel(r.status)}</Badge>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
