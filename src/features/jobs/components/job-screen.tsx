'use client'

import { RotateCw, SquareTerminal } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'

import { PageHeader, PageHeaderSkeleton } from '@/components/layout/page-header'
import { HttpBadge, PlainBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardEmpty, CardHeader } from '@/components/ui/card'
import { CodeBlock, jsonLines, type CodeLine } from '@/components/ui/code-block'
import { CopyButton } from '@/components/ui/copy-button'
import { Skeleton, useSkeleton } from '@/components/ui/skeleton'
import { ErrorState, NotFoundState } from '@/components/ui/state'
import { AbsoluteTime } from '@/components/ui/time'
import { Tooltip } from '@/components/ui/tooltip'
import { useNow } from '@/components/ui/use-now'
import { useTask } from '@/features/tasks/hooks'
import { features } from '@/lib/features'
import { daysUntil, elapsedBetween, formatClockMillis, formatDuration, formatFullDate, retryDeadline } from '@/lib/format'
import { ApiError } from '@/lib/http'
import { httpStatusStyle, priorityStyle } from '@/lib/status'
import { cn } from '@/lib/utils'

import { useJob, useRetryJob } from '../hooks'
import { formatAttempts, isArchived, type Job } from '../schemas'
import { JobStatusBadge } from './job-cells'

const httpReasonPhrases: Record<number, string> = {
  200: 'OK',
  201: 'Created',
  202: 'Accepted',
  204: 'No Content',
  301: 'Moved Permanently',
  302: 'Found',
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
}

function DeadBanner({ job }: { job: Job }) {
  const now = useNow()
  const finishedAt = job.result.finished_at

  if (isArchived(job)) {
    return (
      <Banner>
        <b className="font-medium text-red">All {job.attempt} attempts failed.</b> This job moved to the history and can
        no longer be retried.
      </Banner>
    )
  }

  const deadline = finishedAt ? retryDeadline(finishedAt) : undefined
  return (
    <Banner aside="Same job ID · the endpoint can deduplicate">
      <b className="font-medium text-red">All {job.attempt} attempts failed.</b> The job is in the dead letter queue.
      {deadline && now !== 0 && (
        <>
          {' '}
          You can retry it until {formatFullDate(deadline)} ({daysUntil(deadline, now)} days left).
        </>
      )}
    </Banner>
  )
}

function Banner({ children, aside }: { children: ReactNode; aside?: string }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-1 rounded-[10px] border border-red-bd bg-red-bg px-4 py-3">
      <p>{children}</p>
      {aside && <p className="text-muted">{aside}</p>}
    </div>
  )
}

function TimelineStep({
  title,
  meta,
  when,
  tone,
  last,
}: {
  title: ReactNode
  meta?: ReactNode
  when?: string
  tone: 'neutral' | 'ok' | 'fail'
  last?: boolean
}) {
  const dotStyles = {
    neutral: 'border-border-2 bg-surface-2',
    ok: 'border-green-bd bg-green-bg',
    fail: 'border-red-bd bg-red-bg',
  }
  const innerDotStyles = { neutral: 'bg-muted', ok: 'bg-green', fail: 'bg-red' }

  return (
    <li className="relative grid grid-cols-[22px_1fr_auto] gap-3.5 py-3">
      {!last && <span aria-hidden className="absolute top-8 -bottom-3 left-2.5 w-px bg-border-2" />}
      <span className={cn('grid size-[21px] place-items-center rounded-full border', dotStyles[tone])}>
        <i className={cn('size-[7px] rounded-full', innerDotStyles[tone])} />
      </span>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 font-medium">{title}</div>
        {meta && <div className="mt-[3px] text-[12.5px] text-muted">{meta}</div>}
      </div>
      {when && <time className="font-mono text-[12.5px] text-subtle tabular-nums">{when}</time>}
    </li>
  )
}

function lastAttemptDescription(job: Job) {
  const parts: string[] = []
  const { error, started_at: startedAt, finished_at: finishedAt } = job.result
  if (error) parts.push(error)
  const duration = elapsedBetween(startedAt, finishedAt)
  if (duration !== undefined) parts.push(formatDuration(duration))
  return parts.join(' · ')
}

