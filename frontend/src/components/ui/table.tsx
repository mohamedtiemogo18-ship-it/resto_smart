import { cn } from '@/lib/utils'
import { HTMLAttributes, ThHTMLAttributes, TdHTMLAttributes } from 'react'

/* -------------------------------------------------------------------------- */
/* Tableau de données                                                        */
/* -------------------------------------------------------------------------- */

export function TableWrapper({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('surface overflow-hidden', className)} {...props}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-sm">{children}</table>
      </div>
    </div>
  )
}

export function THead({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn('border-b bg-muted/40 text-left', className)}
      {...props}
    />
  )
}

export function TBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn('divide-y', className)} {...props} />
}

export function TR({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn('transition-colors hover:bg-muted/30', className)}
      {...props}
    />
  )
}

export function TH({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        'px-5 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground',
        className
      )}
      {...props}
    />
  )
}

export function TD({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('px-5 py-3.5 align-middle', className)} {...props} />
}

/* -------------------------------------------------------------------------- */
/* Onglets                                                                   */
/* -------------------------------------------------------------------------- */

export function Tabs<T extends string>({
  options,
  value,
  onChange,
  className,
  label,
}: {
  options: { value: T; label: string; count?: number }[]
  value: T
  onChange: (value: T) => void
  className?: string
  label?: string
}) {
  return (
    <div
      role="tablist"
      aria-label={label ?? 'Filtres'}
      className={cn('flex gap-1 overflow-x-auto rounded-lg border bg-muted/40 p-1', className)}
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'flex shrink-0 items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium',
              'transition-colors whitespace-nowrap',
              active
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {option.label}
            {option.count !== undefined && (
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums',
                  active ? 'bg-primary-muted text-primary' : 'bg-muted text-muted-foreground'
                )}
              >
                {option.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
