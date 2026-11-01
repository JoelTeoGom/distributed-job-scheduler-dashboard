import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query'

import type { Transport } from '@/lib/http'

import { getJob, listDeadJobs, listTaskJobs, type RunFilters } from './api'

const RUNS_PAGE_SIZE = 20
const DEAD_LETTER_PAGE_SIZE = 50

export const jobKeys = {
  all: ['jobs'] as const,
  detail: (jobId: string) => [...jobKeys.all, 'detail', jobId] as const,
  dead: (taskId?: string) => [...jobKeys.all, 'dead', { taskId }] as const,
  deadLists: () => [...jobKeys.all, 'dead'] as const,
  taskRuns: (taskId: string) => [...jobKeys.all, 'task', taskId] as const,
  taskRunsList: (taskId: string, filters: RunFilters) => [...jobKeys.taskRuns(taskId), 'list', filters] as const,
}

export function jobQuery(jobId: string, transport?: Transport) {
  return queryOptions({
    queryKey: jobKeys.detail(jobId),
    queryFn: () => getJob(jobId, transport),
  })
}

export function taskRunsQuery(taskId: string, filters: RunFilters = {}, transport?: Transport) {
  return infiniteQueryOptions({
    queryKey: jobKeys.taskRunsList(taskId, filters),
    queryFn: ({ pageParam }) => listTaskJobs({ taskId, cursor: pageParam, limit: RUNS_PAGE_SIZE, filters }, transport),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.next_cursor,
  })
}

export function deadJobsQuery(taskId?: string, transport?: Transport) {
  return infiniteQueryOptions({
    queryKey: jobKeys.dead(taskId),
    queryFn: ({ pageParam }) => listDeadJobs({ cursor: pageParam, limit: DEAD_LETTER_PAGE_SIZE, taskId }, transport),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.next_cursor,
  })
}
