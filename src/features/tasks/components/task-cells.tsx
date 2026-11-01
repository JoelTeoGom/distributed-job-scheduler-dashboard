import { PlainBadge, StatusBadge } from '@/components/ui/badge'
import { describeSchedule } from '@/lib/format'
import { priorityStyle, taskStatusStyle } from '@/lib/status'

import type { Task } from '../schemas'

export function shortUrl(url: string) {
  return url.replace(/^https:\/\//, '')
}

export function TaskStatusBadge({ task }: { task: Pick<Task, 'status'> }) {
  return <StatusBadge status={taskStatusStyle(task.status)} />
}

export function PriorityBadge({ task }: { task: Pick<Task, 'priority'> }) {
  return <PlainBadge status={priorityStyle(task.priority)} />
}

export function ScheduleCell({ task }: { task: Task }) {
  return (
    <>
      <div className="font-mono text-[13px] whitespace-nowrap">{task.schedule.cron_expr ?? task.schedule.type}</div>
      <div className="mt-[3px] text-xs text-subtle xl:whitespace-nowrap">{describeSchedule(task.schedule)}</div>
    </>
  )
}

// The API keeps next_run_at on paused tasks, but nothing will fire until they resume.
export function nextRunOf(task: Task) {
  return task.status === 'paused' ? undefined : task.next_run_at
}
