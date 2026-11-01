import type { ReactNode } from 'react'

import { Tooltip } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface StatCellProps {
  label: string
  value: ReactNode
  caption?: ReactNode
  valueClassName?: string
}

export function StatRow({ children }: { children: ReactNode }) {
  return (
    <div className="mb-7 grid grid-cols-2 rounded-card border border-border bg-surface xl:grid-cols-4 [&>*]:border-border max-xl:[&>*:nth-child(-n+2)]:border-b max-xl:[&>*:nth-child(odd)]:border-r xl:[&>*:not(:last-child)]:border-r">
      {children}
    </div>
  )
}

export function StatCell({ label, value, caption, valueClassName }: StatCellProps) {
  return (
    <div className="min-w-0 px-5 py-[18px]">
      <div className="mb-2.5 text-xs tracking-[0.05em] text-muted uppercase">{label}</div>
      <div className={cn('truncate text-[26px] leading-8 font-medium tracking-[-0.02em] tabular-nums', valueClassName)}>
        {value}
      </div>
      <div className="mt-1.5 min-h-[18px] truncate text-xs text-muted">{caption}</div>
    </div>
  )
}

export function PendingStat({ label, hint = 'Metrics coming soon' }: { label: string; hint?: string }) {
  return (
    <div className="min-w-0 px-5 py-[18px]">
      <div className="mb-2.5 text-xs tracking-[0.05em] text-muted uppercase">{label}</div>
      <Tooltip content={hint}>
        <span tabIndex={0} className="inline-block rounded-sm text-[26px] leading-8 font-medium text-subtle">
          —
        </span>
      </Tooltip>
      <div className="mt-1.5 min-h-[18px]" />
    </div>
  )
}
