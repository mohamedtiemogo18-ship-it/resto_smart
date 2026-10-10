import Link from 'next/link'

import { createClient } from '@/lib/supabase/server'
import { api } from '@/lib/api-server'
import { Button } from '@/components/ui/button'
import { PageHeader, StatCard } from '@/components/ui/layout'
import { formatMoney } from '@/lib/format/money'
import type { Dashboard } from '@/types'

export const metadata = { title: 'Administration' }

async function fetchDashboard(token: string) {
  try {
    return await api<Dashboard>('/reports/dashboard', token)
  } catch {
    return null
  }
}

const RACCOURCIS = [
  { href: '/admin/utilisateurs', label: 'Gérer les comptes' },
  { href: '/admin/tarifs', label: 'Tarifs' },
  { href: '/admin/reglages', label: 'Signature et cachet' },
  { href: '/admin/rapports', label: 'Rapports' },
  { href: '/admin/audit', label: "Journal d'audit" },
]

export default async function AdminDashboardPage() {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const data = session ? await fetchDashboard(session.access_token) : null

  return (
    <div className="page">
      <PageHeader
        title="Administration"
        description="Vue d'ensemble de la plateforme de restauration universitaire."
      />

      <div className="stat-grid">
        <StatCard
          label="Chiffre d'affaires du jour"
          value={data ? formatMoney(data.today_revenue) : '—'}
          tone="success"
        />
        <StatCard
          label="Réservations encaissées"
          value={data?.today_reservations_paid ?? '—'}
        />
        <StatCard
          label="Tickets consommés"
          value={data?.today_tickets_used ?? '—'}
        />
        <StatCard
          label="Tickets valides"
          value={data?.tickets_pending ?? '—'}
          tone="primary"
          hint="En circulation"
        />
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Raccourcis</h2>
        <div className="flex flex-wrap gap-2">
          {RACCOURCIS.map((r) => (
            <Button key={r.href} asChild variant="outline">
              <Link href={r.href}>{r.label}</Link>
            </Button>
          ))}
        </div>
      </section>
    </div>
  )
}
