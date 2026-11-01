'use client'

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query'
import { toast } from 'sonner'

import { notifyApiError } from '@/lib/notify'

import { retryJob, type RunFilters } from './api'
import { deadJobsQuery, jobKeys, jobQuery, taskRunsQuery } from './queries'
import type { Job, JobPage } from './schemas'

const RUNS_POLL_INTERVAL_MS = 10_000

export function useJob(jobId: string | undefined, options: { retry?: boolean } = {}) {
  return useQuery({ ...jobQuery(jobId ?? ''), enabled: jobId !== undefined, ...options })
}

// refetchIntervalInBackground stays off, so polling stops while the tab is hidden.
export function useTaskRuns(taskId: string, filters: RunFilters = {}) {
  return useInfiniteQuery({
    ...taskRunsQuery(taskId, filters),
    refetchInterval: RUNS_POLL_INTERVAL_MS,
    refetchIntervalInBackground: false,
  })
}

export function useDeadJobs(taskId?: string) {
  return useInfiniteQuery(deadJobsQuery(taskId))
}

function requeued(job: Job): Job {
  return { ...job, status: 'pending', attempt: 0, result: {} }
}

function patchRunLists(queryClient: QueryClient, jobIds: Set<string>) {
  queryClient.setQueriesData<InfiniteData<JobPage>>(
    { predicate: (query) => query.queryKey[0] === 'jobs' && query.queryKey.includes('list') },
    (lists) =>
      lists
        ? {
            ...lists,
            pages: lists.pages.map((page) => ({
              ...page,
              jobs: page.jobs.map((job) => (jobIds.has(job.id) ? requeued(job) : job)),
            })),
          }
        : lists,
  )
}

function removeFromDeadLists(queryClient: QueryClient, jobIds: Set<string>) {
  queryClient.setQueriesData<InfiniteData<JobPage>>({ queryKey: jobKeys.deadLists() }, (lists) =>
    lists
      ? {
          ...lists,
          pages: lists.pages.map((page) => ({ ...page, jobs: page.jobs.filter((job) => !jobIds.has(job.id)) })),
        }
      : lists,
  )
}

async function applyOptimisticRetry(queryClient: QueryClient, jobIds: string[]) {
  await queryClient.cancelQueries({ queryKey: jobKeys.all })
  const snapshot = queryClient.getQueriesData({ queryKey: jobKeys.all })

  const retried = new Set(jobIds)
  removeFromDeadLists(queryClient, retried)
  patchRunLists(queryClient, retried)
  for (const jobId of jobIds) {
    queryClient.setQueryData<Job>(jobKeys.detail(jobId), (job) => job && requeued(job))
  }
  return snapshot
}

export function useRetryJob() {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: (jobId: string) => retryJob(jobId),
    onMutate: async (jobId) => ({ snapshot: await applyOptimisticRetry(queryClient, [jobId]) }),
    onSuccess: () => {
      toast.success('Job queued for retry')
    },
    onError: (error, jobId, context) => {
      context?.snapshot.forEach(([queryKey, data]) => queryClient.setQueryData(queryKey, data))
      notifyApiError(error, { retry: () => mutation.mutate(jobId) })
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: jobKeys.all }),
  })

  return mutation
}

export function useRetryJobs() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (jobIds: string[]) => {
      const outcomes = await Promise.allSettled(jobIds.map((jobId) => retryJob(jobId)))
      return jobIds.filter((_jobId, index) => outcomes[index]?.status === 'rejected')
    },
    onMutate: (jobIds) => applyOptimisticRetry(queryClient, jobIds),
    onSuccess: (failedJobIds, jobIds) => {
      const retriedCount = jobIds.length - failedJobIds.length
      const summary = `Retried ${retriedCount} of ${jobIds.length} ${jobIds.length === 1 ? 'job' : 'jobs'}`
      if (failedJobIds.length === 0) toast.success(summary)
      else toast.error(summary)
    },
    onError: (error, _jobIds, snapshot) => {
      snapshot?.forEach(([queryKey, data]) => queryClient.setQueryData(queryKey, data))
      notifyApiError(error)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: jobKeys.all }),
  })
}
