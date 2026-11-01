import { delay, http, HttpResponse } from 'msw'

import type { Job } from '@/features/jobs/schemas'
import type { CreateTaskRequest, Schedule, Task, UpdateTaskRequest } from '@/features/tasks/schemas'

import { seedJobs, seedTasks } from './data'

const LATENCY_MS = 180
const DEFAULT_PAGE_LIMIT = 50
const MAX_PAGE_LIMIT = 100
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const HOUR = 60 * 60 * 1000

let tasks: Task[] = structuredClone(seedTasks)
let jobs: Job[] = structuredClone(seedJobs)

const idempotencyKeys = new Map<string, { serializedBody: string; taskId: string }>()

function errorResponse(status: number, message: string) {
  return HttpResponse.json({ error: message }, { status })
}

function invalid(message: string) {
  return errorResponse(400, `invalid input: ${message}`)
}

function taskResponse(task: Task, status = 200, headers: Record<string, string> = {}) {
  return HttpResponse.json(task, { status, headers: { ETag: `"${task.version}"`, ...headers } })
}

function parseLimit(url: URL): number | undefined {
  const limit = url.searchParams.get('limit')
  if (limit === null) return DEFAULT_PAGE_LIMIT
  const parsed = Number(limit)
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= MAX_PAGE_LIMIT ? parsed : undefined
}

function findTask(taskId: unknown) {
  return tasks.find((task) => task.id === taskId && task.status !== 'deleted')
}

function isArchivedJob(job: Job) {
  return job.request === undefined
}

// Same rules as Task.ChangeSchedule, Request.validate and friends in the Task Service domain.
function validateSchedule(schedule: Schedule): string | undefined {
  if (schedule.type === 'at') {
    if (schedule.cron_expr) return 'an at schedule cannot have cron_expr'
    if (!schedule.run_at || new Date(schedule.run_at).getTime() <= Date.now()) return 'run_at must be in the future'
    return undefined
  }
  if (schedule.type !== 'cron') return 'schedule type must be at or cron'
  if (schedule.run_at) return 'a cron schedule cannot have run_at'
  if ((schedule.cron_expr ?? '').trim().split(/\s+/).length !== 5) return 'cron_expr must have 5 fields'
  return undefined
}

function validateChanges(changes: UpdateTaskRequest): string | undefined {
  if (changes.name !== undefined && (changes.name.trim().length === 0 || changes.name.length > 255)) {
    return 'name must be between 1 and 255 characters'
  }
  if (changes.schedule) {
    const scheduleError = validateSchedule(changes.schedule)
    if (scheduleError) return scheduleError
  }
  if (changes.request) {
    if (!changes.request.url.startsWith('https://')) return 'url must be a valid https URL'
    const headerNames = Object.keys(changes.request.headers ?? {}).map((name) => name.toLowerCase())
    if (headerNames.some((name) => ['authorization', 'proxy-authorization', 'cookie', 'x-api-key'].includes(name))) {
      return 'sensitive headers are not allowed, use secret_ref'
    }
  }
  return undefined
}

function nextRunFor(schedule: Schedule) {
  return schedule.type === 'at' ? schedule.run_at : new Date(Date.now() + HOUR).toISOString()
}

function uuidV7Like() {
  const random = crypto.randomUUID()
  return `0193${random.slice(4, 14)}7${random.slice(15)}`
}

