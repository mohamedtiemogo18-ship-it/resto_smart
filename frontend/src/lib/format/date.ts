import { format, formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'

/** « 09/10/2026 à 09:22 » */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return format(d, 'dd/MM/yyyy à HH:mm', { locale: fr })
}

/** « 09/10/2026 » */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return format(d, 'dd/MM/yyyy', { locale: fr })
}

/** « il y a 6 minutes » */
export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return formatDistanceToNow(d, { addSuffix: true, locale: fr })
}

/** Date pour l'API : YYYY-MM-DD */
export function toApiDate(d: Date): string {
  return format(d, 'yyyy-MM-dd')
}