'use client'

import { ErrorState } from '@/components/ui/state'

export default function DashboardError({ reset }: { error: Error; reset: () => void }) {
  return <ErrorState onRetry={reset} />
}
