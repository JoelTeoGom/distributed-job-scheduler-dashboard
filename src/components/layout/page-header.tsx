import type { ReactNode } from 'react'

import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface PageHeaderProps {
  icon: ReactNode
  eyebrow: ReactNode
  title: ReactNode
  badge?: ReactNode
  actions?: ReactNode
  titleClassName?: string
}

export function PageHeader({ icon, eyebrow, title, badge, actions, titleClassName }: PageHeaderProps) {
  return (
    <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-[18px]">
        <div className="grid size-16 shrink-0 place-items-center rounded-tile border border-border-2 bg-[radial-gradient(circle_at_50%_30%,#1d1d1d,#0b0b0b)] text-[#cfcfcf] [&_svg]:size-[26px] [&_svg]:stroke-[1.5]">
          {icon}
        </div>
        <div className="min-w-0">
          <div className="mb-1 truncate text-[13px] text-muted">{eyebrow}</div>
          <div className="flex min-w-0 items-center gap-3">
            <h1 className={cn('truncate text-[28px] leading-9 font-semibold tracking-[-0.02em]', titleClassName)}>
              {title}
            </h1>
            {badge}
          </div>
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </header>
  )
}

export function PageHeaderSkeleton({ icon }: { icon: ReactNode }) {
  return (
    <PageHeader icon={icon} eyebrow={<Skeleton className="h-4 w-20" />} title={<Skeleton className="h-8 w-64" />} />
  )
}
