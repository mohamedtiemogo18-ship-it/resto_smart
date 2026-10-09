import type { ReservationStatus, TicketStatus, UserRole } from '@/types'

const STATUS_LABELS: Record<ReservationStatus | TicketStatus, string> = {
  PENDING_PAYMENT: 'En attente de paiement',
  PAID: 'Payée',
  CANCELLED: 'Annulée',
  GENERATED: 'Valide',
  USED: 'Consommé',
  EXPIRED: 'Expiré',
}

export function statusLabel(status: ReservationStatus | TicketStatus): string {
  return STATUS_LABELS[status] ?? status
}

const MEAL_LABELS: Record<string, string> = {
  BREAKFAST: 'Petit-déjeuner',
  LUNCH: 'Déjeuner',
  DINNER: 'Dîner',
}

export function mealLabel(code: string): string {
  return MEAL_LABELS[code] ?? code
}

const ROLE_LABELS: Record<UserRole, string> = {
  student: 'Étudiant',
  logistician: 'Logisticien',
  admin: 'Administrateur',
}

export function roleLabel(role: UserRole): string {
  return ROLE_LABELS[role] ?? role
}

/** Libellés courts pour les onglets de filtre. */
export const TICKET_FILTERS: { value: TicketStatus; label: string }[] = [
  { value: 'GENERATED', label: 'Valides' },
  { value: 'USED', label: 'Consommés' },
  { value: 'EXPIRED', label: 'Expirés' },
]