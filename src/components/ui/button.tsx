import { Slot } from 'radix-ui'
import { cva, type VariantProps } from 'class-variance-authority'
import { LoaderCircle } from 'lucide-react'
import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

const buttonStyles = cva(
  'button-press inline-flex h-[34px] shrink-0 items-center justify-center gap-2 rounded-control border px-3.5 text-[13px] font-medium whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-45 [&_svg]:size-3.5',
  {
    variants: {
      variant: {
        secondary: 'border-border-2 bg-surface text-text hover:enabled:bg-surface-2 [a&]:hover:bg-surface-2',
        primary: 'border-text bg-text text-black hover:enabled:bg-white [a&]:hover:bg-white',
        danger: 'border-red-bd bg-red-bg text-red',
      },
      size: {
        default: '',
        icon: 'w-[34px] px-0',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'default' },
  },
)

interface ButtonProps extends ComponentProps<'button'>, VariantProps<typeof buttonStyles> {
  asChild?: boolean
  loading?: boolean
}

export function Button({ asChild, loading, variant, size, className, children, disabled, ...props }: ButtonProps) {
  if (asChild) {
    return (
      <Slot.Root className={cn(buttonStyles({ variant, size }), className)} {...props}>
        {children}
      </Slot.Root>
    )
  }

  return (
    <button
      type="button"
      className={cn(buttonStyles({ variant, size }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <LoaderCircle className="animate-spin" aria-hidden />}
      {children}
    </button>
  )
}
