import type { ComponentProps, ReactNode } from 'react'

import { cn } from '@/lib/utils'

export function Card({ className, ...props }: ComponentProps<'section'>) {
  return <section className={cn('min-w-0 rounded-card border border-border bg-surface', className)} {...props} />
}

export function CardHeader({ title, aside }: { title: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex min-h-[47px] items-center justify-between gap-4 border-b border-border px-[18px] py-3">
      <h3 className="shrink-0 text-sm font-medium">{title}</h3>
      {aside && <div className="-my-1 min-w-0 truncate py-1 text-xs text-subtle">{aside}</div>}
    </div>
  )
}

export function CardEmpty({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('grid place-items-center px-6 py-12 text-center text-[13px] text-subtle', className)}>{children}</p>
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mt-1.5 mb-3.5 text-base font-medium">{children}</h2>
}