function LastAttemptCard({ job }: { job: Job }) {
  const now = useNow()
  const { started_at: startedAt, http_status: httpStatus, error } = job.result
  const hasRun = startedAt !== undefined
  const failed = httpStatus === undefined ? Boolean(error) : httpStatus >= 400

  return (
    <Card>
      <CardHeader title="Last attempt" aside={job.retry ? `${job.attempt} of ${job.retry.max_attempts}` : `${job.attempt}`} />
      <ol className="px-[18px] pt-1.5 pb-[18px]">
        <TimelineStep
          title="Scheduled"
          tone="neutral"
          when={now === 0 ? undefined : formatClockMillis(job.scheduled_at)}
          last={!hasRun}
        />
        {hasRun && (
          <TimelineStep
            title={
              <>
                Attempt {job.attempt}
                {(httpStatus !== undefined || error) && <HttpBadge status={httpStatusStyle(httpStatus)} />}
              </>
            }
            meta={lastAttemptDescription(job)}
            tone={failed ? 'fail' : job.status === 'succeeded' ? 'ok' : 'neutral'}
            when={now === 0 ? undefined : formatClockMillis(startedAt)}
            last
          />
        )}
      </ol>
      <p className="px-[18px] pb-4 text-xs text-subtle">Only the last attempt is stored for now.</p>
    </Card>
  )
}

function requestLines(job: Job): CodeLine[] {
  const request = job.request
  if (!request) return []

  const headers: CodeLine[] = Object.entries(request.headers ?? {}).map(([name, value]) => ({
    kind: 'header',
    text: `${name}: ${value}`,
  }))
  const secret: CodeLine[] = request.secret_ref
    ? [{ kind: 'secret', name: 'Authorization', secretName: request.secret_ref }]
    : []
  const body: CodeLine[] = request.body
    ? [{ kind: 'blank' }, { kind: 'comment', text: '# body' }, ...jsonLines(request.body)]
    : []

  return [
    { kind: 'comment', text: '# headers' },
    ...headers,
    { kind: 'header', text: `Idempotency-Key: ${job.id}` },
    ...secret,
    ...body,
  ]
}

function RequestCard({ job }: { job: Job }) {
  return (
    <Card>
      <CardHeader
        title="Request"
        aside={job.request && <span className="font-mono text-[13px] text-muted">{job.request.method} {job.request.url}</span>}
      />
      {job.request ? (
        <CodeBlock lines={requestLines(job)} />
      ) : (
        <CardEmpty>Request not retained for archived jobs.</CardEmpty>
      )}
    </Card>
  )
}

function ResponseCard({ job }: { job: Job }) {
  const { http_status: httpStatus, error, response_body: responseBody, started_at: startedAt } = job.result
  const reason = httpStatus === undefined ? undefined : httpReasonPhrases[httpStatus]
  const lines: CodeLine[] = [
    { kind: 'comment', text: '# response headers are not stored yet' },
    ...(responseBody ? [{ kind: 'blank' } as const, ...jsonLines(responseBody)] : []),
    ...(!responseBody && error ? [{ kind: 'blank' } as const, { kind: 'plain', text: error } as const] : []),
  ]

  return (
    <Card>
      <CardHeader
        title="Response · last attempt"
        aside={
          (httpStatus !== undefined || error) && (
            <HttpBadge status={httpStatusStyle(httpStatus)}>
              {httpStatus === undefined ? 'ERR' : [httpStatus, reason].filter(Boolean).join(' ')}
            </HttpBadge>
          )
        }
      />
      {startedAt ? <CodeBlock lines={lines} /> : <CardEmpty>The job has not run yet.</CardEmpty>}
    </Card>
  )
}

function DetailEntry({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[100px_1fr] items-center gap-3 text-[13px] xl:grid-cols-[130px_1fr]">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 truncate">{children}</dd>
    </div>
  )
}

function PendingDetail({ hint }: { hint: string }) {
  return (
    <Tooltip content={hint}>
      <span tabIndex={0} className="rounded-sm text-subtle">
        —
      </span>
    </Tooltip>
  )
}

// The API does not return these yet; each one gets its real field when it does.
function ExtendedDetail() {
  return features.jobDetailsExtended ? '—' : <PendingDetail hint="Not returned by the API yet" />
}

