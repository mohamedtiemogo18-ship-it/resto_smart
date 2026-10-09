import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDate, formatDateTime, formatRelative, toApiDate } from '@/lib/format/date'
import { formatMoney, computeChange, formatAmount } from '@/lib/format/money'
import { statusLabel } from '@/lib/format/status'
import type { Reservation } from '@/types'

export const metadata = { title: 'Détail de la réservation' }

async function fetchReservation(token: string, id: string): Promise<Reservation | null> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/reservations/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!res.ok) return null
  const body = await res.json()
  return body.data ?? null
}

export default async function ReservationDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const reservation = session ? await fetchReservation(session.access_token, params.id) : null

  if (!reservation) notFound()

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="font-mono text-xl font-bold">{reservation.reservation_number}</h1>
          <Badge status={reservation.status}>{statusLabel(reservation.status)}</Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Créée le {formatDateTime(reservation.created_at)}
        </p>
      </div>

      {reservation.status === 'PENDING_PAYMENT' && (
        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="p-4 text-sm">
            <p className="font-medium">En attente de paiement</p>
            <p className="mt-1 text-muted-foreground">
              Présentez cette référence au bureau du logisticien pour régler en espèces. Les
              tickets seront générés dès la confirmation.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Détail de la commande</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ul className="divide-y">
            {reservation.items.map((item) => (
              <li key={item.id} className="flex items-center justify-between py-2 text-sm">
                <span>
                  {item.meal_name}{' '}
                  <span className="text-muted-foreground">× {item.quantity}</span>
                </span>
                <span className="tabular-nums">{formatMoney(item.line_total)}</span>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between border-t pt-3">
            <span className="font-medium">Total</span>
            <span className="text-lg font-bold tabular-nums">
              {formatMoney(reservation.total_amount)}
            </span>
          </div>
        </CardContent>
      </Card>

      {reservation.status === 'PAID' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tickets</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-3 gap-3 text-center">
              <div>
                <dt className="text-xs text-muted-foreground">Générés</dt>
                <dd className="text-2xl font-bold tabular-nums">{reservation.tickets_generated}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Consommés</dt>
                <dd className="text-2xl font-bold tabular-nums text-success">
                  {reservation.tickets_used}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">En attente</dt>
                <dd className="text-2xl font-bold tabular-nums">{reservation.tickets_pending}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      )}

      {reservation.note && (
        <p className="text-sm text-muted-foreground">Note : {reservation.note}</p>
      )}
    </div>
  )
}
