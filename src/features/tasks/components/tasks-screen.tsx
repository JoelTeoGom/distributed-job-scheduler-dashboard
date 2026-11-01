'use client'

import { Code, List, Plus } from 'lucide-react'
import Link from 'next/link'
import { useMemo, useState } from 'react'

import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/ui/search-input'
import { PendingSelect, Select } from '@/components/ui/select'
import { useSkeleton } from '@/components/ui/skeleton'
import { ErrorState, StateMessage } from '@/components/ui/state'
import { PendingStat, StatCell, StatRow } from '@/components/ui/stat-card'
import { ClickableRow, LoadMore, RowLink, Table, TableCell, TableHead, TableSkeleton } from '@/components/ui/table'
import { RelativeTime } from '@/components/ui/time'
import { Tooltip } from '@/components/ui/tooltip'
import { useDeadJobs } from '@/features/jobs/hooks'
import { JobStatusBadge } from '@/features/jobs/components/job-cells'
import type { Job } from '@/features/jobs/schemas'
import { features } from '@/lib/features'
import { DEAD_LETTER_RETENTION_DAYS } from '@/lib/format'
import { docsLinks } from '@/lib/links'

import type { TaskFilters } from '../api'
import { useLastRuns, useTasks } from '../hooks'
import type { Priority, Task } from '../schemas'
import { TaskRowMenu } from './task-actions'
import { nextRunOf, PriorityBadge, ScheduleCell, shortUrl, TaskStatusBadge } from './task-cells'

const TASK_ROW_HEIGHT = 69
const FILTERS_HINT = 'Needs server-side filters in the API'
const COUNTS_HINT = 'Needs a count endpoint'
const LAST_RUN_HINT = 'Needs the last run in GET /tasks'

const skeletonColumns = [
  { header: 'Task' },
  { header: 'Schedule' },
  { header: 'Priority' },
  { header: 'Status' },
  { header: 'Last run' },
  { header: 'Next run', className: 'text-right' },
  { header: 'Actions', className: 'w-12' },
]

const statusOptions = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
] as const

const priorityOptions = [
  { value: 'all', label: 'All priorities' },
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'normal', label: 'Normal' },
  { value: 'low', label: 'Low' },
] as const

function matchesSearch(task: Task, query: string) {
  return task.name.toLowerCase().includes(query) || task.request.url.toLowerCase().includes(query)
}

function LastRunCell({ lastRun }: { lastRun: Job | null | undefined }) {
  if (!features.lastRunColumn) {
    return (
      <Tooltip content={LAST_RUN_HINT}>
        <span className="text-subtle">—</span>
      </Tooltip>
    )
  }
  if (lastRun === undefined) return <span className="text-subtle">—</span>
  if (lastRun === null) {
    return <span className="text-muted">Not run yet</span>
  }
  return (
    <>
      <JobStatusBadge job={lastRun} />
      <div className="mt-[3px] text-xs text-subtle">
        <RelativeTime value={lastRun.result.finished_at ?? lastRun.scheduled_at} />
      </div>
    </>
  )
}

function TaskRow({ task, lastRun }: { task: Task; lastRun: Job | null | undefined }) {
  const href = `/tasks/${task.id}`

  return (
    <ClickableRow href={href}>
      <TableCell className="max-w-52 xl:max-w-80">
        <RowLink href={href} className="block truncate font-medium">
          {task.name}
        </RowLink>
        <div className="mt-[3px] truncate font-mono text-xs text-subtle">
          {task.request.method} {shortUrl(task.request.url)}
        </div>
      </TableCell>
      <TableCell>
        <ScheduleCell task={task} />
      </TableCell>
      <TableCell>
        <PriorityBadge task={task} />
      </TableCell>
      <TableCell>
        <TaskStatusBadge task={task} />
      </TableCell>
      <TableCell>
        <LastRunCell lastRun={lastRun} />
      </TableCell>
      <TableCell className="text-right whitespace-nowrap text-muted">
        <RelativeTime value={nextRunOf(task)} />
      </TableCell>
      <TableCell className="w-12 text-right">
        <TaskRowMenu task={task} />
      </TableCell>
    </ClickableRow>
  )
}

