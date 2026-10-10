import { cn } from '@/lib/utils'

/* -------------------------------------------------------------------------- */
/* Carte de statistique                                                      */
/* -------------------------------------------------------------------------- */

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'neutral',
  className,
}: {
  label: string
  value: string | number
  hint?: string
  icon?: React.ReactNode
  tone?: 'neutral' | 'primary' | 'success' | 'warning' | 'destructive' | 'info'
  className?: string
}) {
  const tones = {
    neutral: 'text-muted-foreground bg-muted',
    primary: 'text-primary bg-primary-muted',
    success: 'text-success bg-success-muted',
    warning: 'text-warning bg-warning-muted',
    destructive: 'text-destructive bg-destructive-muted',
    info: 'text-info bg-info-muted',
  }

  return (
    <div className={cn('surface p-5', className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {icon && (
          <span
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
              tones[tone]
            )}
            aria-hidden="true"
          >
            {icon}
          </span>
        )}
      </div>
      <p className="mt-2 text-3xl font-bold tracking-tight tabular-nums">
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* En-tête de page                                                           */
/* -------------------------------------------------------------------------- */

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string
  description?: string
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between',
        className
      )}
    >
      <div className="space-y-1">
        <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
        {description && (
          <p className="max-w-2xl text-pretty text-sm text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Section                                                                   */
/* -------------------------------------------------------------------------- */

export function Section({
  title,
  description,
  action,
  children,
  className,
}: {
  title?: string
  description?: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn('space-y-4', className)}>
      {(title || action) && (
        <div className="flex items-end justify-between gap-3">
          <div>
            {title && <h2 className="text-lg font-semibold">{title}</h2>}
            {description && (
              <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
            )}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}
