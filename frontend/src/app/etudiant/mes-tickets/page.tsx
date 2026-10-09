import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/error-state'
import { TicketQr } from '@/components/tickets/ticket-qr'
import { TICKET_FILTERS, statusLabel } from '@/lib/format/status'
import { formatDate } from '@/lib/format/date'
import type { Ticket, TicketStatus } from '@/types'

export const metadata = { title: 'Mes tickets' }

async function fetchTickets(token: string, status?: string) {
  const params = new URLSearchParams({ page_size: '50' })
  if (status) params.set('status', status)

  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/tickets/mine?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!res.ok) return []
  const body = await res.json()
  return (body.data?.items ?? []) as Ticket[]
}

export default async function MesTicketsPage({
  searchParams,
}: {
  searchParams: { status?: string }
}) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const tickets = session
    ? await fetchTickets(session.access_token, searchParams.status)
    : []

  const active = searchParams.status as TicketStatus | undefined

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mes tickets</h1>
        <p className="text-sm text-muted-foreground">
          Téléchargez, imprimez ou présentez le QR au restaurant.
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {[{ value: undefined, label: 'Tous' }, ...TICKET_FILTERS].map((f) => {
          const isActive = active === f.value
          return (
            <Link
              key={f.label}
              href={f.value ? `/etudiant/mes-tickets?status=${f.value}` : '/etudiant/mes-tickets'}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                isActive
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent'
              }`}
              aria-current={isActive ? 'true' : undefined}
            >
              {f.label}
            </Link>
          )
        })}
      </div>

      {tickets.length === 0 ? (
        <EmptyState
          title="Aucun ticket"
          description="Les tickets apparaissent après la confirmation du paiement par le logisticien."
          action={
            <Button asChild>
              <Link href="/etudiant/reserver">Réserver</Link>
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {tickets.map((t) => (
            <li key={t.ticket_number}>
              <Card>
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono text-sm truncate">{t.ticket_number}</p>
                      <p className="text-xs text-muted-foreground">{t.meal_name}</p>
                    </div>
                    <Badge status={t.status}>{statusLabel(t.status)}</Badge>
                  </div>

                  {t.valid_until && (
                    <p className="text-xs text-muted-foreground">
                      Valable jusqu'au {formatDate(t.valid_until)}
                    </p>
                  )}

                  {t.status === 'GENERATED' && t.qr_payload && (
                    <div className="flex justify-center rounded-md border bg-white p-3">
                      <TicketQr payload={t.qr_payload} />
                    </div>
                  )}

                  {t.status === 'USED' && t.used_at && (
                    <p className="text-xs text-muted-foreground">
                      Consommé le {formatDate(t.used_at)}
                    </p>
                  )}

                  {t.pdf_url && (
                    <Button asChild variant="outline" size="sm" className="w-full">
                      <a href={t.pdf_url} target="_blank" rel="noopener noreferrer">
                        Télécharger le PDF
                      </a>
                    </Button>
                  )}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}