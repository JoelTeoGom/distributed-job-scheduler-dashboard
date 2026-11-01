'use client'

import { Pencil } from 'lucide-react'

import { PageHeaderSkeleton } from '@/components/layout/page-header'
import { Skeleton, useSkeleton } from '@/components/ui/skeleton'
import { ErrorState, NotFoundState } from '@/components/ui/state'
import { ApiError } from '@/lib/http'
import { cn } from '@/lib/utils'

import { useTask } from '../hooks'
import { EditTaskForm } from './task-form'

export function EditTaskScreen({ taskId }: { taskId: string }) {
  const task = useTask(taskId)
  const showSkeleton = useSkeleton(task.isPending)

  if (task.isPending) {
    return (
      <div aria-busy className={cn(!showSkeleton && 'invisible')}>
        <PageHeaderSkeleton icon={<Pencil />} />
        <div className="flex flex-col gap-4">
          <Skeleton className="h-36 rounded-card" />
          <Skeleton className="h-48 rounded-card" />
          <Skeleton className="h-96 rounded-card" />
        </div>
      </div>
    )
  }
  if (task.isError) {
    if (task.error instanceof ApiError && task.error.kind === 'not-found') {
      return <NotFoundState title="Task not found" backHref="/tasks" backLabel="Back to tasks" />
    }
    return <ErrorState onRetry={() => void task.refetch()} />
  }

  return <EditTaskForm key={task.data.id} task={task.data} />
}
