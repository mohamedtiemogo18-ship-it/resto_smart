import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { formatDate, formatDateTime, formatRelative, toApiDate } from '@/lib/format/date'
import { formatMoney, computeChange, formatAmount } from '@/lib/format/money'
import type { Dashboard } from '@/types'

export const metadata = { title: 'Administration' }

async function fetchDashboard(token: string): Promise<Dashboard | null> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/reports/dashboard`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!res.ok) return null
  const body = await res.json()
  return body.data ?? null
}

export default async function AdminDashboardPage() {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const data = await fetchDashboard(session.access_token)

  const kpis = [
    { label: "Chiffre d'affaires du jour", value: data ? formatMoney(data.today_revenue) : '—' },
    { label: 'Réservations encaissées', value: data?.today_reservations_paid ?? '—' },
    { label: 'Tickets consommés', value: data?.today_tickets_used ?? '—' },
    { label: 'Tickets valides en circulation', value: data?.tickets_pending ?? '—' },
    { label: 'Tickets expirés', value: data?.tickets_expired ?? '—' },
  ]

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div>
        <h1 className="text-2xl font-bold">Administration</h1>
        <p className="text-sm text-muted-foreground">
          Vue d'ensemble de la plateforme.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Raccourcis</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/admin/utilisateurs">Gérer les comptes</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/tarifs">Tarifs</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/reglages">Signature et cachet</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/rapports">Rapports</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/audit">Journal d'audit</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