function DetailsCard({ job, taskName }: { job: Job; taskName: string | undefined }) {
  return (
    <Card className="mt-4">
      <CardHeader title="Details" />
      <dl className="grid gap-x-8 gap-y-3 p-[18px] md:grid-cols-3">
        <div className="flex flex-col gap-3">
          <DetailEntry label="Task">
            <Link href={`/tasks/${job.task_id}`} className="rounded-sm hover:underline">
              {taskName ?? 'Open task'}
            </Link>
          </DetailEntry>
          <DetailEntry label="Priority">
            <PlainBadge status={priorityStyle(job.priority)} />
          </DetailEntry>
          <DetailEntry label="Scheduled for">
            <AbsoluteTime value={job.scheduled_at} withSeconds />
          </DetailEntry>
          <DetailEntry label="Attempts">
            <span className="tabular-nums">{formatAttempts(job)}</span>
          </DetailEntry>
        </div>
        <div className="flex flex-col gap-3">
          <DetailEntry label="First start">
            <ExtendedDetail />
          </DetailEntry>
          <DetailEntry label="Finished">
            <AbsoluteTime value={job.result.finished_at} withSeconds />
          </DetailEntry>
          <DetailEntry label="Total time">
            <ExtendedDetail />
          </DetailEntry>
        </div>
        <div className="flex flex-col gap-3">
          <DetailEntry label="Last worker">
            <ExtendedDetail />
          </DetailEntry>
          <DetailEntry label="Config">
            <ExtendedDetail />
          </DetailEntry>
          <DetailEntry label="Stored in">
            <ExtendedDetail />
          </DetailEntry>
        </div>
      </dl>
    </Card>
  )
}

function JobSkeleton({ visible }: { visible: boolean }) {
  return (
    <div aria-busy className={cn(!visible && 'invisible')}>
      <PageHeaderSkeleton icon={<SquareTerminal />} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-72 rounded-card" />
        <Skeleton className="h-72 rounded-card" />
      </div>
      <Skeleton className="mt-4 h-40 rounded-card" />
    </div>
  )
}

export function JobScreen({ jobId }: { jobId: string }) {
  const job = useJob(jobId)
  const task = useTask(job.data?.task_id)
  const retryJob = useRetryJob()
  const showSkeleton = useSkeleton(job.isPending)

  if (job.isPending) return <JobSkeleton visible={showSkeleton} />
  if (job.isError) {
    if (job.error instanceof ApiError && job.error.kind === 'not-found') {
      return <NotFoundState title="Job not found" backHref="/tasks" backLabel="Back to tasks" />
    }
    return <ErrorState onRetry={() => void job.refetch()} />
  }

  const jobData = job.data
  const canRetry = jobData.status === 'dead' && !isArchived(jobData)

  return (
    <>
      <PageHeader
        icon={<SquareTerminal />}
        eyebrow={task.data ? `Job · ${task.data.name}` : 'Job'}
        title={jobData.id}
        titleClassName="font-mono text-[22px] tracking-[-0.03em] xl:text-[28px]"
        badge={<JobStatusBadge job={jobData} />}
        actions={
          <>
            <CopyButton value={jobData.id}>Copy ID</CopyButton>
            {canRetry && (
              <Button variant="primary" loading={retryJob.isPending} onClick={() => retryJob.mutate(jobData.id)}>
                {!retryJob.isPending && <RotateCw aria-hidden />}
                {retryJob.isPending ? 'Retrying…' : 'Retry job'}
              </Button>
            )}
          </>
        }
      />

      {jobData.status === 'dead' && <DeadBanner job={jobData} />}

      <div className="grid gap-4 lg:grid-cols-[1fr_1.25fr]">
        {features.attemptsTimeline ? (
          <Card>
            <CardHeader title="Attempts" />
            <CardEmpty>No attempts recorded.</CardEmpty>
          </Card>
        ) : (
          <LastAttemptCard job={jobData} />
        )}
        <div className="flex min-w-0 flex-col gap-4">
          <RequestCard job={jobData} />
          <ResponseCard job={jobData} />
        </div>
      </div>

      <DetailsCard job={jobData} taskName={task.data?.name} />
    </>
  )
}
