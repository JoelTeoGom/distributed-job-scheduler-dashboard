import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query'
import type { Metadata } from 'next'

import { taskRunsQuery } from '@/features/jobs/queries'
import { TaskScreen } from '@/features/tasks/components/task-screen'
import { taskQuery } from '@/features/tasks/queries'
import { serverTransport } from '@/lib/server-transport'

export const metadata: Metadata = { title: 'Task' }

export default async function TaskPage({ params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params
  const queryClient = new QueryClient()
  const transport = await serverTransport()
  if (transport) {
    await Promise.all([
      queryClient.prefetchQuery(taskQuery(taskId, transport)),
      queryClient.prefetchInfiniteQuery(taskRunsQuery(taskId, {}, transport)),
    ])
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <TaskScreen taskId={taskId} />
    </HydrationBoundary>
  )
}
