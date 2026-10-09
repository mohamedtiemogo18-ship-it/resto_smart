import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDate, formatDateTime, formatRelative, toApiDate } from '@/lib/format/date'
import { formatMoney, computeChange, formatAmount } from '@/lib/format/money'
import type { DailySales } from '@/types'

export const metadata = { title: 'Rapports' }

async function fetchDaily(token: string, from: string, to: string): Promise<DailySales | null> {
  const params = new URLSearchParams({ from, to })
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/reports/daily?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!res.ok) return null
  const body = await res.json()
  return body.data ?? null
}

export default async function RapportsPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string }
}) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()

  // Par défaut : les 30 derniers jours
  const to = searchParams.to ?? new Date().toISOString().slice(0, 10)
  const from =
    searchParams.from ??
    new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10)

  const data = session ? await fetchDaily(session.access_token, from, to) : null

  const exportUrl = `${process.env.NEXT_PUBLIC_API_URL}/reports/export?type=daily&from=${from}&to=${to}&format=csv`

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Rapports</h1>
          <p className="text-sm text-muted-foreground">
            Chiffre d'affaires, réservations et consommation par journée.
          </p>
        </div>
        <a
          href={exportUrl}
          className="h-10 rounded-md border px-4 text-sm font-medium leading-10 hover:bg-accent"
        >
          Exporter en CSV
        </a>
      </div>

      <form className="flex flex-wrap items-end gap-3" method="get">
        <div className="space-y-1">
          <label htmlFor="from" className="text-xs text-muted-foreground">
            Du
          </label>
          <input
            id="from"
            type="date"
            name="from"
            defaultValue={from}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="to" className="text-xs text-muted-foreground">
            Au
          </label>
          <input
            id="to"
            type="date"
            name="to"
            defaultValue={to}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          />
        </div>
        <button
          type="submit"
          className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Actualiser
        </button>
      </form>

      {data && (
        <div className="grid gap-4 sm:grid-cols-4">
          <TotalCard label="Recette totale" value={formatMoney(data.total_revenue)} />
          <TotalCard label="Réservations payées" value={String(data.total_reservations)} />
          <TotalCard label="Repas vendus" value={String(data.total_meals_sold)} />
          <TotalCard label="Tickets consommés" value={String(data.total_tickets_used)} />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Détail par journée</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {!data || data.days.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Aucune vente sur la période.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/50 text-left">
                  <tr>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 text-right font-medium">Réservations</th>
                    <th className="px-4 py-3 text-right font-medium">Repas vendus</th>
                    <th className="px-4 py-3 text-right font-medium">Tickets consommés</th>
                    <th className="px-4 py-3 text-right font-medium">Recette</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.days.map((row) => (
                    <tr key={row.sale_date} className="hover:bg-muted/30">
                      <td className="px-4 py-3">{formatDate(row.sale_date)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {row.reservations_paid}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{row.meals_sold}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{row.tickets_used}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">
                        {formatMoney(row.revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function TotalCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  )
}
