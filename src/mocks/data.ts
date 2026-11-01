import type { Job } from '@/features/jobs/schemas'
import type { Task } from '@/features/tasks/schemas'

const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

const seededAt = Date.now()
const QUARTER_HOUR = 15 * MINUTE
const sinceQuarterHour = seededAt % QUARTER_HOUR

function isoFromNow(offset: number) {
  return new Date(seededAt + offset).toISOString()
}

interface TaskSeed extends Pick<Task, 'id' | 'name' | 'priority' | 'status' | 'version'> {
  method: string
  url: string
  cronExpr?: string
  runAtOffset?: number
  timezone: string
  nextRunOffset?: number
  secretRef?: string
  body?: string
  timeoutSeconds?: number
  maxAttempts?: number
  backoffSeconds?: number
}

const JSON_HEADERS = { 'Content-Type': 'application/json' }

const taskSeeds: TaskSeed[] = [
  {
    id: '0192f1c4-7b2e-7d31-9a4c-3f1e8d2b6a01',
    name: 'stripe-reconciliation',
    priority: 'high',
    status: 'active',
    version: 7,
    method: 'POST',
    url: 'https://api.acme.io/internal/reconcile',
    cronExpr: '*/15 * * * *',
    timezone: 'Europe/Madrid',
    nextRunOffset: QUARTER_HOUR - sinceQuarterHour,
    secretRef: 'stripe-recon-token',
    body: '{"window":"15m","dry_run":false}',
    timeoutSeconds: 30,
    maxAttempts: 5,
    backoffSeconds: 10,
  },
  {
    id: '0192f1c4-8c3f-7e42-8b5d-4a2f9e3c7b02',
    name: 'nightly-invoice-sync',
    priority: 'normal',
    status: 'active',
    version: 3,
    method: 'POST',
    url: 'https://billing.acme.io/jobs/invoices',
    cronExpr: '0 2 * * *',
    timezone: 'Europe/Madrid',
    nextRunOffset: 5 * HOUR,
    secretRef: 'billing-api-token',
    maxAttempts: 5,
  },
  {
    id: '0192f1c4-9d40-7f53-9c6e-5b3a0f4d8c03',
    name: 'refresh-exchange-rates',
    priority: 'critical',
    status: 'active',
    version: 2,
    method: 'GET',
    url: 'https://api.acme.io/fx/refresh',
    cronExpr: '*/5 * * * *',
    timezone: 'UTC',
    nextRunOffset: 38 * SECOND,
    timeoutSeconds: 10,
    maxAttempts: 5,
  },
  {
    id: '0192f1c4-ae51-7064-8d7f-6c4b1a5e9d04',
    name: 'send-weekly-digest',
    priority: 'normal',
    status: 'active',
    version: 4,
    method: 'POST',
    url: 'https://mail.acme.io/digest/send',
    cronExpr: '0 9 * * 1',
    timezone: 'Europe/Madrid',
    nextRunOffset: 2 * DAY,
    maxAttempts: 5,
  },
  {
    id: '0192f1c4-bf62-7175-9e80-7d5c2b6f0e05',
    name: 'cleanup-expired-sessions',
    priority: 'low',
    status: 'active',
    version: 1,
    method: 'DELETE',
    url: 'https://api.acme.io/sessions/expired',
    cronExpr: '30 * * * *',
    timezone: 'UTC',
    nextRunOffset: 22 * MINUTE,
    maxAttempts: 5,
  },
  {
    id: '0192f1c4-c073-7286-8f91-8e6d3c701f06',
    name: 'warm-search-cache',
    priority: 'low',
    status: 'active',
    version: 2,
    method: 'POST',
    url: 'https://search.acme.io/cache/warm',
    cronExpr: '0 */6 * * *',
    timezone: 'UTC',
    nextRunOffset: 3 * HOUR,
    maxAttempts: 5,
  },
  {
    id: '0192f1c4-d184-7397-90a2-9f7e4d812007',
    name: 'generate-monthly-report',
    priority: 'high',
    status: 'paused',
    version: 5,
    method: 'POST',
    url: 'https://reports.acme.io/monthly',
    cronExpr: '0 6 1 * *',
    timezone: 'UTC',
    nextRunOffset: 29 * DAY,
    maxAttempts: 3,
  },
  {
    id: '0192f1c4-e295-74a8-81b3-a08f5e923108',
    name: 'black-friday-price-drop',
    priority: 'critical',
    status: 'active',
    version: 1,
    method: 'POST',
    url: 'https://api.acme.io/campaigns/bf26/start',
    runAtOffset: 26 * DAY,
    timezone: 'Europe/Madrid',
    nextRunOffset: 26 * DAY,
    secretRef: 'campaigns-token',
    maxAttempts: 3,
  },
]

