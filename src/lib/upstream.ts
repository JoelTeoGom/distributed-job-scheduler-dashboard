import 'server-only'

type UpstreamService = 'task' | 'job'

const uuid = '[0-9a-fA-F-]{36}'

// Mirrors the routes of the Go services, so the BFF can only reach what they expose publicly.
const upstreamRoutes: { method: string; pattern: RegExp; service: UpstreamService }[] = [
  { method: 'POST', pattern: /^\/tasks$/, service: 'task' },
  { method: 'GET', pattern: /^\/tasks$/, service: 'task' },
  { method: 'GET', pattern: new RegExp(`^/tasks/${uuid}$`), service: 'task' },
  { method: 'PATCH', pattern: new RegExp(`^/tasks/${uuid}$`), service: 'task' },
  { method: 'DELETE', pattern: new RegExp(`^/tasks/${uuid}$`), service: 'task' },
  { method: 'POST', pattern: new RegExp(`^/tasks/${uuid}/pause$`), service: 'task' },
  { method: 'POST', pattern: new RegExp(`^/tasks/${uuid}/resume$`), service: 'task' },
  { method: 'GET', pattern: new RegExp(`^/tasks/${uuid}/jobs$`), service: 'job' },
  { method: 'GET', pattern: /^\/jobs$/, service: 'job' },
  { method: 'GET', pattern: new RegExp(`^/jobs/${uuid}$`), service: 'job' },
  { method: 'POST', pattern: new RegExp(`^/jobs/${uuid}/retry$`), service: 'job' },
]

const serviceBaseUrl: Record<UpstreamService, () => string> = {
  task: () => process.env.TASK_SERVICE_URL ?? 'http://localhost:8080',
  job: () => process.env.JOB_SERVICE_URL ?? 'http://localhost:8081',
}

export const UPSTREAM_TIMEOUT_MS = 15_000

export function resolveUpstreamUrl(method: string, pathWithQuery: string): string | undefined {
  const [path = ''] = pathWithQuery.split('?')
  const route = upstreamRoutes.find((candidate) => candidate.method === method && candidate.pattern.test(path))
  return route ? `${serviceBaseUrl[route.service]()}${pathWithQuery}` : undefined
}
