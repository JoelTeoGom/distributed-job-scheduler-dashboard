// Tasks go through the real Task Service. Jobs are written straight to the stores, because the
// scheduler, executor and archiver that would create them do not exist yet.
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const outputDirectory = process.argv[2]
const env = Object.fromEntries(
  readFileSync(join(here, '.env'), 'utf8')
    .split('\n')
    .filter((line) => line.includes('='))
    .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]),
)

const TASK_SERVICE = 'http://localhost:8080'
const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const WEEK = 7 * DAY
const THURSDAY_EPOCH_TO_MONDAY = 4 * DAY
const HOT_WINDOW = 6 * HOUR
const MAX_RUNS_PER_TASK = 200
const MAX_HISTORY_AGE = 25 * DAY

const priorities = { critical: 0, high: 1, normal: 2, low: 3 }
const now = Date.now()

const taskSeeds = [
  {
    name: 'stripe-reconciliation', cron: '*/15 * * * *', timezone: 'Europe/Madrid', priority: 'high', method: 'POST',
    url: 'https://api.acme.io/internal/reconcile', body: '{"window":"15m","dry_run":false}',
    headers: { 'Content-Type': 'application/json' }, secret: 'stripe-recon-token', attempts: 5,
    every: 15 * MINUTE, phase: 0, successBody: '{"reconciled":true,"charges":128}',
  },
  {
    name: 'nightly-invoice-sync', cron: '0 2 * * *', timezone: 'Europe/Madrid', priority: 'normal', method: 'POST',
    url: 'https://billing.acme.io/jobs/invoices', secret: 'billing-api-token', attempts: 5,
    every: DAY, phase: HOUR, successBody: '{"synced":412}',
  },
  {
    name: 'refresh-exchange-rates', cron: '*/5 * * * *', timezone: 'UTC', priority: 'critical', method: 'GET',
    url: 'https://api.acme.io/fx/refresh', timeout: 10, attempts: 5, every: 5 * MINUTE, phase: 0,
    successBody: '{"rates":168}',
  },
  {
    name: 'send-weekly-digest', cron: '0 9 * * 1', timezone: 'Europe/Madrid', priority: 'normal', method: 'POST',
    url: 'https://mail.acme.io/digest/send', attempts: 5, every: WEEK, phase: THURSDAY_EPOCH_TO_MONDAY + 8 * HOUR,
    successBody: '{"sent":9321}',
  },
  {
    name: 'cleanup-expired-sessions', cron: '30 * * * *', timezone: 'UTC', priority: 'low', method: 'DELETE',
    url: 'https://api.acme.io/sessions/expired', attempts: 5, every: HOUR, phase: 30 * MINUTE,
    successBody: '{"deleted":77}',
  },
  {
    name: 'warm-search-cache', cron: '0 */6 * * *', timezone: 'UTC', priority: 'low', method: 'POST',
    url: 'https://search.acme.io/cache/warm', attempts: 5, every: 6 * HOUR, phase: 0, successBody: '{"warmed":true}',
  },
  {
    name: 'generate-monthly-report', cron: '0 6 1 * *', timezone: 'UTC', priority: 'high', method: 'POST',
    url: 'https://reports.acme.io/monthly', attempts: 3, every: 30 * DAY, phase: 0, paused: true, noRuns: true,
  },
  {
    name: 'black-friday-price-drop', runAt: '2026-11-26T23:00:00Z', timezone: 'Europe/Madrid', priority: 'critical',
    method: 'POST', url: 'https://api.acme.io/campaigns/bf26/start', secret: 'campaigns-token', attempts: 3, noRuns: true,
  },
]

