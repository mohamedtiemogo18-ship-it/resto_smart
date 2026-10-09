'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type {
  ConfirmPaymentResult,
  ConsumeResult,
  Dashboard,
  Meal,
  Paged,
  Reservation,
  ReservationStatus,
  Ticket,
  TicketStatus,
} from '@/types'

// ---------------------------------------------------------------------------
// Repas et tarifs
// ---------------------------------------------------------------------------

export function useMeals() {
  return useQuery({
    queryKey: ['meals'],
    queryFn: () => api<Meal[]>('/meals'),
    staleTime: 5 * 60_000,
  })
}

// ---------------------------------------------------------------------------
// Réservations
// ---------------------------------------------------------------------------

export interface ReservationFilters {
  status?: ReservationStatus
  number?: string
  matricule?: string
  page?: number
  page_size?: number
}

export function useReservations(filters: ReservationFilters = {}) {
  const params = new URLSearchParams()
  if (filters.status) params.set('status', filters.status)
  if (filters.number) params.set('number', filters.number)
  if (filters.matricule) params.set('matricule', filters.matricule)
  params.set('page', String(filters.page ?? 1))
  params.set('page_size', String(filters.page_size ?? 20))
  const qs = params.toString()

  return useQuery({
    queryKey: ['reservations', filters],
    queryFn: () => api<Paged<Reservation>>(`/reservations?${qs}`),
    staleTime: 15_000,
  })
}

export function useMyReservations(
  filters: { status?: ReservationStatus; page?: number } = {}
) {
  const params = new URLSearchParams()
  if (filters.status) params.set('status', filters.status)
  params.set('page', String(filters.page ?? 1))
  const qs = params.toString()

  return useQuery({
    queryKey: ['reservations', 'mine', filters],
    queryFn: () => api<Paged<Reservation>>(`/reservations/mine?${qs}`),
    staleTime: 15_000,
  })
}

export function useReservation(id: string | undefined) {
  return useQuery({
    queryKey: ['reservations', id],
    queryFn: () => api<Reservation>(`/reservations/${id}`),
    enabled: Boolean(id),
    staleTime: 0,
  })
}

export function useCreateReservation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: {
      items: { meal_type_id: number; quantity: number }[]
      note?: string
    }) => api<Reservation>('/reservations', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reservations'] })
    },
  })
}

export function useCancelReservation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      api<Reservation>(`/reservations/${id}/cancel`, {
        method: 'PATCH',
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reservations'] })
      qc.invalidateQueries({ queryKey: ['tickets'] })
    },
  })
}

// ---------------------------------------------------------------------------
// Paiement
// ---------------------------------------------------------------------------

export function useConfirmPayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      cash_received,
      change_given,
    }: {
      id: string
      cash_received: number
      change_given?: number
    }) =>
      api<ConfirmPaymentResult>(`/reservations/${id}/confirm-payment`, {
        method: 'POST',
        body: JSON.stringify({ cash_received, change_given }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reservations'] })
      qc.invalidateQueries({ queryKey: ['tickets'] })
      qc.invalidateQueries({ queryKey: ['reports'] })
    },
  })
}

// ---------------------------------------------------------------------------
// Tickets
// ---------------------------------------------------------------------------

export function useMyTickets(
  filters: { status?: TicketStatus; reservation_id?: string; page?: number } = {}
) {
  const params = new URLSearchParams()
  if (filters.status) params.set('status', filters.status)
  if (filters.reservation_id) params.set('reservation_id', filters.reservation_id)
  params.set('page', String(filters.page ?? 1))
  const qs = params.toString()

  return useQuery({
    queryKey: ['tickets', 'mine', filters],
    queryFn: () => api<Paged<Ticket>>(`/tickets/mine?${qs}`),
    staleTime: 15_000,
  })
}

export function useConsumeTicket() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { qr_payload?: string; ticket_number?: string }) =>
      api<ConsumeResult>('/tickets/consume', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tickets'] })
    },
  })
}

// ---------------------------------------------------------------------------
// Rapports
// ---------------------------------------------------------------------------

export function useDashboard() {
  return useQuery({
    queryKey: ['reports', 'dashboard'],
    queryFn: () => api<Dashboard>('/reports/dashboard'),
    staleTime: 60_000,
    refetchInterval: 30_000,
  })
}