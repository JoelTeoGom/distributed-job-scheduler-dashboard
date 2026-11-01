import { HttpBadge, StatusBadge } from '@/components/ui/badge'
import { elapsedBetween, formatDuration, formatLag } from '@/lib/format'
import { httpStatusStyle, jobStatusStyle } from '@/lib/status'

import type { Job } from '../schemas'

export function JobStatusBadge({ job }: { job: Pick<Job, 'status' | 'attempt'> }) {
  return <StatusBadge status={jobStatusStyle(job)} />
}

export function JobHttpCell({ job }: { job: Job }) {
  const { http_status: httpStatus, error } = job.result
  if (httpStatus === undefined && !error) return <span className="text-subtle">—</span>
  return <HttpBadge status={httpStatusStyle(httpStatus)} />
}

export function JobLagCell({ job }: { job: Job }) {
  return (
    <span className="whitespace-nowrap tabular-nums">
      {formatLag(job.scheduled_at, job.result.started_at) ?? <span className="text-subtle">—</span>}
    </span>
  )
}

export function JobDurationCell({ job }: { job: Job }) {
  const duration = elapsedBetween(job.result.started_at, job.result.finished_at)
  return (
    <span className="whitespace-nowrap tabular-nums">
      {duration === undefined ? <span className="text-subtle">—</span> : formatDuration(duration)}
    </span>
  )
}
