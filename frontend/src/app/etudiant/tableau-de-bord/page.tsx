import Link from 'next/link'
import { CalendarPlus, Receipt, Ticket } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import { api } from '@/lib/api-server'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/alert'
import { PageHeader, Section, StatCard } from '@/components/ui/layout'
import { ReservationRow } from '@/components/reservations/reservation-row'
import type { Paged, Reservation } from '@/types'

export const metadata = { title: 'Mon espace' }

async function fetchReservations(token: string) {
  try {
    return await api<Paged<Reservation>>(
      `/reservations/mine?page_size=5`,
      token
    )
  } catch {
    return null
  }
}

export default async function EtudiantDashboardPage() {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const page = session ? await fetchReservations(session.access_token) : null
  const reservations = page?.items ?? []

  const enAttente = reservations.filter(
    (r) => r.status === 'PENDING_PAYMENT'
  ).length
  const ticketsValides = reservations
    .filter((r) => r.status === 'PAID')
    .reduce((sum, r) => sum + r.tickets_pending, 0)

  return (
    <div className="page">
      <PageHeader
        title="Mon espace"
        description="Réservez vos repas, suivez vos tickets et retrouvez votre historique."
        actions={
          <Button asChild>
            <Link href="/etudiant/reserver">
              <CalendarPlus className="h-4 w-4" />
              Réserver
            </Link>
          </Button>
        }
      />

      {/* Statistiques */}
      <div className="stat-grid">
        <StatCard
          label="Réservations"
          value={reservations.length}
          hint="Demandes enregistrées"
          icon={<Receipt className="h-4 w-4" />}
        />
        <StatCard
          label="En attente de paiement"
          value={enAttente}
          hint="À régler au guichet"
          tone={enAttente > 0 ? 'warning' : 'neutral'}
          icon={<Ticket className="h-4 w-4" />}
        />
        <StatCard
          label="Tickets valides"
          value={ticketsValides}
          hint="Prêts à être utilisés"
          tone="success"
          icon={<Ticket className="h-4 w-4" />}
        />
      </div>

      {/* Dernières réservations */}
      <Section
        title="Réservations récentes"
        description={reservations.length ? undefined : 'Vos demandes apparaîtront ici.'}
        action={
          reservations.length > 0 ? (
            <Button asChild variant="ghost" size="sm">
              <Link href="/etudiant/mes-reservations">Tout voir</Link>
            </Button>
          ) : undefined
        }
      >
        {reservations.length === 0 ? (
          <EmptyState
            icon={<CalendarPlus className="h-5 w-5" />}
            title="Aucune réservation"
            description="Préparez votre demande en ligne, puis réglez en espèces au bureau du logisticien. Les tickets seront générés immédiatement après."
            action={
              <Button asChild>
                <Link href="/etudiant/reserver">Faire une demande</Link>
              </Button>
            }
          />
        ) : (
          <ul className="space-y-3">
            {reservations.map((reservation) => (
              <li key={reservation.id} className="animate-in">
                <ReservationRow
                  reservation={reservation}
                  href={`/etudiant/mes-reservations/${reservation.id}`}
                />
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  )
}
