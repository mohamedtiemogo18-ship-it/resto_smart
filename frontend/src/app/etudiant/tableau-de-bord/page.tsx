import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/error-state'
import { formatDate, formatDateTime, formatRelative, toApiDate } from '@/lib/format/date'
import { formatMoney, computeChange, formatAmount } from '@/lib/format/money'
import { statusLabel } from '@/lib/format/status'
import type { Reservation } from '@/types'

export const metadata = { title: 'Mon espace' }

export default async function EtudiantDashboard() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Session serveur -> jeton transmis au backend via le cookie
  const { data: { session } } = await supabase.auth.getSession()

  let reservations: Reservation[] = []
  let pendingTickets = 0

  if (session) {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/reservations/mine?page_size=5`,
        {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: 'no-store',
        }
      )
      if (res.ok) {
        const body = await res.json()
        reservations = body.data?.items ?? []
      }
    } catch {
      // Le rendu ne doit jamais échouer : on affiche l'état vide
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mon espace</h1>
        <p className="text-sm text-muted-foreground">
          Réservez vos repas et consultez vos tickets.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Réservations récentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums">{reservations.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Tickets en attente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums">{pendingTickets}</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Mes réservations</h2>
          <Button asChild size="sm">
            <Link href="/etudiant/reserver">Nouvelle réservation</Link>
          </Button>
        </div>

        {reservations.length === 0 ? (
          <EmptyState
            title="Aucune réservation"
            description="Préparez votre demande en ligne, puis réglez au bureau du logisticien."
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
                      </div>
                      <div className="text-right space-y-1">
                        <p className="font-semibold tabular-nums">
                          {formatMoney(r.total_amount)}
                        </p>
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
    </div>
  )
}