function TaskStats({ tasks }: { tasks: Task[] }) {
  const deadJobs = useDeadJobs()
  const pausedCount = tasks.filter((task) => task.status === 'paused').length
  const deadCount = deadJobs.data?.pages.reduce((total, page) => total + page.jobs.length, 0) ?? 0

  return (
    <StatRow>
      {features.counts ? (
        <StatCell label="Active tasks" value={tasks.length - pausedCount} caption={`${pausedCount} paused`} />
      ) : (
        <PendingStat label="Active tasks" hint={COUNTS_HINT} />
      )}
      <PendingStat label="Runs · 24h" />
      <PendingStat label="Success rate · 24h" />
      {features.counts ? (
        <StatCell
          label="In dead letter"
          value={deadCount}
          valueClassName="text-red"
          caption={`retry window ${DEAD_LETTER_RETENTION_DAYS} days`}
        />
      ) : (
        <PendingStat label="In dead letter" hint={COUNTS_HINT} />
      )}
    </StatRow>
  )
}

export function TasksScreen() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')

  const filters: TaskFilters = features.serverFilters
    ? {
        search: search || undefined,
        status: statusFilter === 'all' ? undefined : statusFilter,
        priority: priorityFilter === 'all' ? undefined : (priorityFilter as Priority),
      }
    : {}

  const tasksQuery = useTasks(filters)
  const showSkeleton = useSkeleton(tasksQuery.isPending)

  const tasks = useMemo(() => tasksQuery.data?.pages.flatMap((page) => page.tasks) ?? [], [tasksQuery.data])
  const query = search.trim().toLowerCase()
  const visibleTasks = !features.serverFilters && query ? tasks.filter((task) => matchesSearch(task, query)) : tasks

  const lastRuns = useLastRuns(visibleTasks.map((task) => task.id))

  return (
    <>
      <PageHeader
        icon={<List />}
        eyebrow="Workspace"
        title="Tasks"
        actions={
          <>
            <Button asChild>
              <a href={docsLinks.taskApi} target="_blank" rel="noreferrer">
                <Code aria-hidden /> API
              </a>
            </Button>
            <Button asChild variant="primary">
              <Link href="/tasks/new">
                <Plus aria-hidden /> New task
              </Link>
            </Button>
          </>
        }
      />

      <TaskStats tasks={tasks} />

      <div className="mb-3 flex flex-wrap gap-2.5">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search tasks by name or endpoint…"
          label="Search tasks by name or endpoint"
        />
        <div className="w-[200px]">
          {features.serverFilters ? (
            <Select label="Status" value={statusFilter} onValueChange={setStatusFilter} options={statusOptions} />
          ) : (
            <PendingSelect label="All statuses" hint={FILTERS_HINT} />
          )}
        </div>
        <div className="w-[200px]">
          {features.serverFilters ? (
            <Select label="Priority" value={priorityFilter} onValueChange={setPriorityFilter} options={priorityOptions} />
          ) : (
            <PendingSelect label="All priorities" hint={FILTERS_HINT} />
          )}
        </div>
      </div>

      {tasksQuery.isPending ? (
        <TableSkeleton columns={skeletonColumns} rowHeight={TASK_ROW_HEIGHT} visible={showSkeleton} />
      ) : tasksQuery.isError ? (
        <ErrorState onRetry={() => void tasksQuery.refetch()} />
      ) : tasks.length === 0 ? (
        <StateMessage
          title="No tasks yet"
          description="Create one to schedule your first HTTP call."
          action={
            <Button asChild variant="primary">
              <Link href="/tasks/new">
                <Plus aria-hidden /> New task
              </Link>
            </Button>
          }
        />
      ) : visibleTasks.length === 0 ? (
        <StateMessage
          title="No loaded task matches"
          description="Search only covers the tasks loaded so far. Load more to widen it."
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <TableHead>Task</TableHead>
              <TableHead>Schedule</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last run</TableHead>
              <TableHead className="text-right">Next run</TableHead>
              <TableHead className="w-12">
                <span className="sr-only">Actions</span>
              </TableHead>
            </tr>
          </thead>
          <tbody>
            {visibleTasks.map((task, taskIndex) => (
              <TaskRow key={task.id} task={task} lastRun={lastRuns[taskIndex]?.data} />
            ))}
          </tbody>
        </Table>
      )}

      {!tasksQuery.isPending && !tasksQuery.isError && (
        <LoadMore
          hasMore={tasksQuery.hasNextPage}
          loading={tasksQuery.isFetchingNextPage}
          onLoadMore={() => void tasksQuery.fetchNextPage()}
        />
      )}
    </>
  )
}
