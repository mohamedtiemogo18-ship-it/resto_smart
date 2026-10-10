import { cn } from '@/lib/utils'
import { HTMLAttributes } from 'react'

/* -------------------------------------------------------------------------- */
/* Badge                                                                     */
/* -------------------------------------------------------------------------- */

const VARIANTS = {
  default: 'bg-secondary text-secondary-foreground',
  primary: 'bg-primary-muted text-primary',
  success: 'bg-success-muted text-success',
  warning: 'bg-warning-muted text-warning',
  destructive: 'bg-destructive-muted text-destructive',
  info: 'bg-info-muted text-info',
  outline: 'border bg-transparent text-foreground',
} as const

/** Statut métier → variante visuelle */
const STATUS_VARIANTS: Record<string, keyof typeof VARIANTS> = {
  GENERATED: 'success',
  PENDING_PAYMENT: 'warning',
  PAID: 'success',
  USED: 'default',
  EXPIRED: 'destructive',
  CANCELLED: 'destructive',
}

const DOT_COLORS: Record<string, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  destructive: 'bg-destructive',
  info: 'bg-info',
  primary: 'bg-primary',
  default: 'bg-muted-foreground',
}

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: keyof typeof VARIANTS
  /** Statut métier : mappe automatiquement vers la bonne couleur */
  status?: string
  /** Affiche une puce de couleur à gauche */
  dot?: boolean
}

export function Badge({
  className,
  variant,
  status,
  dot = false,
  children,
  ...props
}: BadgeProps) {
  const resolved = variant ?? (status ? STATUS_VARIANTS[status] : undefined) ?? 'default'

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5',
        'text-xs font-medium leading-5 whitespace-nowrap',
        VARIANTS[resolved],
        className
      )}
      {...props}
    >
      {dot && (
        <span
          className={cn('dot', DOT_COLORS[resolved])}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  )
}

/* -------------------------------------------------------------------------- */
/* Rôle                                                                     */
/* -------------------------------------------------------------------------- */

const ROLE_LABELS: Record<string, string> = {
  student: 'Étudiant',
  logisticien: 'Logisticien',
  admin: 'Administrateur',
}

export function RoleBadge({
  role,
  className,
}: {
  role: 'student' | 'logistician' | 'admin'
  className?: string
}) {
  return (
    <Badge variant="outline" className={className}>
      {ROLE_LABELS[role] ?? role}
    </Badge>
  )
}

/* -------------------------------------------------------------------------- */
/* Avatar                                                                    */
/* -------------------------------------------------------------------------- */

export function Avatar({
  name,
  className,
  size = 'md',
}: {
  name: string
  className?: string
  size?: 'sm' | 'md' | 'lg'
}) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')

  const sizes = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-14 w-14 text-base',
  }

  // Couleur déterministe dérivée du nom : stable entre les rendus
  const hue = [...name].reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % 360

  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white',
        sizes[size],
        className
      )}
      style={{ backgroundColor: `hsl(${hue} 55% 45%)` }}
    >
      {initials}
    </span>
  )
}
