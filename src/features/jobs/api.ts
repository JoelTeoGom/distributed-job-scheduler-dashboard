import { features } from '@/lib/features'
import { queryString, requestJson, requestVoid, type Transport } from '@/lib/http'

import { jobPageSchema, jobSchema } from './schemas'

export interface RunFilters {
  status?: string
  from?: string
  to?: string
}

export function getJob(jobId: string, transport?: Transport) {
  return requestJson(jobSchema, `/jobs/${jobId}`, { transport })
}

export function listTaskJobs(
  { taskId, cursor, limit, filters }: { taskId: string; cursor?: string; limit?: number; filters?: RunFilters },
  transport?: Transport,
) {
  // status, from and to are planned in section 6 of the spec; today's API ignores them.
  const serverFilters = features.serverFilters ? { ...filters } : {}
  return requestJson(jobPageSchema, `/tasks/${taskId}/jobs${queryString({ cursor, limit, ...serverFilters })}`, {
    transport,
  })
}

export function listDeadJobs(
  { cursor, limit, taskId }: { cursor?: string; limit?: number; taskId?: string },
  transport?: Transport,
) {
  const taskFilter = features.serverFilters ? { task_id: taskId } : {}
  return requestJson(jobPageSchema, `/jobs${queryString({ status: 'dead', cursor, limit, ...taskFilter })}`, {
    transport,
  })
}

export function retryJob(jobId: string) {
  return requestVoid(`/jobs/${jobId}/retry`, { method: 'POST' })
}
