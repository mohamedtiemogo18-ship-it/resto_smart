import Link from 'next/link'

import { createClient } from '@/lib/supabase/server'
import { api } from '@/lib/api-server'
import { EmptyState } from '@/components/ui/alert'
import { PageHeader, Section } from '@/components/ui/layout'
import { ReservationRow } from '@/components/reservations/reservation-row'
import type { Paged, Reservation, ReservationStatus } from '@/types'

export const metadata = { title: 'Mes réservations' }

const FILTERS: { value: ReservationStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'Toutes' },
  { value: 'PENDING_PAYMENT', label: 'En attente' },
  { value: 'PAID', label: 'Payées' },
  { value: 'CANCELLED', label: 'Annulées' },
]

async function fetchReservations(token: string, status?: string) {
  const params = new URLSearchParams({ page_size: '50' })
  if (status && status !== 'ALL') params.set('status', status)

  try {
    return await api<Paged<Reservation>>(`/reservations/mine?${params}`, token)
  } catch {
    return null
  }
}

export default async function MesReservationsPage({
  searchParams,
}: {
  searchParams: { status?: string }
}) {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const actif = (searchParams.status ?? 'ALL') as ReservationStatus | 'ALL'
  const page = session ? await fetchReservations(session.access_token, actif) : null
  const reservations = page?.items ?? []

  return (
    <div className="page">
      <PageHeader
        title="Mes réservations"
        description="Historique complet de vos demandes de repas."
      />

      {/* Filtres sous forme de liens — fonctionnent sans JavaScript */}
      <nav aria-label="Filtrer par statut" className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const isActive = f.value === actif
          return (
            <Link
              key={f.value}
              href={
                f.value === 'ALL'
                  ? '/etudiant/mes-reservations'
                  : `/etudiant/mes-reservations?status=${f.value}`
              }
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
        {reservations.length === 0 ? (
          <EmptyState
            title="Aucune réservation"
            description={
              actif === 'ALL'
                ? 'Vos demandes apparaîtront ici dès que vous en aurez fait une.'
                : 'Aucune réservation ne correspond à ce filtre.'
            }
            action={
              <ButtonLink href="/etudiant/reserver">Réserver</ButtonLink>
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

function ButtonLink({
  href,
  children,
}: {
  href: string
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs transition-colors hover:bg-primary/90"
    >
      {children}
    </Link>
  )
}
