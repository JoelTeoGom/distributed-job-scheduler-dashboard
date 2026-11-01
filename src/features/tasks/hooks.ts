'use client'

import {
  useInfiniteQuery,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { listTaskJobs } from '@/features/jobs/api'
import { jobKeys } from '@/features/jobs/queries'
import { features } from '@/lib/features'
import { notifyApiError } from '@/lib/notify'

import { createTask, deleteTask, pauseTask, resumeTask, updateTask } from './api'
import type { TaskFilters, TaskSubmission } from './api'
import { taskKeys, taskQuery, tasksQuery } from './queries'
import type { Task, TaskPage, UpdateTaskRequest } from './schemas'

export function useTasks(filters: TaskFilters = {}) {
  return useInfiniteQuery(tasksQuery(filters))
}

export function useTask(taskId: string | undefined) {
  return useQuery({ ...taskQuery(taskId ?? ''), enabled: taskId !== undefined })
}

// One request per row, which is why the column stays behind a flag until the API returns it.
export function useLastRuns(taskIds: string[]) {
  return useQueries({
    queries: taskIds.map((taskId) => ({
      queryKey: [...jobKeys.taskRuns(taskId), 'last'],
      queryFn: async () => (await listTaskJobs({ taskId, limit: 1 })).jobs[0] ?? null,
      enabled: features.lastRunColumn,
    })),
  })
}

function patchTaskInLists(queryClient: QueryClient, taskId: string, patch: (task: Task) => Task) {
  queryClient.setQueriesData<InfiniteData<TaskPage>>({ queryKey: taskKeys.lists() }, (lists) =>
    lists
      ? {
          ...lists,
          pages: lists.pages.map((page) => ({
            ...page,
            tasks: page.tasks.map((task) => (task.id === taskId ? patch(task) : task)),
          })),
        }
      : lists,
  )
}

function removeTaskFromLists(queryClient: QueryClient, taskId: string) {
  queryClient.setQueriesData<InfiniteData<TaskPage>>({ queryKey: taskKeys.lists() }, (lists) =>
    lists
      ? {
          ...lists,
          pages: lists.pages.map((page) => ({ ...page, tasks: page.tasks.filter((task) => task.id !== taskId) })),
        }
      : lists,
  )
}

export function useSetTaskPaused() {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: ({ task, paused }: { task: Task; paused: boolean }) =>
      paused ? pauseTask(task.id) : resumeTask(task.id),

    onMutate: async ({ task, paused }) => {
      await queryClient.cancelQueries({ queryKey: taskKeys.all })
      const previousLists = queryClient.getQueriesData<InfiniteData<TaskPage>>({ queryKey: taskKeys.lists() })
      const previousDetail = queryClient.getQueryData<Task>(taskKeys.detail(task.id))

      const status = paused ? ('paused' as const) : ('active' as const)
      patchTaskInLists(queryClient, task.id, (current) => ({ ...current, status }))
      queryClient.setQueryData<Task>(taskKeys.detail(task.id), (current) => current && { ...current, status })
      return { previousLists, previousDetail }
    },

    onError: (error, variables, context) => {
      context?.previousLists.forEach(([queryKey, data]) => queryClient.setQueryData(queryKey, data))
      if (context?.previousDetail) queryClient.setQueryData(taskKeys.detail(variables.task.id), context.previousDetail)
      notifyApiError(error, {
        retry: () => mutation.mutate(variables),
        reload: () => void queryClient.invalidateQueries({ queryKey: taskKeys.all }),
      })
    },

    onSuccess: (updatedTask) => {
      patchTaskInLists(queryClient, updatedTask.id, () => updatedTask)
      queryClient.setQueryData(taskKeys.detail(updatedTask.id), updatedTask)
    },
  })

  return mutation
}

export function useCreateTask() {
  const queryClient = useQueryClient()
  const router = useRouter()

  const mutation = useMutation({
    mutationFn: (submission: TaskSubmission) => createTask(submission),
    onSuccess: (task) => {
      queryClient.setQueryData(taskKeys.detail(task.id), task)
      void queryClient.invalidateQueries({ queryKey: taskKeys.lists() })
      toast.success(`Created ${task.name}`)
      router.push(`/tasks/${task.id}`)
    },
  })

  return mutation
}

export function useUpdateTask(taskId: string, version: number) {
  const queryClient = useQueryClient()
  const router = useRouter()

  return useMutation({
    mutationFn: (changes: UpdateTaskRequest) => updateTask(taskId, version, changes),
    onSuccess: (task) => {
      queryClient.setQueryData(taskKeys.detail(task.id), task)
      patchTaskInLists(queryClient, task.id, () => task)
      toast.success(`Saved ${task.name}`)
      router.push(`/tasks/${task.id}`)
    },
  })
}

export function useDeleteTask() {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: (task: Task) => deleteTask(task.id),
    onSuccess: (_result, task) => {
      removeTaskFromLists(queryClient, task.id)
      queryClient.removeQueries({ queryKey: taskKeys.detail(task.id) })
      toast.success(`Deleted ${task.name}`)
    },
    onError: (error, task) => {
      notifyApiError(error, {
        retry: () => mutation.mutate(task),
        reload: () => void queryClient.invalidateQueries({ queryKey: taskKeys.all }),
      })
    },
  })

  return mutation
}
