import { cn } from '@/lib/utils'
import { InputHTMLAttributes, forwardRef } from 'react'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = 'text', ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        'flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm',
        'shadow-xs transition-colors',
        'placeholder:text-muted-foreground/70',
        'hover:border-muted-foreground/30',
        'focus-visible:border-ring',
        'disabled:cursor-not-allowed disabled:opacity-60 disabled:bg-muted',
        'file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5',
        'file:text-sm file:font-medium file:text-secondary-foreground',
        className
      )}
      {...props}
    />
  )
)
Input.displayName = 'Input'

/* -------------------------------------------------------------------------- */
/* Champ avec libellé                                                        */
/* -------------------------------------------------------------------------- */

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  className,
}: {
  label: string
  hint?: string
  error?: string
  htmlFor?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label
        htmlFor={htmlFor}
        className="block text-sm font-medium leading-none text-foreground"
      >
        {label}
      </label>
      {children}
      {hint && !error && (
        <p className="text-xs text-muted-foreground">{hint}</p>
      )}
      {error && (
        <p className="text-xs font-medium text-destructive">{error}</p>
      )}
    </div>
  )
}
