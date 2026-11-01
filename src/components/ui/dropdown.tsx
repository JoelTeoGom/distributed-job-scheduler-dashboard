'use client'

import { Ellipsis } from 'lucide-react'
import { DropdownMenu } from 'radix-ui'
import type { ComponentProps, ReactNode } from 'react'

import { Tooltip } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export function ActionsMenu({ label, children, boxed }: { label: string; children: ReactNode; boxed?: boolean }) {
  return (
    <DropdownMenu.Root>
      <Tooltip content={label}>
        <DropdownMenu.Trigger
          aria-label={label}
          className={cn(
            'button-press inline-grid place-items-center text-subtle hover:text-text',
            boxed
              ? 'size-[34px] rounded-control border border-border-2 bg-surface text-text hover:bg-surface-2'
              : 'size-7 rounded-badge',
          )}
        >
          <Ellipsis className="size-4" />
        </DropdownMenu.Trigger>
      </Tooltip>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          className="menu-enter z-50 min-w-44 origin-(--radix-dropdown-menu-content-transform-origin) rounded-control border border-border-2 bg-surface-2 p-1"
        >
          {children}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

interface MenuItemProps extends ComponentProps<typeof DropdownMenu.Item> {
  destructive?: boolean
}

export function MenuItem({ destructive, className, ...props }: MenuItemProps) {
  return (
    <DropdownMenu.Item
      className={cn(
        'flex h-8 items-center gap-2 rounded-badge px-2 text-[13px] outline-none data-disabled:cursor-not-allowed data-disabled:text-subtle data-highlighted:bg-surface-3 [&_svg]:size-3.5',
        destructive ? 'text-red' : 'text-text',
        className,
      )}
      {...props}
    />
  )
}

export function MenuSeparator() {
  return <DropdownMenu.Separator className="my-1 h-px bg-border-2" />
}
