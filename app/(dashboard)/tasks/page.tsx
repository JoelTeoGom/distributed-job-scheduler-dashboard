import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query'
import type { Metadata } from 'next'

import { TasksScreen } from '@/features/tasks/components/tasks-screen'
import { tasksQuery } from '@/features/tasks/queries'
import { serverTransport } from '@/lib/server-transport'

export const metadata: Metadata = { title: 'Tasks' }

export default async function TasksPage() {
  const queryClient = new QueryClient()
  const transport = await serverTransport()
  if (transport) await queryClient.prefetchInfiniteQuery(tasksQuery({}, transport))

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <TasksScreen />
    </HydrationBoundary>
  )
}
