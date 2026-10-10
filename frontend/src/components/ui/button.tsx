import { ButtonHTMLAttributes, cloneElement, forwardRef, isValidElement } from 'react'

import { cn } from '@/lib/utils'

/* -------------------------------------------------------------------------- */
/* Bouton                                                                    */
/* -------------------------------------------------------------------------- */

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | 'default'
    | 'destructive'
    | 'outline'
    | 'secondary'
    | 'ghost'
    | 'success'
    | 'link'
  size?: 'sm' | 'default' | 'lg' | 'icon' | 'icon-sm'
  loading?: boolean
  /** Rend l'enfant direct (Link, <a>) avec les styles du bouton */
  asChild?: boolean
}

const VARIANTS = {
  default:
    'bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 active:bg-primary/95',
  destructive:
    'bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/90 active:bg-destructive/95',
  success:
    'bg-success text-success-foreground shadow-xs hover:bg-success/90 active:bg-success/95',
  outline:
    'border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/70',
  ghost: 'hover:bg-accent hover:text-accent-foreground',
  link: 'text-primary underline-offset-4 hover:underline',
} as const

const SIZES = {
  sm: 'h-9 gap-1.5 px-3 text-sm',
  default: 'h-10 gap-2 px-4 text-sm',
  lg: 'h-11 gap-2 px-6 text-base',
  icon: 'h-10 w-10',
  'icon-sm': 'h-8 w-8',
} as const

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    variant = 'default',
    size = 'default',
    loading,
    asChild,
    children,
    disabled,
    type = 'button',
    ...props
  },
  ref
) {
  const classes = cn(
    'inline-flex select-none items-center justify-center whitespace-nowrap rounded-lg',
    'font-medium transition-colors duration-150',
    'disabled:pointer-events-none disabled:opacity-55',
    VARIANTS[variant],
    SIZES[size],
    className
  )

  if (asChild && isValidElement(children)) {
    const child = children as React.ReactElement<{ className?: string }>
    return cloneElement(child, {
      className: cn(classes, child.props.className),
    })
  }

  return (
    <button
      ref={ref}
      type={type}
      className={classes}
      disabled={disabled || loading}
      {...props}
    >
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