export const handlers = [
  http.all('/api/*', async () => {
    await delay(LATENCY_MS)
  }),

  http.get('/api/tasks', ({ request }) => {
    const url = new URL(request.url)
    const limit = parseLimit(url)
    if (limit === undefined) return invalid('limit must be between 1 and 100')

    const cursor = url.searchParams.get('cursor')
    const visible = tasks
      .filter((task) => task.status !== 'deleted' && (!cursor || task.id > cursor))
      .sort((first, second) => first.id.localeCompare(second.id))

    const page = visible.slice(0, limit)
    const lastTask = page.at(-1)
    return HttpResponse.json({
      tasks: page,
      ...(visible.length > limit && lastTask ? { next_cursor: lastTask.id } : {}),
    })
  }),

  http.post('/api/tasks', async ({ request }) => {
    const serializedBody = await request.text()
    const idempotencyKey = request.headers.get('Idempotency-Key')

    if (idempotencyKey) {
      const stored = idempotencyKeys.get(idempotencyKey)
      if (stored && stored.serializedBody !== serializedBody) {
        return errorResponse(422, 'idempotency key reused with a different body')
      }
      const original = stored && tasks.find((task) => task.id === stored.taskId)
      if (original) return taskResponse(original, 200, { Location: `/tasks/${original.id}` })
    }

    const input = JSON.parse(serializedBody) as CreateTaskRequest
    const validationError = validateChanges(input)
    if (validationError) return invalid(validationError)

    const now = new Date().toISOString()
    const task: Task = {
      ...input,
      schedule: { ...input.schedule, timezone: input.schedule.timezone ?? 'UTC' },
      id: uuidV7Like(),
      status: 'active',
      next_run_at: nextRunFor(input.schedule),
      version: 1,
      created_at: now,
      updated_at: now,
    }
    tasks = [...tasks, task]
    if (idempotencyKey) idempotencyKeys.set(idempotencyKey, { serializedBody, taskId: task.id })
    return taskResponse(task, 201, { Location: `/tasks/${task.id}` })
  }),

  http.get('/api/tasks/:taskId', ({ params }) => {
    const task = findTask(params.taskId)
    return task ? taskResponse(task) : errorResponse(404, 'task not found')
  }),

  http.patch('/api/tasks/:taskId', async ({ params, request }) => {
    const task = findTask(params.taskId)
    if (!task) return errorResponse(404, 'task not found')

    const ifMatch = request.headers.get('If-Match')
    if (!ifMatch) return errorResponse(428, 'If-Match header is required')
    if (Number(ifMatch.replaceAll('"', '')) !== task.version) return errorResponse(412, 'version conflict')

    const changes = (await request.json()) as UpdateTaskRequest
    const validationError = validateChanges(changes)
    if (validationError) return invalid(validationError)

    const updated: Task = {
      ...task,
      ...changes,
      version: task.version + 1,
      updated_at: new Date().toISOString(),
      ...(changes.schedule ? { next_run_at: nextRunFor(changes.schedule) } : {}),
    }
    tasks = tasks.map((candidate) => (candidate.id === task.id ? updated : candidate))
    return taskResponse(updated)
  }),

  http.post('/api/tasks/:taskId/pause', ({ params }) => {
    const task = findTask(params.taskId)
    if (!task) return errorResponse(404, 'task not found')
    if (task.status === 'paused') return taskResponse(task)

    const updated: Task = { ...task, status: 'paused', version: task.version + 1, updated_at: new Date().toISOString() }
    tasks = tasks.map((candidate) => (candidate.id === task.id ? updated : candidate))
    return taskResponse(updated)
  }),

  http.post('/api/tasks/:taskId/resume', ({ params }) => {
    const task = findTask(params.taskId)
    if (!task) return errorResponse(404, 'task not found')
    if (task.status !== 'paused') return taskResponse(task)

    const updated: Task = {
      ...task,
      status: 'active',
      version: task.version + 1,
      updated_at: new Date().toISOString(),
      next_run_at: task.schedule.type === 'cron' ? nextRunFor(task.schedule) : task.next_run_at,
    }
    tasks = tasks.map((candidate) => (candidate.id === task.id ? updated : candidate))
    return taskResponse(updated)
  }),

  http.delete('/api/tasks/:taskId', ({ params }) => {
    const task = findTask(params.taskId)
    if (!task) return errorResponse(404, 'task not found')

    tasks = tasks.map((candidate) => (candidate.id === task.id ? { ...candidate, status: 'deleted' } : candidate))
    return new HttpResponse(null, { status: 204 })
  }),

  // Like the Job Service, this never reads tasks: an unknown task gets an empty history.
  http.get('/api/tasks/:taskId/jobs', ({ params, request }) => {
    const url = new URL(request.url)
    const limit = parseLimit(url)
    if (limit === undefined) return invalid('limit must be between 1 and 100')

    const cursor = url.searchParams.get('cursor')
    const page = jobs
      .filter((job) => job.task_id === params.taskId && (!cursor || job.scheduled_at < cursor))
      .sort((first, second) => second.scheduled_at.localeCompare(first.scheduled_at))
      .slice(0, limit)

    const lastJob = page.at(-1)
    return HttpResponse.json({
      jobs: page,
      ...(page.length === limit && lastJob ? { next_cursor: lastJob.scheduled_at } : {}),
    })
  }),

  http.get('/api/jobs', ({ request }) => {
    const url = new URL(request.url)
    if (url.searchParams.get('status') !== 'dead') return invalid('status must be dead')
    const limit = parseLimit(url)
    if (limit === undefined) return invalid('limit must be between 1 and 100')

    const cursor = url.searchParams.get('cursor')
    const page = jobs
      .filter((job) => job.status === 'dead' && !isArchivedJob(job) && (!cursor || job.id > cursor))
      .sort((first, second) => first.id.localeCompare(second.id))
      .slice(0, limit)

    const lastJob = page.at(-1)
    return HttpResponse.json({
      jobs: page,
      ...(page.length === limit && lastJob ? { next_cursor: lastJob.id } : {}),
    })
  }),

  http.get('/api/jobs/:jobId', ({ params }) => {
    if (!UUID_PATTERN.test(String(params.jobId))) return invalid('invalid id')
    const job = jobs.find((candidate) => candidate.id === params.jobId)
    return job ? HttpResponse.json(job) : errorResponse(404, 'job not found')
  }),

  http.post('/api/jobs/:jobId/retry', ({ params }) => {
    const job = jobs.find((candidate) => candidate.id === params.jobId)
    if (!job || isArchivedJob(job)) return errorResponse(404, 'job not found')
    if (job.status !== 'dead') return errorResponse(409, 'only dead jobs can be retried')

    const requeued: Job = {
      ...job,
      status: 'pending',
      attempt: 0,
      result: {},
      next_attempt_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    jobs = jobs.map((candidate) => (candidate.id === job.id ? requeued : candidate))
    return new HttpResponse(null, { status: 202 })
  }),
]
