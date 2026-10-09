import { cn } from '@/lib/utils'
import { HTMLAttributes } from 'react'

const variants = {
  default: 'bg-primary/10 text-primary',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  destructive: 'bg-destructive/10 text-destructive',
  outline: 'border text-foreground',
}

const statusVariants: Record<string, keyof typeof variants> = {
  GENERATED: 'default',
  PENDING_PAYMENT: 'warning',
  PAID: 'success',
  USED: 'success',
  EXPIRED: 'destructive',
  CANCELLED: 'destructive',
}

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: keyof typeof variants
  /** Statut métier : mappe automatiquement vers la bonne couleur */
  status?: string
}

export function Badge({ className, variant, status, children, ...props }: BadgeProps) {
  const resolved = variant ?? statusVariants[status ?? ''] ?? 'default'
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        variants[resolved],
        className
      )}
      {...props}
    >
      {children}
    </span>
  )
}