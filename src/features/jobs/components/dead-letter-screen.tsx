'use client'

import { Inbox, RotateCw } from 'lucide-react'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { useCopy } from '@/components/ui/copy-button'
import { ActionsMenu, MenuItem } from '@/components/ui/dropdown'
import { IdText } from '@/components/ui/id-text'
import { SearchInput } from '@/components/ui/search-input'
import { PendingSelect } from '@/components/ui/select'
import { useSkeleton } from '@/components/ui/skeleton'
import { ErrorState, StateMessage } from '@/components/ui/state'
import { ClickableRow, LoadMore, RowLink, Table, TableCell, TableHead, TableSkeleton } from '@/components/ui/table'
import { AbsoluteTime } from '@/components/ui/time'
import { useNow } from '@/components/ui/use-now'
import { useTasks } from '@/features/tasks/hooks'
import { daysUntil, DEAD_LETTER_RETENTION_DAYS, retryDeadline, truncateId } from '@/lib/format'
import { ApiError } from '@/lib/http'
import { cn } from '@/lib/utils'

import { useDeadJobs, useJob, useRetryJob, useRetryJobs } from '../hooks'
import { formatAttempts, type Job } from '../schemas'
import { JobHttpCell } from './job-cells'

const DEAD_ROW_HEIGHT = 62
const RETRY_WINDOW_WARNING_DAYS = 3
const FILTERS_HINT = 'Needs filters in the API'
const JOB_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const skeletonColumns = [
  { header: '', className: 'w-12' },
  { header: 'Task / Job' },
  { header: 'Scheduled for' },
  { header: 'HTTP' },
  { header: 'Last error' },
  { header: 'Attempts' },
  { header: 'Retry window', className: 'text-right' },
  { header: 'Actions', className: 'w-12' },
]

function lastError(job: Job) {
  return job.result.error ?? ''
}

function retryDaysLeft(job: Job, now: number) {
  return job.result.finished_at ? daysUntil(retryDeadline(job.result.finished_at), now) : undefined
}

function RetryWindow({ job }: { job: Job }) {
  const now = useNow()
  const daysLeft = now === 0 ? undefined : retryDaysLeft(job, now)
  if (daysLeft === undefined) return <span className="text-subtle">—</span>
  return (
    <span className={cn('tabular-nums', daysLeft <= RETRY_WINDOW_WARNING_DAYS && 'text-amber')}>{daysLeft} d</span>
  )
}

function DeadRowMenu({ job }: { job: Job }) {
  const retryJob = useRetryJob()
  const { copy } = useCopy(job.id)

  return (
    <ActionsMenu label={`Actions for job ${job.id}`}>
      <MenuItem onSelect={() => retryJob.mutate(job.id)}>
        <RotateCw aria-hidden /> Retry job
      </MenuItem>
      <MenuItem asChild>
        <Link href={`/jobs/${job.id}`}>Open job</Link>
      </MenuItem>
      <MenuItem onSelect={() => void copy()}>Copy job ID</MenuItem>
    </ActionsMenu>
  )
}

interface DeadRowProps {
  job: Job
  taskName: string | undefined
  selected: boolean
  onSelectedChange: (selected: boolean) => void
}

function DeadRow({ job, taskName, selected, onSelectedChange }: DeadRowProps) {
  const href = `/jobs/${job.id}`

  return (
    <ClickableRow href={href}>
      <TableCell className="w-12">
        <Checkbox checked={selected} onCheckedChange={onSelectedChange} label={`Select job ${job.id}`} />
      </TableCell>
      <TableCell>
        <RowLink href={href} className="block font-medium">
          {taskName ?? <span className="font-mono text-[13px]">{truncateId(job.task_id)}</span>}
        </RowLink>
        <IdText id={job.id} className="text-xs text-subtle" />
      </TableCell>
      <TableCell>
        <AbsoluteTime value={job.scheduled_at} className="whitespace-nowrap" />
      </TableCell>
      <TableCell>
        <JobHttpCell job={job} />
      </TableCell>
      <TableCell className="max-w-72 truncate text-muted">{lastError(job)}</TableCell>
      <TableCell className="text-muted tabular-nums">{formatAttempts(job)}</TableCell>
      <TableCell className="text-right">
        <RetryWindow job={job} />
      </TableCell>
      <TableCell className="w-12 text-right">
        <DeadRowMenu job={job} />
      </TableCell>
    </ClickableRow>
  )
}

