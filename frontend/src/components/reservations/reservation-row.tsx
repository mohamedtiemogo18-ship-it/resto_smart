import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { formatMoney } from '@/lib/format/money'
import { formatRelative } from '@/lib/format/date'
import { statusLabel } from '@/lib/format/status'
import type { Reservation } from '@/types'

export function ReservationRow({
  reservation,
  href,
  className,
}: {
  reservation: Reservation
  href: string
  className?: string
}) {
  const enAttente = reservation.status === 'PENDING_PAYMENT'

  return (
    <Link
      href={href}
      className={cn(
        'surface group flex items-center gap-4 p-4 transition-shadow hover:shadow-md',
        enAttente && 'border-warning/40',
        className
      )}
    >
      {/* Pastille de statut */}
      <span
        aria-hidden="true"
        className={cn(
          'dot shrink-0',
          enAttente ? 'bg-warning' : reservation.status === 'PAID' ? 'bg-success' : 'bg-muted-foreground/40'
        )}
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-mono text-sm font-medium">
            {reservation.reservation_number}
          </p>
          <Badge status={reservation.status}>{statusLabel(reservation.status)}</Badge>
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {reservation.items_count} repas · il y a{' '}
          {formatRelative(reservation.created_at).replace('il y a ', '')}
        </p>
      </div>

      <div className="shrink-0 text-right">
        <p className="font-semibold tabular-nums">
          {formatMoney(reservation.total_amount)}
        </p>
        {reservation.status === 'PAID' && (
          <p className="text-xs text-muted-foreground">
            {reservation.tickets_pending} à utiliser
          </p>
        )}
      </div>

      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  )
}
