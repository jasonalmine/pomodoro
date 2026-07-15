import { forwardRef, type ButtonHTMLAttributes } from 'react'
import clsx from 'clsx'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const variants: Record<Variant, string> = {
  // Ink text on the pastel fill keeps every palette legible; hover darkens the
  // fill via a brightness filter rather than swapping to a tone that would need
  // white text.
  primary: 'bg-accent text-ink-900 hover:brightness-[0.96] active:brightness-95 shadow-sm shadow-accent/30 hover:shadow-md hover:shadow-accent/40',
  secondary: 'bg-ink-100 hover:bg-ink-200 text-ink-800 dark:bg-ink-800 dark:hover:bg-ink-700 dark:text-ink-100',
  ghost: 'bg-transparent hover:bg-ink-100 text-ink-700 dark:hover:bg-ink-800 dark:text-ink-200',
  danger: 'bg-rose-500 hover:bg-rose-600 text-white',
}

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }

export const Button = forwardRef<HTMLButtonElement, Props>(
  ({ variant = 'primary', size = 'md', className, ...rest }, ref) => (
    <button
      ref={ref}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-full font-medium transition-all',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    />
  ),
)
Button.displayName = 'Button'
