import { cn } from '@/lib/utils'
import { HTMLAttributes } from 'react'

/* -------------------------------------------------------------------------- */
/* Squelettes de chargement                                                  */
/* -------------------------------------------------------------------------- */

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-muted', className)}
      aria-hidden="true"
      {...props}
    />
  )
}

export function TicketListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2" aria-busy="true" aria-label="Chargement des tickets">
      {Array.from({ length: count }).map((_, i) => (
        <li key={i} className="surface space-y-4 p-5">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="h-32 w-32 rounded-lg" />
        </li>
      ))}
    </ul>
  )
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="surface overflow-hidden" aria-busy="true" aria-label="Chargement du tableau">
      <div className="border-b bg-muted/40 px-5 py-3">
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="divide-y">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex items-center gap-4 px-5 py-4">
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton
                key={c}
                className={cn('h-4', c === 0 ? 'w-1/4' : 'flex-1')}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export function KpiSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="stat-grid" aria-busy="true" aria-label="Chargement des statistiques">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="surface space-y-3 p-5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-28" />
        </div>
      ))}
    </div>
  )
}
