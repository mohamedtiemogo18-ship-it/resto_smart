import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDate, formatDateTime, formatRelative, toApiDate } from '@/lib/format/date'
import { formatMoney, computeChange, formatAmount } from '@/lib/format/money'
import { statusLabel } from '@/lib/format/status'
import type { Reservation } from '@/types'

export const metadata = { title: 'Réservations' }

async function fetchReservations(token: string, params: URLSearchParams) {
  params.set('page_size', '20')
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/reservations?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!res.ok) return { items: [] as Reservation[], pagination: null }
  const body = await res.json()
  return body.data as { items: Reservation[]; pagination: Record<string, number> }
}

export default async function GuichetReservationsPage({
  searchParams,
}: {
  searchParams: { status?: string; page?: string }
}) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()

  const params = new URLSearchParams()
  if (searchParams.status) params.set('status', searchParams.status)
  if (searchParams.page) params.set('page', searchParams.page)

  const data = session ? await fetchReservations(session.access_token, params) : { items: [], pagination: null }

  const filters = [
    { value: undefined, label: 'Toutes' },
    { value: 'PENDING_PAYMENT', label: 'En attente' },
    { value: 'PAID', label: 'Payées' },
    { value: 'CANCELLED', label: 'Annulées' },
  ]

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div>
        <h1 className="text-2xl font-bold">Réservations</h1>
        <p className="text-sm text-muted-foreground">Historique complet des réservations.</p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {filters.map((f) => {
          const active = (searchParams.status ?? undefined) === f.value
          const href = f.value
            ? `/guichet/reservations?status=${f.value}`
            : '/guichet/reservations'
          return (
            <a
              key={f.label}
              href={href}
              aria-current={active ? 'true' : undefined}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                active ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent'
              }`}
            >
              {f.label}
            </a>
          )
        })}
      </div>

      {data.items.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Aucune réservation.</p>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/50 text-left">
                  <tr>
                    <th className="px-4 py-3 font-medium">Numéro</th>
                    <th className="px-4 py-3 font-medium">Étudiant</th>
                    <th className="px-4 py-3 font-medium">Repas</th>
                    <th className="px-4 py-3 text-right font-medium">Montant</th>
                    <th className="px-4 py-3 font-medium">Statut</th>
                    <th className="px-4 py-3 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.items.map((r) => (
                    <tr key={r.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-mono text-xs">{r.reservation_number}</td>
                      <td className="px-4 py-3">
                        {r.student.full_name}
                        {r.student.matricule && (
                          <span className="block text-xs text-muted-foreground">
                            {r.student.matricule}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 tabular-nums">{r.items_count}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatMoney(r.total_amount)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge status={r.status}>{statusLabel(r.status)}</Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {formatDateTime(r.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {data.pagination && data.pagination.pages > 1 && (
        <nav className="flex items-center justify-between text-sm" aria-label="Pagination">
          <span className="text-muted-foreground">
            Page {data.pagination.page} sur {data.pagination.pages}
          </span>
          <div className="flex gap-2">
            {data.pagination.page > 1 && (
              <a
                href={`/guichet/reservations?page=${data.pagination.page - 1}${
                  searchParams.status ? `&status=${searchParams.status}` : ''
                }`}
                className="rounded-md border px-3 py-1.5 hover:bg-accent"
              >
                Précédent
              </a>
            )}
            {data.pagination.page < data.pagination.pages && (
              <a
                href={`/guichet/reservations?page=${data.pagination.page + 1}${
                  searchParams.status ? `&status=${searchParams.status}` : ''
                }`}
                className="rounded-md border px-3 py-1.5 hover:bg-accent"
              >
                Suivant
              </a>
            )}
          </div>
        </nav>
      )}
    </div>
  )
}
