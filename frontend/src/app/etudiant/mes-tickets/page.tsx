import Link from 'next/link'

import { createClient } from '@/lib/supabase/server'
import { api } from '@/lib/api-server'
import { TicketQr } from '@/components/tickets/ticket-qr'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/alert'
import { PageHeader, Section } from '@/components/ui/layout'
import { formatDate } from '@/lib/format/date'
import { statusLabel, TICKET_FILTERS } from '@/lib/format/status'
import type { Paged, Ticket, TicketStatus } from '@/types'

export const metadata = { title: 'Mes tickets' }

async function fetchTickets(token: string, status?: string) {
  const params = new URLSearchParams({ page_size: '50' })
  if (status) params.set('status', status)

  try {
    return await api<Paged<Ticket>>(`/tickets/mine?${params}`, token)
  } catch {
    return null
  }
}

export default async function MesTicketsPage({
  searchParams,
}: {
  searchParams: { status?: string }
}) {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const actif = (searchParams.status ?? '') as TicketStatus | ''
  const page = session ? await fetchTickets(session.access_token, actif) : null
  const tickets = page?.items ?? []

  return (
    <div className="page">
      <PageHeader
        title="Mes tickets"
        description="Téléchargez, imprimez ou présentez le QR code au restaurant."
      />

      <nav aria-label="Filtrer par statut" className="flex flex-wrap gap-2">
        {[{ value: '', label: 'Tous' }, ...TICKET_FILTERS].map((f) => {
          const isActive = f.value === actif
          const href = f.value
            ? `/etudiant/mes-tickets?status=${f.value}`
            : '/etudiant/mes-tickets'

          return (
            <Link
              key={f.label}
              href={href}
              aria-current={isActive ? 'page' : undefined}
              className={
                isActive
                  ? 'rounded-full bg-primary px-3.5 py-1.5 text-xs font-medium text-primary-foreground'
                  : 'rounded-full border px-3.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground'
              }
            >
              {f.label}
            </Link>
          )
        })}
      </nav>

      <Section>
        {tickets.length === 0 ? (
          <EmptyState
            icon={<span aria-hidden="true">🎫</span>}
            title="Aucun ticket"
            description="Les tickets apparaissent après la confirmation du paiement par le logisticien."
            action={
              <Button asChild>
                <Link href="/etudiant/reserver">Réserver</Link>
              </Button>
            }
          />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {tickets.map((ticket) => (
              <li key={ticket.ticket_number} className="animate-in">
                <TicketCard ticket={ticket} />
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  )
}

function TicketCard({ ticket }: { ticket: Ticket }) {
  const utilisable = ticket.status === 'GENERATED'

  return (
    <Card className={utilisable ? 'overflow-hidden' : ''}>
      {/* Filet coloré selon le statut */}
      <div
        aria-hidden="true"
        className={
          utilisable
            ? 'h-1 bg-success'
            : ticket.status === 'USED'
              ? 'h-1 bg-muted-foreground/30'
              : 'h-1 bg-destructive/50'
        }
      />

      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-mono text-sm font-semibold">
              {ticket.ticket_number}
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">{ticket.meal_name}</p>
          </div>
          <Badge status={ticket.status} dot>
            {statusLabel(ticket.status)}
          </Badge>
        </div>

        {utilisable && (
          <div className="flex justify-center rounded-lg border bg-white p-4">
            <TicketQr payload={ticket.qr_payload!} size={168} />
          </div>
        )}

        {ticket.valid_until && (
          <p className="text-xs text-muted-foreground">
            {utilisable ? 'Valable jusqu au ' : 'Valait jusqu au '}
            <span className="font-medium text-foreground">
              {formatDate(ticket.valid_until)}
            </span>
          </p>
        )}

        {ticket.status === 'USED' && ticket.used_at && (
          <p className="text-xs text-muted-foreground">
            Consommé le {formatDate(ticket.used_at)}
          </p>
        )}

        {ticket.pdf_url && (
          <Button asChild variant="outline" size="sm" className="w-full">
            <a href={ticket.pdf_url} target="_blank" rel="noopener noreferrer">
              Télécharger le PDF
            </a>
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