const deadSeeds = [
  { name: 'send-weekly-digest', runsAgo: 0, status: 500, error: 'Template not found: digest_v3', body: '{"error":"template_not_found","template":"digest_v3"}' },
  { name: 'stripe-reconciliation', runsAgo: 3, status: 504, error: 'Gateway Timeout', body: '{"error":"upstream_timeout","message":"stripe API did not answer within 25s","retryable":true}' },
  { name: 'warm-search-cache', runsAgo: 2, error: 'connection refused · search.acme.io:443' },
  { name: 'nightly-invoice-sync', runsAgo: 9, status: 422, error: 'Invoice INV-20931 already closed', body: '{"error":"invoice_closed","invoice":"INV-20931"}' },
  { name: 'refresh-exchange-rates', runsAgo: 40, error: 'timeout after 10 s' },
  { name: 'cleanup-expired-sessions', runsAgo: 150, status: 503, error: 'Service Unavailable' },
  { name: 'stripe-reconciliation', runsAgo: 180, status: 502, error: 'Bad Gateway', body: '<html>bad gateway</html>' },
  { name: 'nightly-invoice-sync', runsAgo: 12, status: 401, error: 'Unauthorized', body: '{"error":"token_expired"}' },
]

// Past the 14 day retention: the archiver already moved them, so they can no longer be retried.
const archivedDeadSeeds = [
  { name: 'nightly-invoice-sync', runsAgo: 20, status: 500, error: 'Internal Server Error' },
  { name: 'send-weekly-digest', runsAgo: 3, error: 'lease expired' },
]

function randomFor(seed) {
  return (index) => createHash('sha256').update(`${seed}:${index}`).digest().readUInt32BE(0) / 2 ** 32
}

function uuidV7(timestamp, seed) {
  const random = createHash('sha256').update(seed).digest('hex')
  const time = timestamp.toString(16).padStart(12, '0')
  const variant = ((parseInt(random[15], 16) & 0x3) | 0x8).toString(16)
  return `${time.slice(0, 8)}-${time.slice(8)}-7${random.slice(0, 3)}-${variant}${random.slice(3, 6)}-${random.slice(6, 18)}`
}

function mysqlTime(timestamp) {
  return `'${new Date(timestamp).toISOString().slice(0, 23).replace('T', ' ')}'`
}

function cqlTime(timestamp) {
  return `'${new Date(timestamp).toISOString().replace('Z', '+0000')}'`
}

function sqlText(value) {
  return value === undefined ? 'NULL' : `'${value.replaceAll('\\', '\\\\').replaceAll("'", "''")}'`
}

function cqlText(value) {
  return value === undefined ? 'null' : `'${value.replaceAll("'", "''")}'`
}

function hex(value) {
  return Buffer.from(value).toString('hex')
}

function binaryId(id) {
  return `UNHEX('${id.replaceAll('-', '')}')`
}

function sqlBlob(value) {
  return value ? `UNHEX('${hex(value)}')` : 'NULL'
}

function cqlBlob(value) {
  return value ? `0x${hex(value)}` : 'null'
}

function monthBucket(timestamp) {
  const date = new Date(timestamp)
  return date.getUTCFullYear() * 100 + date.getUTCMonth() + 1
}

async function createTask(seed) {
  const payload = {
    name: seed.name,
    schedule: seed.cron
      ? { type: 'cron', cron_expr: seed.cron, timezone: seed.timezone }
      : { type: 'at', run_at: seed.runAt, timezone: seed.timezone },
    priority: seed.priority,
    request: {
      method: seed.method,
      url: seed.url,
      ...(seed.headers ? { headers: seed.headers } : {}),
      ...(seed.body ? { body: seed.body } : {}),
      ...(seed.secret ? { secret_ref: seed.secret } : {}),
    },
    timeout_seconds: seed.timeout ?? 30,
    retry: { max_attempts: seed.attempts, backoff_base_seconds: 10 },
  }

  const headers = { Authorization: `Bearer ${env.DEV_JWT}`, 'Content-Type': 'application/json' }
  const response = await fetch(`${TASK_SERVICE}/tasks`, {
    method: 'POST',
    headers: { ...headers, 'Idempotency-Key': `seed-${seed.name}` },
    body: JSON.stringify(payload),
  })
  if (!response.ok) throw new Error(`create ${seed.name}: ${response.status} ${await response.text()}`)

  const task = await response.json()
  if (seed.paused) {
    await fetch(`${TASK_SERVICE}/tasks/${task.id}/pause`, { method: 'POST', headers })
  }
  return task
}