function taskFromSeed(seed: TaskSeed): Task {
  return {
    id: seed.id,
    name: seed.name,
    schedule: {
      type: seed.cronExpr ? 'cron' : 'at',
      ...(seed.cronExpr ? { cron_expr: seed.cronExpr } : {}),
      ...(seed.runAtOffset ? { run_at: isoFromNow(seed.runAtOffset) } : {}),
      timezone: seed.timezone,
    },
    priority: seed.priority,
    request: {
      method: seed.method,
      url: seed.url,
      ...(seed.body ? { headers: JSON_HEADERS, body: seed.body } : {}),
      ...(seed.secretRef ? { secret_ref: seed.secretRef } : {}),
    },
    timeout_seconds: seed.timeoutSeconds ?? 30,
    retry: { max_attempts: seed.maxAttempts ?? 3, backoff_base_seconds: seed.backoffSeconds ?? 10 },
    status: seed.status,
    ...(seed.nextRunOffset ? { next_run_at: isoFromNow(seed.nextRunOffset) } : {}),
    version: seed.version,
    created_at: isoFromNow(-60 * DAY),
    updated_at: isoFromNow(-2 * DAY),
  }
}

export const seedTasks = taskSeeds.map(taskFromSeed)

const taskByName = new Map(seedTasks.map((task) => [task.name, task]))

function requireTask(name: string): Task {
  const task = taskByName.get(name)
  if (!task) throw new Error(`Unknown mock task ${name}`)
  return task
}

interface JobSeed {
  id: string
  taskName: string
  scheduledOffset: number
  status: Job['status']
  attempt: number
  httpStatus?: number
  error?: string
  responseBody?: string
  lagMilliseconds?: number
  durationMilliseconds?: number
  archived?: boolean
}

// Mirrors toJobResponse in the Job Service: archived jobs lose the config-derived fields.
function jobFromSeed(seed: JobSeed): Job {
  const task = requireTask(seed.taskName)
  const scheduledAt = seededAt + seed.scheduledOffset
  const startedAt = seed.lagMilliseconds === undefined ? undefined : scheduledAt + seed.lagMilliseconds
  const finishedAt =
    startedAt === undefined || seed.durationMilliseconds === undefined ? undefined : startedAt + seed.durationMilliseconds

  const job: Job = {
    id: seed.id,
    task_id: task.id,
    scheduled_at: new Date(scheduledAt).toISOString(),
    priority: task.priority,
    status: seed.status,
    attempt: seed.attempt,
    result: {
      ...(startedAt === undefined ? {} : { started_at: new Date(startedAt).toISOString() }),
      ...(finishedAt === undefined ? {} : { finished_at: new Date(finishedAt).toISOString() }),
      ...(seed.httpStatus === undefined ? {} : { http_status: seed.httpStatus }),
      ...(seed.error ? { error: seed.error } : {}),
      ...(seed.responseBody ? { response_body: seed.responseBody } : {}),
    },
  }

  if (seed.archived) return job

  return {
    ...job,
    request: task.request,
    timeout_seconds: task.timeout_seconds,
    retry: task.retry,
    next_attempt_at: job.scheduled_at,
    created_at: job.scheduled_at,
    updated_at: new Date(finishedAt ?? scheduledAt).toISOString(),
  }
}

const STRIPE_RUN_COUNT = 64
const FIRST_ARCHIVED_RUN = 30

const gatewayTimeoutBody = JSON.stringify({
  error: 'upstream_timeout',
  message: 'stripe API did not answer within 25s',
  retryable: true,
})

// A fixed, deterministic history; variation comes from the run index.
function stripeRunSeed(runIndex: number): JobSeed {
  const hexSuffix = (0xe990 - runIndex * 0x137).toString(16).padStart(4, '0')
  const base = {
    id: `01933a55-${hexSuffix}-7c10-8a00-9b1e0c33${hexSuffix}`,
    taskName: 'stripe-reconciliation',
    scheduledOffset: -(sinceQuarterHour + runIndex * QUARTER_HOUR),
    archived: runIndex >= FIRST_ARCHIVED_RUN,
  }

  if (runIndex === 0) {
    return { ...base, status: 'running', attempt: 1, lagMilliseconds: 212 }
  }
  if (runIndex === 3) {
    return {
      ...base,
      id: '01933a39-5e2b-7c10-a7f4-9b1e0c33a7f4',
      status: 'dead',
      attempt: 5,
      httpStatus: 504,
      error: 'Gateway Timeout',
      responseBody: gatewayTimeoutBody,
      lagMilliseconds: 194,
      durationMilliseconds: 30_000,
    }
  }
  if (runIndex === 2) {
    return {
      ...base,
      status: 'pending',
      attempt: 2,
      httpStatus: 503,
      error: 'Service Unavailable',
      lagMilliseconds: 3100,
      durationMilliseconds: 2400,
    }
  }

  return {
    ...base,
    status: 'succeeded',
    attempt: runIndex % 11 === 5 ? 2 : 1,
    httpStatus: runIndex % 7 === 4 ? 201 : 200,
    responseBody: '{"reconciled":true}',
    lagMilliseconds: 170 + (runIndex * 37) % 90,
    durationMilliseconds: 1500 + (runIndex * 113) % 1000,
  }
}

