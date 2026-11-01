'use client'

import { Dialog as RadixDialog } from 'radix-ui'
import type { ReactNode } from 'react'

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: ReactNode
  children: ReactNode
}

export function Dialog({ open, onOpenChange, title, description, children }: DialogProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="overlay-enter fixed inset-0 z-40 bg-black/70" />
        <RadixDialog.Content className="dialog-enter fixed top-1/2 left-1/2 z-50 w-[calc(100vw-32px)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-card border border-border-2 bg-surface p-5">
          <RadixDialog.Title className="text-base font-medium">{title}</RadixDialog.Title>
          <RadixDialog.Description className="mt-2 text-[13px] leading-5 text-muted">
            {description}
          </RadixDialog.Description>
          <div className="mt-5 flex justify-end gap-2">{children}</div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  )
}
