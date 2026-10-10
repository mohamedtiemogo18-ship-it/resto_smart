import Link from 'next/link'
import { Banknote, Inbox, Receipt, QrCode, Ticket } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import { api } from '@/lib/api-server'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { TableSkeleton } from '@/components/ui/skeleton'
import { PageHeader, StatCard } from '@/components/ui/layout'
import { QueueRow } from '@/components/guichet/queue-row'
import { formatMoney } from '@/lib/format/money'
import { formatRelative } from '@/lib/format/date'
import type { Dashboard } from '@/types'

export const metadata = { title: 'Tableau de bord' }

async function fetchDashboard(token: string) {
  try {
    return await api<Dashboard>('/reports/dashboard', token)
  } catch {
    return null
  }
}

export default async function GuichetDashboardPage() {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const data = session ? await fetchDashboard(session.access_token) : null

  if (!data) {
    return (
      <div className="page">
        <PageHeader title="Tableau de bord" />
        <TableSkeleton rows={4} cols={3} />
      </div>
    )
  }

  return (
    <div className="page">
      <PageHeader
        title="Tableau de bord"
        description="Activité du guichet aujourd'hui."
        actions={
          <>
            <Button asChild>
              <Link href="/guichet/encaisser">
                <Banknote className="h-4 w-4" />
                Encaisser
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/guichet/scanner">
                <QrCode className="h-4 w-4" />
                Scanner
              </Link>
            </Button>
          </>
        }
      />

      <div className="stat-grid">
        <StatCard
          label="Chiffre d'affaires"
          value={formatMoney(data.today_revenue)}
          hint="Encaissé aujourd'hui"
          tone="success"
          icon={<Banknote className="h-4 w-4" />}
        />
        <StatCard
          label="Réservations payées"
          value={data.today_reservations_paid}
          hint="Aujourd'hui"
          icon={<Receipt className="h-4 w-4" />}
        />
        <StatCard
          label="Tickets consommés"
          value={data.today_tickets_used}
          hint="Scannés au restaurant"
          icon={<Ticket className="h-4 w-4" />}
        />
        <StatCard
          label="En attente"
          value={data.pending_payments}
          hint="À encaisser"
          tone={data.pending_payments > 0 ? 'warning' : 'neutral'}
          icon={<Inbox className="h-4 w-4" />}
        />
      </div>

      {/* File d'attente */}
      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">File d'attente</h2>
            {data.queue.length > 0 && (
              <p className="text-sm text-muted-foreground">
                {data.queue.length} réservation{data.queue.length > 1 ? 's' : ''} en
                attente de paiement
              </p>
            )}
          </div>
          {data.queue.length > 0 && (
            <Button asChild variant="ghost" size="sm">
              <Link href="/guichet/encaisser">Ouvrir</Link>
            </Button>
          )}
        </div>

        {data.queue.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-success-muted text-success">
                ✓
              </span>
              <p className="font-medium">File vide</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Aucune réservation en attente. Les nouvelles demandes
                apparaissent ici automatiquement.
              </p>
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-3">
            {data.queue.map((item) => (
              <li key={item.reservation_id} className="animate-in">
                <QueueRow item={item} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Ventes par repas */}
      {data.by_meal.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Ventes du jour par repas</h2>
          <Card>
            <CardContent className="p-0">
              <ul className="divide-y">
                {data.by_meal.map((row) => (
                  <li
                    key={row.meal_type_id}
                    className="flex items-center justify-between gap-4 px-5 py-3.5"
                  >
                    <span className="font-medium">{row.meal}</span>
                    <span className="text-sm tabular-nums text-muted-foreground">
                      {row.meals_ordered} commandés · {row.tickets_used} consommés
                    </span>
                    <span className="font-semibold tabular-nums">
                      {formatMoney(row.revenue)}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>
      )}

      <p className="text-center text-xs text-muted-foreground">
        Dernière mise à jour : il y a{' '}
        {formatRelative(new Date().toISOString()).replace('il y a ', '')}
      </p>
    </div>
  )
}
