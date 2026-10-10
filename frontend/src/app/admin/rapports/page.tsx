import { createClient } from '@/lib/supabase/server'
import { api } from '@/lib/api-server'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TableWrapper, THead, TBody, TR, TH, TD } from '@/components/ui/table'
import { PageHeader, StatCard } from '@/components/ui/layout'
import { toApiDate } from '@/lib/format/date'
import { formatMoney } from '@/lib/format/money'
import { formatDate } from '@/lib/format/date'
import type { DailySales } from '@/types'

export const metadata = { title: 'Rapports' }

async function fetchDaily(token: string, from: string, to: string) {
  try {
    return await api<DailySales>(`/reports/daily?from=${from}&to=${to}`, token)
  } catch {
    return null
  }
}

export default async function RapportsPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string }
}) {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const to = searchParams.to ?? toApiDate(new Date())
  const from =
    searchParams.from ?? toApiDate(new Date(Date.now() - 30 * 86_400_000))

  const data = session ? await fetchDaily(session.access_token, from, to) : null
  const exportUrl = `${process.env.NEXT_PUBLIC_API_URL}/reports/export?type=daily&from=${from}&to=${to}&format=csv`

  return (
    <div className="page">
      <PageHeader
        title="Rapports"
        description="Chiffre d'affaires, réservations et consommation par journée."
        actions={
          <Button asChild variant="outline">
            <a href={exportUrl}>Exporter en CSV</a>
          </Button>
        }
      />

      <form className="flex flex-wrap items-end gap-3" method="get">
        <div className="space-y-1.5">
          <label htmlFor="from" className="block text-sm font-medium">
            Du
          </label>
          <input
            id="from"
            type="date"
            name="from"
            defaultValue={from}
            className="h-10 rounded-lg border border-input bg-background px-3 text-sm shadow-xs"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="to" className="block text-sm font-medium">
            Au
          </label>
          <input
            id="to"
            type="date"
            name="to"
            defaultValue={to}
            className="h-10 rounded-lg border border-input bg-background px-3 text-sm shadow-xs"
          />
        </div>
        <button
          type="submit"
          className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs hover:bg-primary/90"
        >
          Actualiser
        </button>
      </form>

      {data && (
        <div className="stat-grid">
          <StatCard
            label="Recette totale"
            value={formatMoney(data.total_revenue)}
            tone="success"
          />
          <StatCard label="Réservations payées" value={data.total_reservations} />
          <StatCard label="Repas vendus" value={data.total_meals_sold} />
          <StatCard label="Tickets consommés" value={data.total_tickets_used} />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Détail par journée</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {!data || data.days.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Aucune vente sur la période sélectionnée.
            </p>
          ) : (
            <TableWrapper>
              <THead>
                <TR>
                  <TH>Date</TH>
                  <TH className="text-right">Réservations</TH>
                  <TH className="text-right">Repas vendus</TH>
                  <TH className="text-right">Consommés</TH>
                  <TH className="text-right">Recette</TH>
                </TR>
              </THead>
              <TBody>
                {data.days.map((row) => (
                  <TR key={row.sale_date}>
                    <TD className="font-medium">{formatDate(row.sale_date)}</TD>
                    <TD className="text-right tabular-nums">
                      {row.reservations_paid}
                    </TD>
                    <TD className="text-right tabular-nums">{row.meals_sold}</TD>
                    <TD className="text-right tabular-nums">{row.tickets_used}</TD>
                    <TD className="text-right font-semibold tabular-nums">
                      {formatMoney(row.revenue)}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </TableWrapper>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
