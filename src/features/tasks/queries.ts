import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query'

import type { Transport } from '@/lib/http'

import { getTask, listTasks } from './api'
import type { TaskFilters } from './api'

const TASKS_PAGE_SIZE = 50

export const taskKeys = {
  all: ['tasks'] as const,
  lists: () => [...taskKeys.all, 'list'] as const,
  list: (filters: TaskFilters) => [...taskKeys.lists(), filters] as const,
  detail: (taskId: string) => [...taskKeys.all, 'detail', taskId] as const,
}

export function tasksQuery(filters: TaskFilters = {}, transport?: Transport) {
  return infiniteQueryOptions({
    queryKey: taskKeys.list(filters),
    queryFn: ({ pageParam }) => listTasks({ cursor: pageParam, limit: TASKS_PAGE_SIZE, filters }, transport),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.next_cursor,
  })
}

export function taskQuery(taskId: string, transport?: Transport) {
  return queryOptions({
    queryKey: taskKeys.detail(taskId),
    queryFn: () => getTask(taskId, transport),
  })
}
