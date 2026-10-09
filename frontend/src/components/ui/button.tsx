import { ButtonHTMLAttributes, cloneElement, forwardRef, isValidElement } from 'react'

import { cn } from '@/lib/utils'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost'
  size?: 'sm' | 'default' | 'lg' | 'icon'
  loading?: boolean
  /**
   * Rend l'enfant direct (un `Link` ou un `<a>`) avec les styles du bouton,
   * au lieu d'un `<button>`. Évite un bouton dans un lien.
   */
  asChild?: boolean
}

const VARIANTS = {
  default: 'bg-primary text-primary-foreground hover:bg-primary/90',
  destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
  outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
  ghost: 'hover:bg-accent hover:text-accent-foreground',
} as const

const SIZES = {
  sm: 'h-9 px-3 text-xs',
  default: 'h-10 px-4 text-sm',
  lg: 'h-11 px-8 text-base',
  icon: 'h-10 w-10',
} as const

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'default', size = 'default', loading, asChild, children, disabled, ...props },
  ref
) {
  const classes = cn(
    'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    'disabled:pointer-events-none disabled:opacity-50',
    VARIANTS[variant],
    SIZES[size],
    className
  )

  // asChild : on clone l'enfant en lui appliquant nos classes
  if (asChild && isValidElement(children)) {
    const child = children as React.ReactElement<{ className?: string }>
    return cloneElement(child, {
      className: cn(classes, child.props.className),
    })
  }

  return (
    <button ref={ref} className={classes} disabled={disabled || loading} {...props}>
      {loading && (
        <span
          aria-hidden="true"
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  )
})