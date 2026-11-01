'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ComponentProps, MouseEvent, ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="relative overflow-x-auto rounded-card border border-border">
      <table className="w-full border-collapse">{children}</table>
    </div>
  )
}

export function TableHead({ className, ...props }: ComponentProps<'th'>) {
  return (
    <th
      scope="col"
      className={cn(
        'border-b border-border bg-surface px-4 py-[11px] text-left text-[13px] font-medium whitespace-nowrap text-muted',
        className,
      )}
      {...props}
    />
  )
}

export function TableCell({ className, ...props }: ComponentProps<'td'>) {
  return (
    <td
      className={cn('border-b border-border px-4 py-3.5 align-middle [tr:last-child>&]:border-b-0', className)}
      {...props}
    />
  )
}

function isInsideInteractive(event: MouseEvent<HTMLTableRowElement>) {
  const target = event.target as Element
  // Portaled menus and dialogs bubble through React to this row without being inside it.
  if (!event.currentTarget.contains(target)) return true
  return target.closest('a, button, input, label, [role="checkbox"]') !== null
}

export function ClickableRow({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  const router = useRouter()

  return (
    <tr
      className={cn('relative cursor-pointer hover:bg-surface-2', className)}
      onClick={(event) => {
        if (isInsideInteractive(event) || window.getSelection()?.toString()) return
        if (event.metaKey || event.ctrlKey) window.open(href, '_blank', 'noopener')
        else router.push(href)
      }}
    >
      {children}
    </tr>
  )
}

export function RowLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  return (
    <Link href={href} className={cn('row-link', className)}>
      {children}
    </Link>
  )
}

export function TableSkeleton({
  columns,
  rows = 8,
  rowHeight,
  visible,
}: {
  columns: { header: string; className?: string }[]
  rows?: number
  rowHeight: number
  visible: boolean
}) {
  return (
    <div aria-busy className={cn(!visible && 'invisible')}>
      <Table>
        <thead>
          <tr>
            {columns.map((column) => (
              <TableHead key={column.header} className={column.className}>
                {column.header}
              </TableHead>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }, (_unused, rowIndex) => (
            <tr key={rowIndex} style={{ height: rowHeight }}>
              {columns.map((column) => (
                <TableCell key={column.header} className={column.className}>
                  <Skeleton className="h-4 w-3/4" />
                </TableCell>
              ))}
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  )
}

export function LoadMore({
  hasMore,
  loading,
  onLoadMore,
}: {
  hasMore: boolean
  loading: boolean
  onLoadMore: () => void
}) {
  if (!hasMore) return null
  return (
    <div className="mt-4 flex justify-center">
      <Button onClick={onLoadMore} loading={loading}>
        {loading ? 'Loading…' : 'Load more'}
      </Button>
    </div>
  )
}
