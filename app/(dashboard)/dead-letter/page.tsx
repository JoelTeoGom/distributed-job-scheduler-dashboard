import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query'
import type { Metadata } from 'next'

import { DeadLetterScreen } from '@/features/jobs/components/dead-letter-screen'
import { deadJobsQuery } from '@/features/jobs/queries'
import { tasksQuery } from '@/features/tasks/queries'
import { serverTransport } from '@/lib/server-transport'

export const metadata: Metadata = { title: 'Dead letter' }

export default async function DeadLetterPage() {
  const queryClient = new QueryClient()
  const transport = await serverTransport()
  if (transport) {
    await Promise.all([
      queryClient.prefetchInfiniteQuery(deadJobsQuery(undefined, transport)),
      queryClient.prefetchInfiniteQuery(tasksQuery({}, transport)),
    ])
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DeadLetterScreen />
    </HydrationBoundary>
  )
}
