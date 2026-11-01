import { z } from 'zod'

import { httpRequestSchema, prioritySchema, retrySchema, timestampSchema } from '@/features/tasks/schemas'

export const jobStatusSchema = z.enum(['pending', 'running', 'succeeded', 'dead'])

export const jobResultSchema = z.object({
  started_at: timestampSchema.optional(),
  finished_at: timestampSchema.optional(),
  http_status: z.number().int().optional(),
  error: z.string().optional(),
  response_body: z.string().optional(),
})

// Archived jobs come from Cassandra with a reduced view: request, timeout_seconds, retry,
// next_attempt_at, created_at and updated_at are absent.
export const jobSchema = z.object({
  id: z.guid(),
  task_id: z.guid(),
  scheduled_at: timestampSchema,
  priority: prioritySchema,
  request: httpRequestSchema.optional(),
  timeout_seconds: z.number().int().optional(),
  retry: retrySchema.optional(),
  status: jobStatusSchema,
  attempt: z.number().int(),
  next_attempt_at: timestampSchema.optional(),
  result: jobResultSchema,
  created_at: timestampSchema.optional(),
  updated_at: timestampSchema.optional(),
})

export const jobPageSchema = z.object({
  jobs: z.array(jobSchema),
  next_cursor: z.string().optional(),
})

export type JobStatus = z.infer<typeof jobStatusSchema>
export type JobResult = z.infer<typeof jobResultSchema>
export type Job = z.infer<typeof jobSchema>
export type JobPage = z.infer<typeof jobPageSchema>

export function isArchived(job: Job) {
  return job.request === undefined
}

export function formatAttempts(job: Job) {
  return job.retry ? `${job.attempt}/${job.retry.max_attempts}` : String(job.attempt)
}
