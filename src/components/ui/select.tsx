'use client'

import { Check, ChevronDown } from 'lucide-react'
import { Select as RadixSelect } from 'radix-ui'

import { DisabledHint } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export interface SelectOption {
  value: string
  label: string
}

interface SelectProps {
  value: string
  onValueChange?: (value: string) => void
  options: readonly SelectOption[]
  label: string
  id?: string
  className?: string
  invalid?: boolean
}

export function Select({ value, onValueChange, options, label, id, className, invalid }: SelectProps) {
  return (
    <RadixSelect.Root value={value} onValueChange={onValueChange}>
      <RadixSelect.Trigger
        id={id}
        aria-label={label}
        aria-invalid={invalid || undefined}
        className={cn('field-control flex items-center justify-between gap-2 text-left', className)}
      >
        <RadixSelect.Value />
        <RadixSelect.Icon>
          <ChevronDown className="size-3.5 text-muted" />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>
      <RadixSelect.Portal>
        <RadixSelect.Content
          position="popper"
          sideOffset={4}
          className="menu-enter z-50 max-h-72 min-w-(--radix-select-trigger-width) overflow-hidden rounded-control border border-border-2 bg-surface-2 p-1"
        >
          <RadixSelect.Viewport>
            {options.map((option) => (
              <RadixSelect.Item
                key={option.value}
                value={option.value}
                className="flex h-8 items-center justify-between gap-3 rounded-badge px-2 text-[13px] outline-none data-highlighted:bg-surface-3"
              >
                <RadixSelect.ItemText>{option.label}</RadixSelect.ItemText>
                <RadixSelect.ItemIndicator>
                  <Check className="size-3.5" />
                </RadixSelect.ItemIndicator>
              </RadixSelect.Item>
            ))}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  )
}

export function PendingSelect({ label, hint }: { label: string; hint: string }) {
  return (
    <DisabledHint hint={hint} className="flex w-full">
      <span className="field-control flex w-full items-center justify-between text-subtle">
        {label}
        <ChevronDown className="size-3.5" aria-hidden />
      </span>
    </DisabledHint>
  )
}
