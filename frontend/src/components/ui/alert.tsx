import { cn } from '@/lib/utils'
import { HTMLAttributes, ReactNode } from 'react'

/* -------------------------------------------------------------------------- */
/* Alerte                                                                    */
/* -------------------------------------------------------------------------- */

const ALERT_VARIANTS = {
  info: 'border-info/30 bg-info-muted text-info',
  success: 'border-success/30 bg-success-muted text-success',
  warning: 'border-warning/30 bg-warning-muted text-warning',
  destructive: 'border-destructive/30 bg-destructive-muted text-destructive',
  neutral: 'border bg-muted/40 text-foreground',
} as const

const ICONS: Record<string, string> = {
  info: 'ℹ',
  success: '✓',
  warning: '⚠',
  destructive: '✕',
  neutral: '•',
}

export function Alert({
  variant = 'neutral',
  title,
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  variant?: keyof typeof ALERT_VARIANTS
  title?: string
  children?: ReactNode
}) {
  return (
    <div
      role={variant === 'destructive' ? 'alert' : 'status'}
      className={cn(
        'flex gap-3 rounded-lg border p-4 text-sm',
        ALERT_VARIANTS[variant],
        className
      )}
      {...props}
    >
      <span aria-hidden="true" className="mt-px shrink-0 font-semibold">
        {ICONS[variant]}
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className="text-pretty">{children}</div>}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* État vide                                                                */
/* -------------------------------------------------------------------------- */

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-dashed',
        'px-6 py-14 text-center',
        className
      )}
    >
      {icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          {icon}
        </div>
      )}
      <p className="font-medium">{title}</p>
      {description && (
        <p className="mt-1.5 max-w-sm text-pretty text-sm text-muted-foreground">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
