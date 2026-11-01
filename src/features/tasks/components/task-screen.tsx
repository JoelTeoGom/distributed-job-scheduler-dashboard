'use client'

import { Clock, Pause, Pencil, Play, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, type ReactNode } from 'react'

import { PageHeader, PageHeaderSkeleton } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardEmpty, CardHeader } from '@/components/ui/card'
import { ActionsMenu, MenuItem } from '@/components/ui/dropdown'
import { IdText } from '@/components/ui/id-text'
import { Skeleton, useSkeleton } from '@/components/ui/skeleton'
import { ErrorState, NotFoundState } from '@/components/ui/state'
import { PendingStat, StatCell, StatRow } from '@/components/ui/stat-card'
import { Tabs } from '@/components/ui/tabs'
import { DisabledHint, Tooltip } from '@/components/ui/tooltip'
import { useNow } from '@/components/ui/use-now'
import { RunsTab } from '@/features/jobs/components/runs-tab'
import { features } from '@/lib/features'
import { describeSchedule, formatRelative, formatSeconds, formatUtc } from '@/lib/format'
import { ApiError } from '@/lib/http'
import { formatInTimeZone } from 'date-fns-tz'
import { cn } from '@/lib/utils'

import { useSetTaskPaused, useTask } from '../hooks'
import type { Task } from '../schemas'
import { DeleteTaskDialog } from './task-actions'
import { nextRunOf, PriorityBadge, shortUrl, TaskStatusBadge } from './task-cells'

function NextRunStat({ task }: { task: Task }) {
  const now = useNow()
  const nextRun = nextRunOf(task)
  const timezone = task.schedule.timezone ?? 'UTC'

  if (!nextRun) return <StatCell label="Next run" value={<span className="text-subtle">—</span>} />

  const dayIsToday =
    now !== 0 &&
    formatInTimeZone(new Date(nextRun), timezone, 'yyyy-MM-dd') === formatInTimeZone(new Date(now), timezone, 'yyyy-MM-dd')

  return (
    <StatCell
      label="Next run"
      value={
        <Tooltip content={formatUtc(nextRun)}>
          <span>{formatInTimeZone(new Date(nextRun), timezone, dayIsToday ? 'HH:mm' : 'MMM d, HH:mm')}</span>
        </Tooltip>
      }
      caption={now === 0 ? timezone : `${formatRelative(nextRun, now)} · ${timezone}`}
    />
  )
}

function ConfigurationRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 truncate">{children}</dd>
    </>
  )
}

function ConfigurationCard({ task }: { task: Task }) {
  const requestLine = `${task.request.method} ${shortUrl(task.request.url)}`

  return (
    <Card>
      <CardHeader title="Configuration" aside={`version ${task.version}`} />
      <dl className="grid grid-cols-[130px_1fr] items-center gap-x-3 gap-y-3 p-[18px] text-[13px]">
        <ConfigurationRow label="Schedule">
          <span className="font-mono">{task.schedule.cron_expr ?? describeSchedule(task.schedule)}</span>
        </ConfigurationRow>
        <ConfigurationRow label="Timezone">{task.schedule.timezone ?? 'UTC'}</ConfigurationRow>
        <ConfigurationRow label="Priority">
          <PriorityBadge task={task} />
        </ConfigurationRow>
        <ConfigurationRow label="Request">
          <Tooltip content={requestLine}>
            <span className="font-mono">{requestLine}</span>
          </Tooltip>
        </ConfigurationRow>
        <ConfigurationRow label="Credentials">
          {task.request.secret_ref ? `secret · ${task.request.secret_ref}` : <span className="text-subtle">None</span>}
        </ConfigurationRow>
        <ConfigurationRow label="Retries">
          {task.retry.max_attempts} {task.retry.max_attempts === 1 ? 'attempt' : 'attempts'} · backoff{' '}
          {formatSeconds(task.retry.backoff_base_seconds)} × 2ⁿ
        </ConfigurationRow>
        <ConfigurationRow label="Timeout">{formatSeconds(task.timeout_seconds)}</ConfigurationRow>
        <ConfigurationRow label="Task ID">
          <IdText id={task.id} className="text-text" />
        </ConfigurationRow>
      </dl>
    </Card>
  )
}

