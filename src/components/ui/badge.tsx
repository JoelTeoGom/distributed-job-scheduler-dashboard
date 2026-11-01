import type { StatusStyle, Tone } from '@/lib/status'
import { cn } from '@/lib/utils'

export const toneStyles: Record<Tone, string> = {
  green: 'border-green-bd bg-green-bg text-green',
  red: 'border-red-bd bg-red-bg text-red',
  amber: 'border-amber-bd bg-amber-bg text-amber',
  blue: 'border-blue-bd bg-blue-bg text-blue',
  gray: 'border-border-2 bg-gray-bg text-muted',
}

const textTones: Record<Tone, string> = {
  green: 'border-green-bd text-green',
  red: 'border-red-bd text-red',
  amber: 'border-amber-bd text-amber',
  blue: 'border-blue-bd text-blue',
  gray: 'border-border-2 text-muted',
}

export function StatusBadge({ status }: { status: StatusStyle }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-badge border px-2 py-[3px] text-xs font-medium whitespace-nowrap before:size-1.5 before:rounded-full before:bg-current before:content-['']",
        toneStyles[status.tone],
        status.pulsing && 'pulsing-dot',
      )}
    >
      {status.label}
    </span>
  )
}

export function PlainBadge({ status }: { status: StatusStyle }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-badge border px-2 py-[3px] text-xs font-medium whitespace-nowrap',
        toneStyles[status.tone],
      )}
    >
      {status.label}
    </span>
  )
}

export function HttpBadge({ status, children }: { status: StatusStyle; children?: string }) {
  return (
    <span className={cn('rounded-[5px] border px-[7px] py-0.5 font-mono text-xs tabular-nums', textTones[status.tone])}>
      {children ?? status.label}
    </span>
  )
}

export function SoonPill() {
  return (
    <span className="ml-auto rounded-full border border-border-2 px-1.5 text-[10px] leading-4 text-subtle max-lg:hidden">
      Soon
    </span>
  )
}
