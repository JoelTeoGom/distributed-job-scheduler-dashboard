import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query'
import type { Metadata } from 'next'

import { EditTaskScreen } from '@/features/tasks/components/edit-task-screen'
import { taskQuery } from '@/features/tasks/queries'
import { serverTransport } from '@/lib/server-transport'

export const metadata: Metadata = { title: 'Edit task' }

export default async function EditTaskPage({ params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params
  const queryClient = new QueryClient()
  const transport = await serverTransport()
  if (transport) await queryClient.prefetchQuery(taskQuery(taskId, transport))

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <EditTaskScreen taskId={taskId} />
    </HydrationBoundary>
  )
}