function scheduledTimes(seed) {
  const newest = Math.floor((now - seed.phase) / seed.every) * seed.every + seed.phase
  const times = []
  for (let runIndex = 0; runIndex < MAX_RUNS_PER_TASK; runIndex += 1) {
    const scheduledAt = newest - runIndex * seed.every
    if (now - scheduledAt > MAX_HISTORY_AGE) break
    times.push(scheduledAt)
  }
  return times
}

// A retry waits base * 2^(n-1), and started_at always belongs to the last attempt.
function attemptStart(scheduledAt, attempt, lag, backoffSeconds) {
  let waited = 0
  for (let retry = 1; retry < attempt; retry += 1) waited += backoffSeconds * 1000 * 2 ** (retry - 1)
  return scheduledAt + lag + waited
}

function buildJob(task, seed, scheduledAt, runIndex, deadByRun, archivedDeadByRun) {
  const random = randomFor(`${task.id}:${scheduledAt}`)
  const lag = 150 + Math.round(random(0) * 220)
  const backoff = task.retry.backoff_base_seconds
  const maxAttempts = task.retry.max_attempts
  const job = {
    id: uuidV7(scheduledAt, `${task.id}:${scheduledAt}`),
    task,
    scheduledAt,
    nextAttemptAt: scheduledAt,
    workerId: undefined,
    leaseExpiresAt: undefined,
    updatedAt: scheduledAt,
  }

  const dead = deadByRun.get(runIndex) ?? archivedDeadByRun.get(runIndex)
  if (dead) {
    const startedAt = attemptStart(scheduledAt, maxAttempts, lag, backoff)
    const finishedAt = startedAt + 400 + Math.round(random(1) * 1800)
    return {
      ...job, status: 'dead', attempt: maxAttempts, startedAt, finishedAt, updatedAt: finishedAt,
      httpStatus: dead.status, error: dead.error, responseBody: dead.body,
      archived: archivedDeadByRun.has(runIndex),
    }
  }

  // The two most recent runs of a frequent task are still in flight.
  if (seed.every <= 15 * MINUTE && runIndex === 0) {
    const startedAt = scheduledAt + lag
    return {
      ...job, status: 'running', attempt: 1, startedAt, updatedAt: startedAt,
      workerId: 'executor-7f9c', leaseExpiresAt: startedAt + 60 * MINUTE,
    }
  }
  if (seed.every <= 15 * MINUTE && runIndex === 1) {
    const startedAt = attemptStart(scheduledAt, 2, lag, backoff)
    const finishedAt = startedAt + 800
    return {
      ...job, status: 'pending', attempt: 2, startedAt, finishedAt, updatedAt: finishedAt,
      nextAttemptAt: now + 2 * MINUTE, httpStatus: 503, error: 'Service Unavailable',
    }
  }

  const attempt = random(2) < 0.06 ? 2 : 1
  const startedAt = attemptStart(scheduledAt, attempt, lag, backoff)
  const finishedAt = startedAt + 500 + Math.round(random(3) * 2400)
  return {
    ...job, status: 'succeeded', attempt, startedAt, finishedAt, updatedAt: finishedAt,
    httpStatus: random(4) < 0.12 ? 201 : 200, responseBody: seed.successBody,
    archived: now - scheduledAt > HOT_WINDOW,
  }
}

