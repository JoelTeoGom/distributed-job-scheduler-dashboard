'use client'

import { Tooltip } from '@/components/ui/tooltip'
import { useNow } from '@/components/ui/use-now'
import { formatDateTime, formatRelative, formatUtc } from '@/lib/format'
import { cn } from '@/lib/utils'

interface TimeProps {
  value: string | undefined
  withSeconds?: boolean
  className?: string
}

function EmptyTime({ className }: { className?: string }) {
  return <span className={cn('text-subtle', className)}>—</span>
}

export function RelativeTime({ value, className }: TimeProps) {
  const now = useNow()
  if (!value) return <EmptyTime className={className} />

  return (
    <Tooltip content={formatUtc(value)}>
      <time dateTime={value} className={cn('tabular-nums', className)}>
        {now === 0 ? '\u00a0' : formatRelative(value, now)}
      </time>
    </Tooltip>
  )
}

export function AbsoluteTime({ value, withSeconds, className }: TimeProps) {
  const now = useNow()
  if (!value) return <EmptyTime className={className} />

  return (
    <Tooltip content={formatUtc(value)}>
      <time dateTime={value} className={cn('tabular-nums', className)}>
        {now === 0 ? '\u00a0' : formatDateTime(value, withSeconds)}
      </time>
    </Tooltip>
  )
}
