import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatMoney } from '@/lib/format/money'
import type { QueueItem } from '@/types'

export function QueueRow({ item }: { item: QueueItem }) {
  const urgent = item.waiting_minutes >= 10

  return (
    <Link
      href={`/guichet/encaisser/${item.reservation_id}`}
      className={cn(
        'surface-hover group flex flex-wrap items-center gap-4 p-4',
        urgent && 'animate-attention'
      )}
    >
      {/* Chronomètre */}
      <span
        className={cn(
          'flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg text-xs font-bold tabular-nums',
          urgent
            ? 'bg-warning-muted text-warning'
            : 'bg-secondary text-secondary-foreground'
        )}
      >
        <span>{item.waiting_minutes}</span>
        <span className="text-[9px] font-medium opacity-70">min</span>
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-medium">{item.student_name}</p>
          {item.student_matricule && (
            <Badge variant="outline" className="hidden shrink-0 sm:inline-flex">
              {item.student_matricule}
            </Badge>
          )}
        </div>
        <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
          {item.reservation_number}
          {item.room && ` · Chambre ${item.room}`}
        </p>
      </div>

      <div className="shrink-0 text-right">
        <p className="font-bold tabular-nums">{formatMoney(item.total_amount)}</p>
        <p className="text-xs text-muted-foreground">{item.items_count} repas</p>
      </div>

      <Button size="sm" className="shrink-0">
        Encaisser
      </Button>

      <ChevronRight className="hidden h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 sm:block" />
    </Link>
  )
}
