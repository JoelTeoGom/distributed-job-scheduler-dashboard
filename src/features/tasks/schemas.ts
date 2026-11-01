import { z } from 'zod'

export const timestampSchema = z.iso.datetime({ offset: true })

export const prioritySchema = z.enum(['critical', 'high', 'normal', 'low'])
export const taskStatusSchema = z.enum(['active', 'paused', 'deleted'])
export const httpMethodSchema = z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])

export const scheduleSchema = z.object({
  type: z.enum(['at', 'cron']),
  run_at: timestampSchema.optional(),
  cron_expr: z.string().optional(),
  timezone: z.string().optional(),
})

export const httpRequestSchema = z.object({
  method: z.string(),
  url: z.string(),
  headers: z.record(z.string(), z.string()).optional(),
  body: z.string().optional(),
  secret_ref: z.string().optional(),
})

export const retrySchema = z.object({
  max_attempts: z.number().int(),
  backoff_base_seconds: z.number().int(),
})

export const taskSchema = z.object({
  id: z.guid(),
  name: z.string(),
  schedule: scheduleSchema,
  priority: prioritySchema,
  request: httpRequestSchema,
  timeout_seconds: z.number().int(),
  retry: retrySchema,
  status: taskStatusSchema,
  next_run_at: timestampSchema.optional(),
  version: z.number().int(),
  created_at: timestampSchema,
  updated_at: timestampSchema,
})

export const taskPageSchema = z.object({
  tasks: z.array(taskSchema),
  next_cursor: z.string().optional(),
})

export const createTaskRequestSchema = z.strictObject({
  name: z.string(),
  schedule: scheduleSchema,
  priority: prioritySchema,
  request: httpRequestSchema,
  timeout_seconds: z.number().int(),
  retry: retrySchema,
})

export const updateTaskRequestSchema = createTaskRequestSchema.partial()

export type Priority = z.infer<typeof prioritySchema>
export type Schedule = z.infer<typeof scheduleSchema>
export type HttpRequest = z.infer<typeof httpRequestSchema>
export type Retry = z.infer<typeof retrySchema>
export type Task = z.infer<typeof taskSchema>
export type TaskPage = z.infer<typeof taskPageSchema>
export type CreateTaskRequest = z.infer<typeof createTaskRequestSchema>
export type UpdateTaskRequest = z.infer<typeof updateTaskRequestSchema>