function csvCell(value: string) {
  // A leading = + - @ would run as a formula in a spreadsheet, and error text comes from third parties.
  const safeValue = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return `"${safeValue.replaceAll('"', '""')}"`
}

function exportDeadJobs(jobs: Job[], taskNames: Map<string, string>) {
  const header = ['job_id', 'task_id', 'task', 'scheduled_at', 'finished_at', 'http_status', 'last_error', 'attempts']
  const rows = jobs.map((job) => [
    job.id,
    job.task_id,
    taskNames.get(job.task_id) ?? '',
    job.scheduled_at,
    job.result.finished_at ?? '',
    job.result.http_status?.toString() ?? '',
    lastError(job),
    job.attempt.toString(),
  ])
  const csv = [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n')

  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'dead-letter.csv'
  anchor.click()
  URL.revokeObjectURL(url)
  toast.success(`Exported ${jobs.length} ${jobs.length === 1 ? 'job' : 'jobs'}`)
}

function ExactDeadJob({
  jobId,
  taskNames,
  selected,
  onToggle,
}: {
  jobId: string
  taskNames: Map<string, string>
  selected: Set<string>
  onToggle: (jobId: string, selected: boolean) => void
}) {
  const job = useJob(jobId, { retry: false })
  const showSkeleton = useSkeleton(job.isPending)

  if (job.isPending) {
    return <TableSkeleton columns={skeletonColumns} rows={1} rowHeight={DEAD_ROW_HEIGHT} visible={showSkeleton} />
  }
  if (job.isError && !(job.error instanceof ApiError && job.error.kind === 'not-found')) {
    return <ErrorState onRetry={() => void job.refetch()} />
  }
  if (!job.data) return <StateMessage title="No job with that ID" />
  if (job.data.status !== 'dead') {
    return (
      <StateMessage
        title="This job is not in the dead letter"
        action={
          <Button asChild>
            <Link href={`/jobs/${job.data.id}`}>Open job</Link>
          </Button>
        }
      />
    )
  }

  return (
    <DeadTable
      jobs={[job.data]}
      taskNames={taskNames}
      selected={selected}
      onToggle={onToggle}
    />
  )
}

function DeadTable({
  jobs,
  taskNames,
  selected,
  onToggle,
  onToggleAll,
}: {
  jobs: Job[]
  taskNames: Map<string, string>
  selected: Set<string>
  onToggle: (jobId: string, selected: boolean) => void
  onToggleAll?: (selected: boolean) => void
}) {
  const selectedCount = jobs.filter((job) => selected.has(job.id)).length
  const allState = selectedCount === 0 ? false : selectedCount === jobs.length ? true : ('indeterminate' as const)

  return (
    <Table>
      <thead>
        <tr>
          <TableHead className="w-12">
            {onToggleAll && <Checkbox checked={allState} onCheckedChange={onToggleAll} label="Select all loaded jobs" />}
          </TableHead>
          <TableHead>Task / Job</TableHead>
          <TableHead>Scheduled for</TableHead>
          <TableHead>HTTP</TableHead>
          <TableHead>Last error</TableHead>
          <TableHead>Attempts</TableHead>
          <TableHead className="text-right">Retry window</TableHead>
          <TableHead className="w-12">
            <span className="sr-only">Actions</span>
          </TableHead>
        </tr>
      </thead>
      <tbody>
        {jobs.map((job) => (
          <DeadRow
            key={job.id}
            job={job}
            taskName={taskNames.get(job.task_id)}
            selected={selected.has(job.id)}
            onSelectedChange={(isSelected) => onToggle(job.id, isSelected)}
          />
        ))}
      </tbody>
    </Table>
  )
}

export function DeadLetterScreen() {
  const deadJobs = useDeadJobs()
  const tasks = useTasks()
  const retryJobs = useRetryJobs()
  const showSkeleton = useSkeleton(deadJobs.isPending)

  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const jobs = useMemo(() => deadJobs.data?.pages.flatMap((page) => page.jobs) ?? [], [deadJobs.data])
  const taskNames = useMemo(
    () => new Map(tasks.data?.pages.flatMap((page) => page.tasks).map((task) => [task.id, task.name]) ?? []),
    [tasks.data],
  )

  const query = search.trim().toLowerCase()
  const isExactId = JOB_ID_PATTERN.test(query)
  const visibleJobs = query
    ? jobs.filter((job) => job.id.includes(query) || taskNames.get(job.task_id)?.toLowerCase().includes(query))
    : jobs

  const loadedIds = new Set(jobs.map((job) => job.id))
  const selectedIds = [...selected].filter((jobId) => loadedIds.has(jobId))

  function toggleJob(jobId: string, isSelected: boolean) {
    setSelected((current) => {
      const next = new Set(current)
      if (isSelected) next.add(jobId)
      else next.delete(jobId)
      return next
    })
  }

  function toggleAll(isSelected: boolean) {
    setSelected(isSelected ? new Set(visibleJobs.map((job) => job.id)) : new Set())
  }

  function retrySelected() {
    retryJobs.mutate(selectedIds, { onSettled: () => setSelected(new Set()) })
  }

  return (
    <>
      <PageHeader
        icon={<Inbox />}
        eyebrow="Workspace"
        title="Dead letter"
        actions={
          <>
            <Button disabled={jobs.length === 0} onClick={() => exportDeadJobs(jobs, taskNames)}>
              Export
            </Button>
            <Button
              variant="primary"
              disabled={selectedIds.length === 0}
              loading={retryJobs.isPending}
              onClick={retrySelected}
            >
              {!retryJobs.isPending && <RotateCw aria-hidden />}
              {retryJobs.isPending
                ? 'Retrying…'
                : selectedIds.length > 0
                  ? `Retry ${selectedIds.length} selected`
                  : 'Retry selected'}
            </Button>
          </>
        }
      />

      <p className="mb-5 rounded-[10px] border border-border bg-surface px-4 py-3 text-muted">
        Jobs that exhausted every retry. Retrying keeps the same job ID, so your endpoint can deduplicate. After{' '}
        {DEAD_LETTER_RETENTION_DAYS} days they move to the history and can no longer be retried.
      </p>

      <div className="mb-3 flex flex-wrap gap-2.5">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by task or job ID…"
          label="Search by task or job ID"
        />
        <div className="w-[200px]">
          <PendingSelect label="All tasks" hint={FILTERS_HINT} />
        </div>
        <div className="w-[200px]">
          <PendingSelect label="Any error" hint={FILTERS_HINT} />
        </div>
      </div>

      {isExactId ? (
        <ExactDeadJob jobId={query} taskNames={taskNames} selected={selected} onToggle={toggleJob} />
      ) : deadJobs.isPending ? (
        <TableSkeleton columns={skeletonColumns} rows={6} rowHeight={DEAD_ROW_HEIGHT} visible={showSkeleton} />
      ) : deadJobs.isError ? (
        <ErrorState onRetry={() => void deadJobs.refetch()} />
      ) : jobs.length === 0 ? (
        <StateMessage title="The dead letter is empty" description="Jobs land here once they exhaust their retries." />
      ) : visibleJobs.length === 0 ? (
        <StateMessage title="No loaded job matches" description="Paste a full job ID to look it up directly." />
      ) : (
        <>
          <DeadTable
            jobs={visibleJobs}
            taskNames={taskNames}
            selected={selected}
            onToggle={toggleJob}
            onToggleAll={toggleAll}
          />
          <LoadMore
            hasMore={deadJobs.hasNextPage}
            loading={deadJobs.isFetchingNextPage}
            onLoadMore={() => void deadJobs.fetchNextPage()}
          />
        </>
      )}
    </>
  )
}
