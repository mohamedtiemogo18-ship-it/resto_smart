import { notFound } from 'next/navigation'
import { CalendarClock, CheckCircle2, AlertTriangle } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import { api } from '@/lib/api-server'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert } from '@/components/ui/alert'
import { Section, StatCard } from '@/components/ui/layout'
import { formatMoney } from '@/lib/format/money'
import { formatDateTime } from '@/lib/format/date'
import { statusLabel } from '@/lib/format/status'
import type { Reservation } from '@/types'

export const metadata = { title: 'Détail de la réservation' }

async function fetchReservation(token: string, id: string) {
  try {
    return await api<Reservation>(`/reservations/${id}`, token)
  } catch {
    return null
  }
}

export default async function ReservationDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const reservation = session
    ? await fetchReservation(session.access_token, params.id)
    : null

  if (!reservation) notFound()

  return (
    <div className="page">
      {/* En-tête */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-mono text-xl font-bold sm:text-2xl">
          {reservation.reservation_number}
        </h1>
        <Badge status={reservation.status} dot>
          {statusLabel(reservation.status)}
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground">
        Créée le {formatDateTime(reservation.created_at)}
      </p>

      {reservation.status === 'PENDING_PAYMENT' && (
        <Alert variant="warning" title="En attente de paiement">
          Présentez cette référence au bureau du logisticien pour régler en
          espèces. Les tickets seront générés dès la confirmation.
        </Alert>
      )}

      {reservation.status === 'CANCELLED' && (
        <Alert variant="destructive" title="Réservation annulée">
          {reservation.cancellation_reason
            ? `Motif : ${reservation.cancellation_reason}`
            : 'Cette demande a été annulée.'}
        </Alert>
      )}

      {/* Commande */}
      <Card>
        <CardHeader>
          <CardTitle>Détail de la commande</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {reservation.items.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{item.meal_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.quantity} × {formatMoney(item.unit_price)}
                  </p>
                </div>
                <p className="shrink-0 font-semibold tabular-nums">
                  {formatMoney(item.line_total)}
                </p>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex items-center justify-between border-t pt-4">
            <span className="font-medium">Total</span>
            <span className="text-2xl font-bold tabular-nums">
              {formatMoney(reservation.total_amount)}
            </span>
          </div>

          {reservation.note && (
            <p className="mt-4 rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Note : </span>
              {reservation.note}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Tickets */}
      {reservation.status === 'PAID' && (
        <Section title="Tickets">
          <div className="stat-grid">
            <StatCard
              label="Générés"
              value={reservation.tickets_generated}
              tone="primary"
              icon={<CalendarClock className="h-4 w-4" />}
            />
            <StatCard
              label="Consommés"
              value={reservation.tickets_used}
              tone="neutral"
              icon={<CheckCircle2 className="h-4 w-4" />}
            />
            <StatCard
              label="En attente"
              value={reservation.tickets_pending}
              tone="success"
              icon={<AlertTriangle className="h-4 w-4" />}
            />
          </div>

          <Button asChild variant="outline">
            <a href="/etudiant/mes-tickets">Voir mes tickets</a>
          </Button>
        </Section>
      )}
    </div>
  )
}
