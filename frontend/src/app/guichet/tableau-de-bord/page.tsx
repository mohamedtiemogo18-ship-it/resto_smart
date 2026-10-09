import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { formatDate, formatDateTime, formatRelative, toApiDate } from '@/lib/format/date'
import { formatMoney, computeChange, formatAmount } from '@/lib/format/money'
import type { Dashboard } from '@/types'

export const metadata = { title: 'Tableau de bord' }

async function fetchDashboard(token: string): Promise<Dashboard | null> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/reports/dashboard`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!res.ok) return null
  const body = await res.json()
  return body.data ?? null
}

export default async function GuichetDashboardPage() {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const data = session ? await fetchDashboard(session.access_token) : null

  const kpis = [
    { label: "Chiffre d'affaires du jour", value: data ? formatMoney(data.today_revenue) : '—' },
    { label: 'Réservations encaissées', value: data?.today_reservations_paid ?? '—' },
    { label: 'Tickets consommés', value: data?.today_tickets_used ?? '—' },
    { label: 'En attente de paiement', value: data?.pending_payments ?? '—' },
  ]

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Tableau de bord</h1>
          <p className="text-sm text-muted-foreground">Activité du jour au guichet.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link href="/guichet/encaisser">Encaisser</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/guichet/scanner">Scanner</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {kpi.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold tabular-nums">{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* File d'attente */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">File d'attente</CardTitle>
          {data && data.pending_payments > 0 && (
            <Badge variant="warning">{data.pending_payments} en attente</Badge>
          )}
        </CardHeader>
        <CardContent>
          {!data || data.queue.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Aucune réservation en attente.
            </p>
          ) : (
            <ul className="divide-y">
              {data.queue.map((item) => (
                <li key={item.reservation_id} className="flex items-center justify-between py-3">
                  <div className="min-w-0 space-y-0.5">
                    <p className="truncate text-sm font-medium">{item.student_name}</p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {item.reservation_number}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums">
                        {formatMoney(item.total_amount)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.items_count} repas · {item.waiting_minutes} min
                      </p>
                    </div>
                    <Button asChild size="sm">
                      <Link href={`/guichet/encaisser/${item.reservation_id}`}>Encaisser</Link>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Répartition par repas */}
      {data && data.by_meal.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ventes du jour par repas</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {data.by_meal.map((row) => (
                <li key={row.meal_type_id} className="flex items-center justify-between py-2 text-sm">
                  <span>{row.meal}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {row.meals_ordered} commandés · {row.tickets_used} consommés
                  </span>
                  <span className="font-semibold tabular-nums">{formatMoney(row.revenue)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