function hotJobStatement(job) {
  const { task } = job
  const request = task.request
  return `INSERT INTO jobs (id, tenant_id, task_id, scheduled_at, priority, http_method, endpoint, headers, body, secret_ref,
  timeout_seconds, max_attempts, backoff_base_seconds, status, attempt, next_attempt_at, worker_id, lease_expires_at,
  started_at, finished_at, http_status, error, response_body, created_at, updated_at) VALUES (
  ${binaryId(job.id)}, ${binaryId(env.TENANT_ID)}, ${binaryId(task.id)}, ${mysqlTime(job.scheduledAt)}, ${priorities[task.priority]},
  ${sqlText(request.method)}, ${sqlText(request.url)}, ${request.headers ? sqlText(JSON.stringify(request.headers)) : 'NULL'},
  ${sqlBlob(request.body)}, ${sqlText(request.secret_ref)}, ${task.timeout_seconds}, ${task.retry.max_attempts}, ${task.retry.backoff_base_seconds},
  '${job.status}', ${job.attempt}, ${mysqlTime(job.nextAttemptAt)}, ${sqlText(job.workerId)}, ${job.leaseExpiresAt ? mysqlTime(job.leaseExpiresAt) : 'NULL'},
  ${job.startedAt ? mysqlTime(job.startedAt) : 'NULL'}, ${job.finishedAt ? mysqlTime(job.finishedAt) : 'NULL'}, ${job.httpStatus ?? 'NULL'},
  ${sqlText(job.error)}, ${sqlBlob(job.responseBody)}, ${mysqlTime(job.scheduledAt)}, ${mysqlTime(job.updatedAt)});`
}

function archivedJobStatements(job) {
  const bucket = monthBucket(job.scheduledAt)
  return [
    `INSERT INTO job_history (tenant_id, task_id, bucket, scheduled_at, job_id, status, attempt, priority, http_status, error, response_body, started_at, finished_at)
  VALUES (${env.TENANT_ID}, ${job.task.id}, ${bucket}, ${cqlTime(job.scheduledAt)}, ${job.id}, '${job.status}', ${job.attempt}, ${priorities[job.task.priority]},
  ${job.httpStatus ?? 'null'}, ${cqlText(job.error)}, ${cqlBlob(job.responseBody)}, ${cqlTime(job.startedAt)}, ${cqlTime(job.finishedAt)});`,
    `INSERT INTO job_by_id (tenant_id, job_id, task_id, bucket, scheduled_at)
  VALUES (${env.TENANT_ID}, ${job.id}, ${job.task.id}, ${bucket}, ${cqlTime(job.scheduledAt)});`,
  ]
}

// One at a time: ids are time-ordered, and the list follows them.
const tasks = []
for (const seed of taskSeeds) {
  tasks.push({ seed, task: await createTask(seed) })
}

const jobs = tasks.flatMap(({ seed, task }) => {
  if (seed.noRuns) return []
  const times = scheduledTimes(seed)
  const pick = (list) => {
    const selected = list.filter((dead) => dead.name === seed.name && dead.runsAgo < times.length)
    return new Map(selected.map((dead) => [dead.runsAgo, dead]))
  }
  const deadByRun = pick(deadSeeds)
  const archivedDeadByRun = pick(archivedDeadSeeds)
  return times.map((scheduledAt, runIndex) => buildJob(task, seed, scheduledAt, runIndex, deadByRun, archivedDeadByRun))
})

const hotJobs = jobs.filter((job) => !job.archived)
const archivedJobs = jobs.filter((job) => job.archived)

writeFileSync(
  join(outputDirectory, 'seed-jobs.sql'),
  `DELETE FROM jobs WHERE tenant_id = ${binaryId(env.TENANT_ID)};\n${hotJobs.map(hotJobStatement).join('\n')}\n`,
)
writeFileSync(
  join(outputDirectory, 'seed-jobs.cql'),
  `USE scheduler;\nTRUNCATE job_history;\nTRUNCATE job_by_id;\n${archivedJobs.flatMap(archivedJobStatements).join('\n')}\n`,
)

console.log(`${tasks.length} tasks, ${hotJobs.length} hot jobs, ${archivedJobs.length} archived jobs`)
