'use client'

import { ExternalLink, RotateCw } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

import { useCopy } from '@/components/ui/copy-button'
import { ActionsMenu, MenuItem } from '@/components/ui/dropdown'
import { IdText } from '@/components/ui/id-text'
import { SearchInput } from '@/components/ui/search-input'
import { PendingSelect, Select } from '@/components/ui/select'
import { useSkeleton } from '@/components/ui/skeleton'
import { ErrorState, StateMessage } from '@/components/ui/state'
import { ClickableRow, LoadMore, RowLink, Table, TableCell, TableHead, TableSkeleton } from '@/components/ui/table'
import { AbsoluteTime } from '@/components/ui/time'
import { features } from '@/lib/features'
import { ApiError } from '@/lib/http'

import { useJob, useRetryJob, useTaskRuns } from '../hooks'
import { formatAttempts, isArchived, type Job } from '../schemas'
import { JobDurationCell, JobHttpCell, JobLagCell, JobStatusBadge } from './job-cells'

const RUN_ROW_HEIGHT = 53
const FILTERS_HINT = 'Needs status and date filters in the API'
const JOB_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const statusFilterOptions = [
  { value: 'all', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'running', label: 'Running' },
  { value: 'succeeded', label: 'Succeeded' },
  { value: 'dead', label: 'Dead' },
] as const

const runColumns = [
  { header: 'Status' },
  { header: 'Job' },
  { header: 'Scheduled for' },
  { header: 'Lag' },
  { header: 'Duration' },
  { header: 'HTTP' },
  { header: 'Attempt' },
  { header: '', className: 'w-12' },
]

function RunRowMenu({ job }: { job: Job }) {
  const retryJob = useRetryJob()
  const { copy } = useCopy(job.id)

  return (
    <ActionsMenu label={`Actions for job ${job.id}`}>
      <MenuItem asChild>
        <Link href={`/jobs/${job.id}`}>
          <ExternalLink aria-hidden /> Open job
        </Link>
      </MenuItem>
      <MenuItem onSelect={() => void copy()}>Copy job ID</MenuItem>
      {job.status === 'dead' && !isArchived(job) && (
        <MenuItem onSelect={() => retryJob.mutate(job.id)}>
          <RotateCw aria-hidden /> Retry job
        </MenuItem>
      )}
    </ActionsMenu>
  )
}

function RunRow({ job }: { job: Job }) {
  const href = `/jobs/${job.id}`

  return (
    <ClickableRow href={href}>
      <TableCell>
        <RowLink href={href}>
          <JobStatusBadge job={job} />
        </RowLink>
      </TableCell>
      <TableCell>
        <IdText id={job.id} />
      </TableCell>
      <TableCell>
        <AbsoluteTime value={job.scheduled_at} withSeconds className="whitespace-nowrap" />
      </TableCell>
      <TableCell className="text-muted">
        <JobLagCell job={job} />
      </TableCell>
      <TableCell className="text-muted">
        <JobDurationCell job={job} />
      </TableCell>
      <TableCell>
        <JobHttpCell job={job} />
      </TableCell>
      <TableCell className="text-muted tabular-nums">{formatAttempts(job)}</TableCell>
      <TableCell className="w-12 text-right">
        <RunRowMenu job={job} />
      </TableCell>
    </ClickableRow>
  )
}

function RunsTableFrame({ jobs }: { jobs: Job[] }) {
  return (
    <Table>
      <thead>
        <tr>
          {runColumns.map((column) => (
            <TableHead key={column.header} className={column.className}>
              {column.header}
            </TableHead>
          ))}
        </tr>
      </thead>
      <tbody>
        {jobs.map((job) => (
          <RunRow key={job.id} job={job} />
        ))}
      </tbody>
    </Table>
  )
}

function ExactJobResult({ taskId, jobId }: { taskId: string; jobId: string }) {
  const job = useJob(jobId, { retry: false })
  const showSkeleton = useSkeleton(job.isPending)

  if (job.isPending) {
    return <TableSkeleton columns={runColumns} rows={1} rowHeight={RUN_ROW_HEIGHT} visible={showSkeleton} />
  }
  if (job.isError && !(job.error instanceof ApiError && job.error.kind === 'not-found')) {
    return <ErrorState onRetry={() => void job.refetch()} />
  }
  if (!job.data || job.data.task_id !== taskId) {
    return <StateMessage title="No run with that ID" description="It does not exist or belongs to another task." />
  }
  return <RunsTableFrame jobs={[job.data]} />
}

export function RunsTab({ taskId }: { taskId: string }) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const runs = useTaskRuns(taskId, features.serverFilters && statusFilter !== 'all' ? { status: statusFilter } : {})
  const showSkeleton = useSkeleton(runs.isPending)

  const query = search.trim().toLowerCase()
  const isExactId = JOB_ID_PATTERN.test(query)
  const jobs = runs.data?.pages.flatMap((page) => page.jobs) ?? []
  const visibleJobs = query ? jobs.filter((job) => job.id.includes(query)) : jobs

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2.5">
        <SearchInput value={search} onChange={setSearch} placeholder="Search by job ID…" label="Search by job ID" />
        <div className="w-[200px]">
          {features.serverFilters ? (
            <Select label="Status" value={statusFilter} onValueChange={setStatusFilter} options={statusFilterOptions} />
          ) : (
            <PendingSelect label="All statuses" hint={FILTERS_HINT} />
          )}
        </div>
        <div className="w-[200px]">
          <PendingSelect label="Last 24 hours" hint={FILTERS_HINT} />
        </div>
      </div>

      {isExactId ? (
        <ExactJobResult taskId={taskId} jobId={query} />
      ) : runs.isPending ? (
        <TableSkeleton columns={runColumns} rowHeight={RUN_ROW_HEIGHT} visible={showSkeleton} />
      ) : runs.isError ? (
        <ErrorState onRetry={() => void runs.refetch()} />
      ) : jobs.length === 0 ? (
        <StateMessage title="No runs yet" description="Jobs appear here once the scheduler fires this task." />
      ) : visibleJobs.length === 0 ? (
        <StateMessage title="No loaded run matches" description="Paste a full job ID to look it up directly." />
      ) : (
        <>
          <RunsTableFrame jobs={visibleJobs} />
          <LoadMore
            hasMore={runs.hasNextPage}
            loading={runs.isFetchingNextPage}
            onLoadMore={() => void runs.fetchNextPage()}
          />
        </>
      )}
    </div>
  )
}
