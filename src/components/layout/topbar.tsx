'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Fragment } from 'react'

import { Button } from '@/components/ui/button'
import { DisabledHint } from '@/components/ui/tooltip'
import { useJob } from '@/features/jobs/hooks'
import { useTask } from '@/features/tasks/hooks'
import { truncateId } from '@/lib/format'
import { docsLinks } from '@/lib/links'

interface Crumb {
  label: string
  href?: string
}

function useCrumbs(pathname: string): Crumb[] {
  const [section, entityId, action] = pathname.split('/').filter(Boolean)

  const jobId = section === 'jobs' ? entityId : undefined
  const job = useJob(jobId)
  const routeTaskId = section === 'tasks' && entityId !== 'new' ? entityId : undefined
  const taskId = routeTaskId ?? job.data?.task_id
  const task = useTask(taskId)
  const taskLabel = task.data?.name ?? (taskId ? truncateId(taskId) : '')

  const workspace: Crumb = { label: 'Workspace' }
  const tasks: Crumb = { label: 'Tasks', href: '/tasks' }

  if (section === 'dead-letter') return [workspace, { label: 'Dead letter' }]
  if (section === 'admin') return [{ label: 'Internal' }, { label: 'Platform metrics' }]
  if (section === 'jobs' && jobId) {
    return [
      workspace,
      tasks,
      ...(taskId ? [{ label: taskLabel, href: `/tasks/${taskId}` }] : []),
      { label: truncateId(jobId) },
    ]
  }
  if (entityId === 'new') return [workspace, tasks, { label: 'New task' }]
  if (taskId) {
    return action === 'edit'
      ? [workspace, tasks, { label: taskLabel, href: `/tasks/${taskId}` }, { label: 'Edit' }]
      : [workspace, tasks, { label: taskLabel }]
  }
  return [workspace, { label: 'Tasks' }]
}

export function Topbar() {
  const crumbs = useCrumbs(usePathname())

  return (
    <div className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border px-8">
      <nav aria-label="Breadcrumb" className="min-w-0">
        <ol className="flex items-center gap-2 text-muted">
          {crumbs.map((crumb, crumbIndex) => {
            const isLast = crumbIndex === crumbs.length - 1
            return (
              <Fragment key={`${crumb.label}-${crumbIndex}`}>
                {crumbIndex > 0 && (
                  <li aria-hidden className="text-subtle">
                    /
                  </li>
                )}
                <li className={isLast ? 'truncate font-medium text-text' : 'shrink-0'}>
                  {crumb.href ? (
                    <Link href={crumb.href} className="rounded-sm hover:text-text">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span aria-current={isLast ? 'page' : undefined}>{crumb.label}</span>
                  )}
                </li>
              </Fragment>
            )
          })}
        </ol>
      </nav>

      <div className="flex shrink-0 items-center gap-[18px] text-muted">
        <DisabledHint hint="Not available yet">
          <Button disabled>Feedback</Button>
        </DisabledHint>
        <DisabledHint hint="Not available yet">
          <span aria-disabled className="cursor-not-allowed text-subtle">
            Help
          </span>
        </DisabledHint>
        <a href={docsLinks.taskApi} target="_blank" rel="noreferrer" className="rounded-sm hover:text-text">
          Docs
        </a>
      </div>
    </div>
  )
}
