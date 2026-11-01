'use client'

import { useEffect, useState } from 'react'

import { cn } from '@/lib/utils'

const SHOW_AFTER_MS = 200
const KEEP_AT_LEAST_MS = 400

export function useSkeleton(isLoading: boolean) {
  const [visibleSince, setVisibleSince] = useState<number | null>(null)

  useEffect(() => {
    if (isLoading && visibleSince === null) {
      const timer = setTimeout(() => setVisibleSince(Date.now()), SHOW_AFTER_MS)
      return () => clearTimeout(timer)
    }
    if (!isLoading && visibleSince !== null) {
      const remaining = KEEP_AT_LEAST_MS - (Date.now() - visibleSince)
      const timer = setTimeout(() => setVisibleSince(null), Math.max(0, remaining))
      return () => clearTimeout(timer)
    }
  }, [isLoading, visibleSince])

  return visibleSince !== null
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse rounded-badge bg-surface-3', className)} />
}
