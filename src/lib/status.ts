export type Tone = 'green' | 'red' | 'amber' | 'blue' | 'gray'

export interface StatusStyle {
  label: string
  tone: Tone
  pulsing?: boolean
}

export function taskStatusStyle(status: string): StatusStyle {
  switch (status) {
    case 'active':
      return { label: 'Active', tone: 'green' }
    case 'paused':
      return { label: 'Paused', tone: 'gray' }
    default:
      return { label: 'Deleted', tone: 'gray' }
  }
}

export function jobStatusStyle(job: { status: string; attempt: number }): StatusStyle {
  switch (job.status) {
    case 'pending':
      return job.attempt === 0 ? { label: 'Queued', tone: 'gray' } : { label: 'Retrying', tone: 'amber' }
    case 'running':
      return { label: 'Running', tone: 'blue', pulsing: true }
    case 'succeeded':
      return { label: 'Succeeded', tone: 'green' }
    default:
      return { label: 'Dead', tone: 'red' }
  }
}

export function priorityStyle(priority: string): StatusStyle {
  const label = priority.charAt(0).toUpperCase() + priority.slice(1)
  if (priority === 'critical') return { label, tone: 'red' }
  if (priority === 'high') return { label, tone: 'amber' }
  return { label, tone: 'gray' }
}

export function httpStatusStyle(httpStatus: number | undefined): StatusStyle {
  if (httpStatus === undefined) return { label: 'ERR', tone: 'red' }
  const label = String(httpStatus)
  if (httpStatus >= 200 && httpStatus < 300) return { label, tone: 'green' }
  if (httpStatus >= 300 && httpStatus < 400) return { label, tone: 'gray' }
  return { label, tone: 'red' }
}
