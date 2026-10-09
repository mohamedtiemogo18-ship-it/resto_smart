/** Types partagés, miroir des schémas Pydantic du backend. */

export type UserRole = 'student' | 'logistician' | 'admin'

export interface Profile {
  id: string
  matricule: string | null
  full_name: string
  phone: string | null
  room: string | null
  role: UserRole
  is_active: boolean
  created_at: string
}

export type MealSlot = 'BREAKFAST' | 'LUNCH' | 'DINNER'

export interface Price {
  id: string
  amount: string
  currency: string
  effective_from: string
  effective_to: string | null
  is_current: boolean
}

export interface Meal {
  id: number
  code: MealSlot
  name: string
  description: string | null
  display_order: number
  is_active: boolean
  price: Price | null
}

export type ReservationStatus = 'PENDING_PAYMENT' | 'PAID' | 'CANCELLED'

export interface ReservationItem {
  id: string
  meal_type_id: number
  meal_name: string
  quantity: number
  unit_price: string
  line_total: string
}

export interface Reservation {
  id: string
  reservation_number: string
  status: ReservationStatus
  student: {
    id: string
    matricule: string | null
    full_name: string
    room: string | null
  }
  items_count: number
  total_amount: string
  currency: string
  items: ReservationItem[]
  note: string | null
  created_at: string
  paid_at: string | null
  paid_by: string | null
  cancelled_at: string | null
  cancellation_reason: string | null
  tickets_generated: number
  tickets_used: number
  tickets_pending: number
  waiting_minutes: number | null
}

export type TicketStatus = 'GENERATED' | 'USED' | 'EXPIRED'

export interface Ticket {
  ticket_number: string
  status: TicketStatus
  meal_type_id: number
  meal_name: string
  reservation_number: string
  student_id: string
  student_name: string | null
  student_matricule: string | null
  valid_until: string | null
  used_at: string | null
  used_by: string | null
  qr_payload: string | null
  pdf_url: string | null
}

export interface ConsumeResult {
  ticket_number: string
  status: TicketStatus
  used_at: string
  meal_name: string
  student_name: string
  student_matricule: string | null
  consumed_by: string
}

export interface ConfirmPaymentResult {
  reservation_id: string
  reservation_number: string
  status: string
  already_confirmed: boolean
  total_amount: string
  currency: string
  paid_at: string | null
  ticket_count: number
  tickets: Ticket[]
  sheet_pdf_url: string | null
  cash_received: string | null
  change_given: string | null
}

export interface Pagination {
  page: number
  page_size: number
  total: number
  pages: number
}

export interface Paged<T> {
  items: T[]
  pagination: Pagination
}

export interface Dashboard {
  today_revenue: string
  today_reservations_paid: number
  today_meals_sold: number
  today_tickets_used: number
  tickets_pending: number
  tickets_expired: number
  pending_payments: number
  by_meal: MealSalesRow[]
  queue: QueueItem[]
}

export interface MealSalesRow {
  meal_type_id: number
  meal: string
  meals_ordered: number
  tickets_used: number
  revenue: string
}

export interface QueueItem {
  reservation_id: string
  reservation_number: string
  student_name: string
  student_matricule: string | null
  room: string | null
  items_count: number
  total_amount: string
  waiting_minutes: number
}

export interface DailySalesRow {
  sale_date: string
  reservations_paid: number
  revenue: string
  meals_sold: number
  tickets_used: number
}

export interface DailySales {
  from_date: string
  to_date: string
  days: DailySalesRow[]
  total_revenue: string
  total_reservations: number
  total_meals_sold: number
  total_tickets_used: number
}

export interface AuditLogEntry {
  id: number
  actor_id: string | null
  actor_label: string | null
  actor_name: string | null
  action: string
  entity_type: string | null
  entity_id: string | null
  outcome: string
  metadata: Record<string, unknown> | null
  ip: string | null
  created_at: string
}

export interface AppUser {
  id: string
  email: string | null
  matricule: string | null
  full_name: string
  phone: string | null
  room: string | null
  role: UserRole
  is_active: boolean
  created_at: string
}

export interface Setting {
  key: string
  value: Record<string, unknown>
}