const deadJobSeeds: JobSeed[] = [
  {
    id: '01932b9e-41c7-7a10-8f22-5d6e7f80d002',
    taskName: 'cleanup-expired-sessions',
    scheduledOffset: -12 * DAY,
    status: 'dead',
    attempt: 5,
    httpStatus: 503,
    error: 'Service Unavailable',
    lagMilliseconds: 240,
    durationMilliseconds: 410,
  },
  {
    id: '01932f55-02ab-7c31-9d44-6e7f8091be41',
    taskName: 'nightly-invoice-sync',
    scheduledOffset: -9 * DAY,
    status: 'dead',
    attempt: 5,
    httpStatus: 422,
    error: 'Invoice INV-20931 already closed',
    responseBody: '{"error":"invoice_closed","invoice":"INV-20931"}',
    lagMilliseconds: 301,
    durationMilliseconds: 820,
  },
  {
    id: '01933111-77de-7e52-a066-7f8091a277ac',
    taskName: 'send-weekly-digest',
    scheduledOffset: -5 * DAY,
    status: 'dead',
    attempt: 5,
    httpStatus: 500,
    error: 'Template not found: digest_v3',
    responseBody: '{"error":"template_not_found","template":"digest_v3"}',
    lagMilliseconds: 188,
    durationMilliseconds: 640,
  },
  {
    id: '019338c2-10e8-7f63-b177-8091a2b310e8',
    taskName: 'warm-search-cache',
    scheduledOffset: -14 * HOUR,
    status: 'dead',
    attempt: 5,
    error: 'connection refused · search.acme.io:443',
    lagMilliseconds: 150,
    durationMilliseconds: 90,
  },
  {
    id: '01933a02-3c6f-7074-8288-91a2b3c43c6f',
    taskName: 'refresh-exchange-rates',
    scheduledOffset: -7 * HOUR,
    status: 'dead',
    attempt: 5,
    error: 'timeout after 10 s',
    lagMilliseconds: 170,
    durationMilliseconds: 10_000,
  },
]

const otherRunSeeds: JobSeed[] = [
  {
    id: '01933b10-1f3a-7111-8399-a2b3c4d5e601',
    taskName: 'warm-search-cache',
    scheduledOffset: -3 * HOUR,
    status: 'pending',
    attempt: 2,
    httpStatus: 503,
    error: 'Service Unavailable',
    lagMilliseconds: 220,
    durationMilliseconds: 500,
  },
  {
    id: '01933b11-2a4b-7222-84aa-b3c4d5e6f702',
    taskName: 'refresh-exchange-rates',
    scheduledOffset: -4 * MINUTE,
    status: 'succeeded',
    attempt: 1,
    httpStatus: 200,
    lagMilliseconds: 180,
    durationMilliseconds: 640,
  },
  {
    id: '01933b12-3b5c-7333-85bb-c4d5e6f70803',
    taskName: 'nightly-invoice-sync',
    scheduledOffset: -21 * HOUR,
    status: 'succeeded',
    attempt: 1,
    httpStatus: 200,
    lagMilliseconds: 260,
    durationMilliseconds: 4200,
  },
  {
    id: '01933b13-4c6d-7444-86cc-d5e6f7081904',
    taskName: 'cleanup-expired-sessions',
    scheduledOffset: -38 * MINUTE,
    status: 'succeeded',
    attempt: 1,
    httpStatus: 204,
    lagMilliseconds: 410,
    durationMilliseconds: 300,
  },
  {
    id: '01933b14-5d7e-7555-87dd-e6f708192a05',
    taskName: 'generate-monthly-report',
    scheduledOffset: -30 * DAY,
    status: 'succeeded',
    attempt: 1,
    httpStatus: 200,
    lagMilliseconds: 300,
    durationMilliseconds: 18_000,
    archived: true,
  },
]

export const seedJobs: Job[] = [
  ...Array.from({ length: STRIPE_RUN_COUNT }, (_unused, runIndex) => stripeRunSeed(runIndex)),
  ...deadJobSeeds,
  ...otherRunSeeds,
].map(jobFromSeed)
