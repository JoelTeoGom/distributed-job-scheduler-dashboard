import { fromZonedTime, formatInTimeZone } from 'date-fns-tz'

import { ApiError } from '@/lib/http'

import type { CreateTaskRequest, HttpRequest, Priority, Schedule, Task, UpdateTaskRequest } from './schemas'

export interface HeaderRow {
  rowId: string
  name: string
  value: string
}

export interface TaskFormValues {
  name: string
  scheduleType: 'cron' | 'at'
  cronExpression: string
  runAtLocal: string
  timezone: string
  priority: Priority
  method: string
  url: string
  headers: HeaderRow[]
  body: string
  secretRef: string
  timeoutSeconds: string
  maxAttempts: string
  backoffBaseSeconds: string
}

export type TaskFieldName =
  | 'name'
  | 'cronExpression'
  | 'runAtLocal'
  | 'timezone'
  | 'priority'
  | 'method'
  | 'url'
  | 'headers'
  | 'secretRef'
  | 'timeoutSeconds'
  | 'maxAttempts'
  | 'backoffBaseSeconds'

export type TaskFieldErrors = Partial<Record<TaskFieldName, string>>

// Visual order, so the first error found is the first one on screen.
export const taskFieldOrder: TaskFieldName[] = [
  'name',
  'priority',
  'cronExpression',
  'runAtLocal',
  'timezone',
  'method',
  'url',
  'headers',
  'secretRef',
  'timeoutSeconds',
  'maxAttempts',
  'backoffBaseSeconds',
]

export function taskFieldId(field: TaskFieldName) {
  return `task-${field}`
}

const MAX_NAME_LENGTH = 255
const MAX_URL_LENGTH = 2048
const MAX_SECRET_REF_LENGTH = 255
const MAX_TIMEOUT_SECONDS = 3600
const MAX_ATTEMPTS = 255
const MAX_BACKOFF_SECONDS = 86400
const CRON_FIELD_COUNT = 5
const MAX_CRON_LENGTH = 255
const MAX_TIMEZONE_LENGTH = 64
const SENSITIVE_HEADERS = ['authorization', 'proxy-authorization', 'cookie', 'x-api-key']

export const emptyTaskForm: TaskFormValues = {
  name: '',
  scheduleType: 'cron',
  cronExpression: '',
  runAtLocal: '',
  timezone: 'UTC',
  priority: 'normal',
  method: 'POST',
  url: '',
  headers: [],
  body: '',
  secretRef: '',
  timeoutSeconds: '30',
  maxAttempts: '3',
  backoffBaseSeconds: '10',
}

function runAtToLocal(runAt: string | undefined, timezone: string) {
  return runAt ? formatInTimeZone(new Date(runAt), timezone, "yyyy-MM-dd'T'HH:mm") : ''
}

export function taskToFormValues(task: Task): TaskFormValues {
  const timezone = task.schedule.timezone ?? 'UTC'
  return {
    name: task.name,
    scheduleType: task.schedule.type,
    cronExpression: task.schedule.cron_expr ?? '',
    runAtLocal: runAtToLocal(task.schedule.run_at, timezone),
    timezone,
    priority: task.priority,
    method: task.request.method,
    url: task.request.url,
    headers: Object.entries(task.request.headers ?? {}).map(([name, value], index) => ({
      rowId: `existing-${index}`,
      name,
      value,
    })),
    body: task.request.body ?? '',
    secretRef: task.request.secret_ref ?? '',
    timeoutSeconds: String(task.timeout_seconds),
    maxAttempts: String(task.retry.max_attempts),
    backoffBaseSeconds: String(task.retry.backoff_base_seconds),
  }
}

function isValidTimezone(timezone: string) {
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: timezone })
    return timezone.length <= MAX_TIMEZONE_LENGTH
  } catch {
    return false
  }
}

function isInternalHost(hostname: string) {
  const host = hostname.toLowerCase().replace(/\.$/, '')
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal')) return true
  if (host === '[::1]') return true

  const octets = host.split('.').map(Number)
  if (octets.length !== 4 || octets.some(Number.isNaN)) return false
  const [first = 0, second = 0] = octets
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  )
}

function validateUrl(rawUrl: string): string | undefined {
  if (rawUrl.length > MAX_URL_LENGTH) return 'URL must be at most 2048 characters'

  let endpoint: URL
  try {
    endpoint = new URL(rawUrl)
  } catch {
    return 'Enter a valid https URL'
  }
  if (endpoint.protocol !== 'https:' || !endpoint.hostname) return 'Enter a valid https URL'
  if (endpoint.username || endpoint.password) return 'The URL cannot contain credentials, use a secret'
  if (isInternalHost(endpoint.hostname)) return 'The URL cannot point to an internal address'
  return undefined
}

function outOfRange(rawValue: string, maximum: number) {
  const value = Number(rawValue)
  return rawValue.trim() === '' || !Number.isInteger(value) || value < 1 || value > maximum
}

