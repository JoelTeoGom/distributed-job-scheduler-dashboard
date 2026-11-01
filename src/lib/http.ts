import type { z } from 'zod'

function errorMessageOf(body: unknown): string | undefined {
  if (typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string') {
    return body.error
  }
  return undefined
}

export type ApiErrorKind =
  | 'validation'
  | 'unauthorized'
  | 'not-found'
  | 'conflict'
  | 'version-conflict'
  | 'idempotency-mismatch'
  | 'server'
  | 'network'
  | 'contract'

export class ApiError extends Error {
  readonly kind: ApiErrorKind
  readonly status: number | undefined

  constructor(kind: ApiErrorKind, message: string, status?: number) {
    super(message)
    this.name = 'ApiError'
    this.kind = kind
    this.status = status
  }
}

// PATCH answers 412 to a stale If-Match; pause, resume and delete answer 409 when they lose a race.
// The Job Service also answers 409, for a retry on a job that is not dead, which stays as 'conflict'.
function errorKindFor(status: number, service: 'tasks' | 'jobs'): ApiErrorKind {
  if (status === 400 || status === 413) return 'validation'
  if (status === 401) return 'unauthorized'
  if (status === 404) return 'not-found'
  if (status === 412 || status === 428) return 'version-conflict'
  if (status === 409) return service === 'tasks' ? 'version-conflict' : 'conflict'
  if (status === 422) return 'idempotency-mismatch'
  return 'server'
}

export type Transport = (path: string, init: RequestInit) => Promise<Response>

const browserTransport: Transport = (path, init) => fetch(`/api${path}`, init)

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: string
  headers?: Record<string, string>
  transport?: Transport
  signal?: AbortSignal
}

function serviceFor(path: string): 'tasks' | 'jobs' {
  return /^\/jobs(\/|\?|$)/.test(path) || /^\/tasks\/[^/]+\/jobs/.test(path) ? 'jobs' : 'tasks'
}

async function send(path: string, options: RequestOptions): Promise<Response> {
  const { method = 'GET', body, headers, signal, transport = browserTransport } = options

  let response: Response
  try {
    response = await transport(path, {
      method,
      body,
      signal,
      headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers },
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiError('network', 'Could not reach the server')
  }

  if (response.ok) return response

  const errorBody: unknown = await response.json().catch(() => undefined)
  throw new ApiError(
    errorKindFor(response.status, serviceFor(path)),
    errorMessageOf(errorBody) ?? `Request failed with status ${response.status}`,
    response.status,
  )
}

export async function requestJson<Schema extends z.ZodType>(
  schema: Schema,
  path: string,
  options: RequestOptions = {},
): Promise<z.infer<Schema>> {
  const response = await send(path, options)
  const parsed = schema.safeParse(await response.json().catch(() => undefined))
  if (!parsed.success) {
    console.error(`Unexpected response from ${path}`, parsed.error.issues)
    throw new ApiError('contract', 'The server sent an unexpected response', response.status)
  }
  return parsed.data
}

export async function requestVoid(path: string, options: RequestOptions = {}): Promise<void> {
  await send(path, options)
}

export function queryString(parameters: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams()
  for (const [name, value] of Object.entries(parameters)) {
    if (value !== undefined && value !== '') search.set(name, String(value))
  }
  const encoded = search.toString()
  return encoded ? `?${encoded}` : ''
}
