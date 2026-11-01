import { features } from '@/lib/features'
import { queryString, requestJson, requestVoid, type Transport } from '@/lib/http'

import { taskPageSchema, taskSchema, type Priority, type UpdateTaskRequest } from './schemas'

export interface TaskFilters {
  search?: string
  status?: string
  priority?: Priority
}

export interface TaskSubmission {
  serializedBody: string
  idempotencyKey: string
}

export function listTasks(
  { cursor, limit, filters }: { cursor?: string; limit?: number; filters?: TaskFilters },
  transport?: Transport,
) {
  // q, status and priority are planned in section 6 of the spec; today's API ignores them.
  const serverFilters = features.serverFilters
    ? { q: filters?.search, status: filters?.status, priority: filters?.priority }
    : {}
  return requestJson(taskPageSchema, `/tasks${queryString({ cursor, limit, ...serverFilters })}`, { transport })
}

export function getTask(taskId: string, transport?: Transport) {
  return requestJson(taskSchema, `/tasks/${taskId}`, { transport })
}

export function createTask({ serializedBody, idempotencyKey }: TaskSubmission) {
  return requestJson(taskSchema, '/tasks', {
    method: 'POST',
    body: serializedBody,
    headers: { 'Idempotency-Key': idempotencyKey },
  })
}

export function updateTask(taskId: string, version: number, changes: UpdateTaskRequest) {
  return requestJson(taskSchema, `/tasks/${taskId}`, {
    method: 'PATCH',
    body: JSON.stringify(changes),
    headers: { 'If-Match': `"${version}"` },
  })
}

export function pauseTask(taskId: string) {
  return requestJson(taskSchema, `/tasks/${taskId}/pause`, { method: 'POST' })
}

export function resumeTask(taskId: string) {
  return requestJson(taskSchema, `/tasks/${taskId}/resume`, { method: 'POST' })
}

export function deleteTask(taskId: string) {
  return requestVoid(`/tasks/${taskId}`, { method: 'DELETE' })
}