// Mirrors the domain rules of the Task Service, so most mistakes never reach the API.
export function validateTaskForm(values: TaskFormValues, unchangedRunAtLocal?: string): TaskFieldErrors {
  const errors: TaskFieldErrors = {}

  const nameLength = [...values.name.trim()].length
  if (nameLength === 0 || nameLength > MAX_NAME_LENGTH) errors.name = 'Name must be between 1 and 255 characters'

  if (!isValidTimezone(values.timezone)) errors.timezone = 'Unknown timezone'

  if (values.scheduleType === 'cron') {
    const expression = values.cronExpression.trim()
    if (expression.length > MAX_CRON_LENGTH || expression.split(/\s+/).length !== CRON_FIELD_COUNT) {
      errors.cronExpression = 'Cron expressions must have 5 fields'
    }
  } else if (!values.runAtLocal) {
    errors.runAtLocal = 'Choose a date and time'
  } else if (
    !errors.timezone &&
    values.runAtLocal !== unchangedRunAtLocal &&
    fromZonedTime(values.runAtLocal, values.timezone).getTime() <= Date.now()
  ) {
    errors.runAtLocal = 'The run time must be in the future'
  }

  const urlError = validateUrl(values.url.trim())
  if (urlError) errors.url = urlError

  const headers = values.headers.filter((header) => header.name.trim() || header.value.trim())
  if (headers.some((header) => !header.name.trim())) {
    errors.headers = 'Every header needs a name'
  } else if (headers.some((header) => SENSITIVE_HEADERS.includes(header.name.trim().toLowerCase()))) {
    errors.headers = 'Sensitive headers are not allowed, use a secret'
  }

  if (values.secretRef.length > MAX_SECRET_REF_LENGTH) errors.secretRef = 'Must be at most 255 characters'

  if (outOfRange(values.timeoutSeconds, MAX_TIMEOUT_SECONDS)) {
    errors.timeoutSeconds = 'Use a whole number of seconds, up to 3600'
  }
  if (outOfRange(values.maxAttempts, MAX_ATTEMPTS)) errors.maxAttempts = 'Use a number between 1 and 255'
  if (outOfRange(values.backoffBaseSeconds, MAX_BACKOFF_SECONDS)) {
    errors.backoffBaseSeconds = 'Use a whole number of seconds, up to 86400'
  }

  return errors
}

function toSchedule(values: TaskFormValues): Schedule {
  return values.scheduleType === 'cron'
    ? { type: 'cron', cron_expr: values.cronExpression.trim(), timezone: values.timezone }
    : {
        type: 'at',
        run_at: fromZonedTime(values.runAtLocal, values.timezone).toISOString(),
        timezone: values.timezone,
      }
}

function toHttpRequest(values: TaskFormValues): HttpRequest {
  const headers = Object.fromEntries(
    values.headers
      .filter((header) => header.name.trim())
      .map((header) => [header.name.trim(), header.value] as const),
  )

  return {
    method: values.method,
    url: values.url.trim(),
    ...(Object.keys(headers).length > 0 ? { headers } : {}),
    ...(values.body ? { body: values.body } : {}),
    ...(values.secretRef.trim() ? { secret_ref: values.secretRef.trim() } : {}),
  }
}

export function toCreateRequest(values: TaskFormValues): CreateTaskRequest {
  return {
    name: values.name.trim(),
    schedule: toSchedule(values),
    priority: values.priority,
    request: toHttpRequest(values),
    timeout_seconds: Number(values.timeoutSeconds),
    retry: {
      max_attempts: Number(values.maxAttempts),
      backoff_base_seconds: Number(values.backoffBaseSeconds),
    },
  }
}

function sameRequest(first: HttpRequest, second: HttpRequest) {
  const canonical = (request: HttpRequest) =>
    JSON.stringify([
      request.method,
      request.url,
      Object.entries(request.headers ?? {}).sort(([left], [right]) => left.localeCompare(right)),
      request.body ?? '',
      request.secret_ref ?? '',
    ])
  return canonical(first) === canonical(second)
}

// A PATCH that carries the schedule recalculates next_run_at, and an empty one still bumps the
// version, so only what the user really changed is sent. schedule, request and retry go whole.
export function toUpdateRequest(values: TaskFormValues, task: Task): UpdateTaskRequest {
  const next = toCreateRequest(values)
  const original = taskToFormValues(task)
  const changes: UpdateTaskRequest = {}

  if (next.name !== task.name) changes.name = next.name
  if (next.priority !== task.priority) changes.priority = next.priority
  if (next.timeout_seconds !== task.timeout_seconds) changes.timeout_seconds = next.timeout_seconds
  if (!sameRequest(next.request, task.request)) changes.request = next.request
  if (
    next.retry.max_attempts !== task.retry.max_attempts ||
    next.retry.backoff_base_seconds !== task.retry.backoff_base_seconds
  ) {
    changes.retry = next.retry
  }

  const scheduleChanged =
    values.scheduleType !== original.scheduleType ||
    values.cronExpression.trim() !== original.cronExpression ||
    values.runAtLocal !== original.runAtLocal ||
    values.timezone !== original.timezone
  if (scheduleChanged) changes.schedule = next.schedule

  return changes
}

// 400 bodies are plain strings ("invalid input: ..."), so the field comes from the Go message.
const serverMessageFields: [prefix: string, field: TaskFieldName][] = [
  ['name must', 'name'],
  ['cron_expr must', 'cronExpression'],
  ['invalid cron_expr', 'cronExpression'],
  ['cron_expr never fires', 'cronExpression'],
  ['an at schedule', 'cronExpression'],
  ['a cron schedule', 'runAtLocal'],
  ['run_at must', 'runAtLocal'],
  ['unknown timezone', 'timezone'],
  ['priority must', 'priority'],
  ['unknown priority', 'priority'],
  ['method must', 'method'],
  ['url ', 'url'],
  ['sensitive headers', 'headers'],
  ['secret_ref must', 'secretRef'],
  ['timeout must', 'timeoutSeconds'],
  ['max_attempts must', 'maxAttempts'],
  ['backoff base must', 'backoffBaseSeconds'],
]

export function fieldErrorsFromApi(error: unknown): TaskFieldErrors | undefined {
  if (!(error instanceof ApiError) || error.kind !== 'validation') return undefined

  const message = error.message.replace(/^invalid input: /, '')
  const match = serverMessageFields.find(([prefix]) => message.startsWith(prefix))
  if (!match) return undefined

  const readable = message.charAt(0).toUpperCase() + message.slice(1)
  return { [match[1]]: readable }
}