function TaskSkeleton({ visible }: { visible: boolean }) {
  return (
    <div aria-busy className={cn(!visible && 'invisible')}>
      <PageHeaderSkeleton icon={<Clock />} />
      <Skeleton className="mb-7 h-[124px] rounded-card" />
      <div className="mb-7 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Skeleton className="h-80 rounded-card" />
        <Skeleton className="h-80 rounded-card" />
      </div>
      <Skeleton className="h-96 rounded-card" />
    </div>
  )
}

export function TaskScreen({ taskId }: { taskId: string }) {
  const router = useRouter()
  const task = useTask(taskId)
  const setPaused = useSetTaskPaused()
  const showSkeleton = useSkeleton(task.isPending)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  if (task.isPending) return <TaskSkeleton visible={showSkeleton} />
  if (task.isError) {
    if (task.error instanceof ApiError && task.error.kind === 'not-found') {
      return <NotFoundState title="Task not found" backHref="/tasks" backLabel="Back to tasks" />
    }
    return <ErrorState onRetry={() => void task.refetch()} />
  }

  const taskData = task.data
  const isPaused = taskData.status === 'paused'

  return (
    <>
      <PageHeader
        icon={<Clock />}
        eyebrow="Task"
        title={taskData.name}
        badge={<TaskStatusBadge task={taskData} />}
        actions={
          <>
            {features.runNow ? (
              <Button>
                <Play aria-hidden /> Run now
              </Button>
            ) : (
              <DisabledHint hint="Run now needs the scheduler API">
                <Button disabled>
                  <Play aria-hidden /> Run now
                </Button>
              </DisabledHint>
            )}
            <Button onClick={() => setPaused.mutate({ task: taskData, paused: !isPaused })}>
              {isPaused ? <Play aria-hidden /> : <Pause aria-hidden />}
              {isPaused ? 'Resume' : 'Pause'}
            </Button>
            <Button asChild>
              <Link href={`/tasks/${taskData.id}/edit`}>
                <Pencil aria-hidden /> Edit
              </Link>
            </Button>
            <ActionsMenu label="More actions" boxed>
              <MenuItem destructive onSelect={() => setConfirmingDelete(true)}>
                <Trash2 aria-hidden /> Delete task…
              </MenuItem>
            </ActionsMenu>
          </>
        }
      />

      <DeleteTaskDialog
        task={taskData}
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        onDeleted={() => router.push('/tasks')}
      />

      <StatRow>
        <PendingStat label="Success rate · 30d" />
        <PendingStat label="Scheduling lag · p99" />
        <PendingStat label="Avg duration" />
        <NextRunStat task={taskData} />
      </StatRow>

      <div className="mb-7 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Card className="flex flex-col">
          <CardHeader title="Runs · last 30 days" />
          <CardEmpty className="flex-1">Run history charts are coming with the metrics service.</CardEmpty>
        </Card>
        <ConfigurationCard task={taskData} />
      </div>

      <Tabs
        tabs={[
          { value: 'runs', label: 'Runs', content: <RunsTab taskId={taskData.id} /> },
          {
            value: 'history',
            label: 'Configuration history',
            content: (
              <Card>
                <CardEmpty>Configuration history is coming with the audit log.</CardEmpty>
              </Card>
            ),
          },
          {
            value: 'alerts',
            label: 'Alerts',
            content: (
              <Card>
                <CardEmpty>Alerts are coming with the alerts service.</CardEmpty>
              </Card>
            ),
          },
        ]}
      />
    </>
  )
}
