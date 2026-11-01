'use client'

import { Tooltip as RadixTooltip } from 'radix-ui'
import type { ReactElement, ReactNode } from 'react'

import { cn } from '@/lib/utils'

export function TooltipProvider({ children }: { children: ReactNode }) {
  return (
    <RadixTooltip.Provider delayDuration={400} skipDelayDuration={300}>
      {children}
    </RadixTooltip.Provider>
  )
}

export function Tooltip({ content, children }: { content: ReactNode; children: ReactElement }) {
  return (
    <RadixTooltip.Root>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          sideOffset={6}
          className="menu-enter z-50 max-w-72 rounded-badge border border-border-2 bg-surface-2 px-2 py-1 text-xs text-text"
        >
          {content}
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  )
}

// Disabled controls fire no pointer events, so the tooltip hangs from a focusable wrapper.
export function DisabledHint({ hint, className, children }: { hint: string; className?: string; children: ReactNode }) {
  return (
    <Tooltip content={hint}>
      <span tabIndex={0} className={cn('inline-flex rounded-control', className)}>
        {children}
      </span>
    </Tooltip>
  )
}
