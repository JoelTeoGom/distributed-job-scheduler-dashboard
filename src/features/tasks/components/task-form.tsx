'use client'

import { Pencil, Plus, X } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useId, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useSyncExternalStore } from 'react'

import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Select } from '@/components/ui/select'
import { describeCron } from '@/lib/format'
import { notifyApiError } from '@/lib/notify'
import { cn } from '@/lib/utils'

import type { TaskSubmission } from '../api'
import {
  emptyTaskForm,
  fieldErrorsFromApi,
  taskFieldId,
  taskFieldOrder,
  taskToFormValues,
  toCreateRequest,
  toUpdateRequest,
  validateTaskForm,
  type TaskFieldErrors,
  type TaskFieldName,
  type TaskFormValues,
} from '../form'
import { useCreateTask, useUpdateTask } from '../hooks'
import type { Priority, Task } from '../schemas'

const priorityOptions = [
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'normal', label: 'Normal' },
  { value: 'low', label: 'Low' },
] as const

const methodOptions = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((method) => ({ value: method, label: method }))

const subscribeToNothing = () => () => {}

function useTimezones() {
  return useSyncExternalStore(
    subscribeToNothing,
    () => timezones,
    () => noTimezones,
  )
}

const noTimezones: string[] = []
const timezones = typeof Intl.supportedValuesOf === 'function' ? ['UTC', ...Intl.supportedValuesOf('timeZone')] : []

function ScheduleTypeToggle({
  value,
  onChange,
}: {
  value: TaskFormValues['scheduleType']
  onChange: (value: TaskFormValues['scheduleType']) => void
}) {
  const options = [
    { value: 'cron', label: 'Recurring (cron)' },
    { value: 'at', label: 'Once' },
  ] as const

  return (
    <div role="radiogroup" aria-label="Schedule type" className="inline-flex justify-self-start rounded-control border border-border-2 p-0.5">
      {options.map((option) => (
        <label
          key={option.value}
          className={cn(
            'cursor-pointer rounded-badge px-3 py-1 text-[13px] has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-blue',
            value === option.value ? 'bg-surface-3 text-text' : 'text-muted hover:text-text',
          )}
        >
          <input
            type="radio"
            name="schedule-type"
            className="sr-only"
            checked={value === option.value}
            onChange={() => onChange(option.value)}
          />
          {option.label}
        </label>
      ))}
    </div>
  )
}

function useTaskFormState(initialValues: TaskFormValues) {
  const [values, setValues] = useState(initialValues)
  const [errors, setErrors] = useState<TaskFieldErrors>({})

  function setField<Field extends keyof TaskFormValues>(field: Field, value: TaskFormValues[Field]) {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors((current) => {
      if (!(field in current)) return current
      const remaining = { ...current }
      delete remaining[field as TaskFieldName]
      return remaining
    })
  }

  function showErrors(nextErrors: TaskFieldErrors) {
    setErrors(nextErrors)
    const firstField = taskFieldOrder.find((field) => nextErrors[field])
    if (firstField) requestAnimationFrame(() => document.getElementById(taskFieldId(firstField))?.focus())
  }

  return { values, errors, setValues, setField, showErrors }
}

interface TaskFormFieldsProps {
  state: ReturnType<typeof useTaskFormState>
  onSubmit: (event: FormEvent) => void
  submitLabel: string
  submittingLabel: string
  submitting: boolean
  cancelHref: string
}

function TaskFormFields({ state, onSubmit, submitLabel, submittingLabel, submitting, cancelHref }: TaskFormFieldsProps) {
  const { values, errors, setField, setValues } = state
  const timezoneOptions = useTimezones()
  const timezoneListId = useId()
  const nextHeaderId = useRef(0)

  function inputProps(field: TaskFieldName & keyof TaskFormValues) {
    return {
      id: taskFieldId(field),
      'aria-invalid': errors[field] ? true : undefined,
      'aria-describedby': errors[field] ? `${taskFieldId(field)}-error` : undefined,
      className: 'field-control',
      value: values[field] as string,
      onChange: (event: ChangeEvent<HTMLInputElement>) => setField(field, event.target.value),
    }
  }

  function updateHeader(rowId: string, change: { name?: string; value?: string }) {
    setField(
      'headers',
      values.headers.map((header) => (header.rowId === rowId ? { ...header, ...change } : header)),
    )
  }

  function addHeader() {
    nextHeaderId.current += 1
    setValues((current) => ({
      ...current,
      headers: [...current.headers, { rowId: `new-${nextHeaderId.current}`, name: '', value: '' }],
    }))
  }

  const cronDescription = values.cronExpression.trim() ? describeCron(values.cronExpression) : undefined

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <Card>
        <CardHeader title="General" />
        <div className="grid gap-4 p-[18px] md:grid-cols-[1.6fr_1fr]">
          <Field id={taskFieldId('name')} label="Name" error={errors.name}>
            <input {...inputProps('name')} autoComplete="off" placeholder="stripe-reconciliation" />
          </Field>
          <Field id={taskFieldId('priority')} label="Priority" error={errors.priority}>
            <Select
              id={taskFieldId('priority')}
              label="Priority"
              value={values.priority}
              options={priorityOptions}
              onValueChange={(value) => setField('priority', value as Priority)}
            />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="Schedule" />
        <div className="grid gap-4 p-[18px]">
          <ScheduleTypeToggle value={values.scheduleType} onChange={(value) => setField('scheduleType', value)} />
          <div className="grid gap-4 md:grid-cols-[1.6fr_1fr]">
            {values.scheduleType === 'cron' ? (
              <Field
                id={taskFieldId('cronExpression')}
                label="Cron expression"
                error={errors.cronExpression}
                hint={cronDescription ?? 'Five fields: minute, hour, day of month, month, day of week'}
              >
                <input
                  {...inputProps('cronExpression')}
                  className="field-control font-mono"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="*/15 * * * *"
                />
              </Field>
            ) : (
              <Field id={taskFieldId('runAtLocal')} label="Run at" error={errors.runAtLocal} hint="In the timezone on the right">
                <input {...inputProps('runAtLocal')} type="datetime-local" />
              </Field>
            )}
            <Field id={taskFieldId('timezone')} label="Timezone" error={errors.timezone}>
              <input {...inputProps('timezone')} list={timezoneListId} autoComplete="off" spellCheck={false} />
              <datalist id={timezoneListId}>
                {timezoneOptions.map((timezone) => (
                  <option key={timezone} value={timezone} />
                ))}
              </datalist>
            </Field>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Request" />
        <div className="grid gap-4 p-[18px]">
          <div className="grid gap-4 md:grid-cols-[140px_1fr]">
            <Field id={taskFieldId('method')} label="Method" error={errors.method}>
              <Select
                id={taskFieldId('method')}
                label="Method"
                value={values.method}
                options={methodOptions}
                className="font-mono"
                onValueChange={(value) => setField('method', value)}
              />
            </Field>
            <Field id={taskFieldId('url')} label="URL" error={errors.url}>
              <input
                {...inputProps('url')}
                type="url"
                className="field-control font-mono"
                autoComplete="off"
                spellCheck={false}
                placeholder="https://api.example.com/hook"
              />
            </Field>
          </div>

          <Field
            id={taskFieldId('headers')}
            label="Headers"
            error={errors.headers}
            hint="Non-sensitive headers only. Credentials go in a secret."
          >
            <div className="flex flex-col gap-2">
              {values.headers.map((header, headerIndex) => (
                <div key={header.rowId} className="flex gap-2">
                  <input
                    id={headerIndex === 0 ? taskFieldId('headers') : undefined}
                    aria-label={`Header ${headerIndex + 1} name`}
                    aria-invalid={errors.headers ? true : undefined}
                    className="field-control font-mono"
                    placeholder="Content-Type"
                    spellCheck={false}
                    value={header.name}
                    onChange={(event) => updateHeader(header.rowId, { name: event.target.value })}
                  />
                  <input
                    aria-label={`Header ${headerIndex + 1} value`}
                    className="field-control font-mono"
                    placeholder="application/json"
                    spellCheck={false}
                    value={header.value}
                    onChange={(event) => updateHeader(header.rowId, { value: event.target.value })}
                  />
                  <Button
                    size="icon"
                    className="h-[38px] w-[38px]"
                    aria-label={`Remove header ${headerIndex + 1}`}
                    onClick={() =>
                      setField(
                        'headers',
                        values.headers.filter((row) => row.rowId !== header.rowId),
                      )
                    }
                  >
                    <X />
                  </Button>
                </div>
              ))}
              <div>
                <Button onClick={addHeader}>
                  <Plus /> Add header
                </Button>
              </div>
            </div>
          </Field>

          <Field id="task-body" label="Body">
            <textarea
              id="task-body"
              rows={5}
              spellCheck={false}
              className="field-control h-auto py-2.5 font-mono text-[13px]"
              value={values.body}
              onChange={(event) => setField('body', event.target.value)}
            />
          </Field>

          <Field
            id={taskFieldId('secretRef')}
            label="Secret"
            error={errors.secretRef}
            hint="Name of the secret holding the credentials, never the secret itself."
          >
            <input {...inputProps('secretRef')} className="field-control font-mono" autoComplete="off" spellCheck={false} />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="Retries and timeout" />
        <div className="grid gap-4 p-[18px] md:grid-cols-3">
          <Field id={taskFieldId('timeoutSeconds')} label="Timeout (seconds)" error={errors.timeoutSeconds}>
            <input {...inputProps('timeoutSeconds')} inputMode="numeric" className="field-control tabular-nums" />
          </Field>
          <Field id={taskFieldId('maxAttempts')} label="Max attempts" error={errors.maxAttempts}>
            <input {...inputProps('maxAttempts')} inputMode="numeric" className="field-control tabular-nums" />
          </Field>
          <Field
            id={taskFieldId('backoffBaseSeconds')}
            label="Backoff base (seconds)"
            error={errors.backoffBaseSeconds}
            hint="Retry n waits base × 2ⁿ⁻¹"
          >
            <input {...inputProps('backoffBaseSeconds')} inputMode="numeric" className="field-control tabular-nums" />
          </Field>
        </div>
      </Card>

      <div className="flex justify-end gap-2">
        <Button asChild>
          <Link href={cancelHref}>Cancel</Link>
        </Button>
        <Button type="submit" variant="primary" loading={submitting}>
          {submitting ? submittingLabel : submitLabel}
        </Button>
      </div>
    </form>
  )
}

export function CreateTaskForm() {
  const state = useTaskFormState(emptyTaskForm)
  const createTask = useCreateTask()
  // A retry must repeat the same key and the same bytes; a changed form is a new submission.
  const submission = useRef<TaskSubmission | null>(null)

  function submitTask(taskSubmission: TaskSubmission) {
    createTask.mutate(taskSubmission, {
      onError: (error) => {
        const fieldErrors = fieldErrorsFromApi(error)
        if (fieldErrors) state.showErrors(fieldErrors)
        else notifyApiError(error, { retry: () => submitTask(taskSubmission) })
      },
    })
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const errors = validateTaskForm(state.values)
    if (Object.keys(errors).length > 0) {
      state.showErrors(errors)
      return
    }

    const serializedBody = JSON.stringify(toCreateRequest(state.values))
    if (submission.current?.serializedBody !== serializedBody) {
      submission.current = { serializedBody, idempotencyKey: crypto.randomUUID() }
    }
    submitTask(submission.current)
  }

  return (
    <>
      <PageHeader icon={<Plus />} eyebrow="Workspace" title="New task" />
      <TaskFormFields
        state={state}
        onSubmit={handleSubmit}
        submitLabel="Create task"
        submittingLabel="Creating…"
        submitting={createTask.isPending}
        cancelHref="/tasks"
      />
    </>
  )
}

export function EditTaskForm({ task }: { task: Task }) {
  const router = useRouter()
  // Pinned on load: a background refetch must not hide that the task changed under the form.
  const [loadedTask] = useState(task)
  const state = useTaskFormState(taskToFormValues(loadedTask))
  const updateTask = useUpdateTask(loadedTask.id, loadedTask.version)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const unchangedRunAtLocal = taskToFormValues(loadedTask).runAtLocal
    const errors = validateTaskForm(state.values, unchangedRunAtLocal)
    if (Object.keys(errors).length > 0) {
      state.showErrors(errors)
      return
    }

    const changes = toUpdateRequest(state.values, loadedTask)
    if (Object.keys(changes).length === 0) {
      router.push(`/tasks/${loadedTask.id}`)
      return
    }

    updateTask.mutate(changes, {
      onError: (error) => {
        const fieldErrors = fieldErrorsFromApi(error)
        if (fieldErrors) state.showErrors(fieldErrors)
        else notifyApiError(error, { reload: () => window.location.reload() })
      },
    })
  }

  return (
    <>
      <PageHeader
        icon={<Pencil />}
        eyebrow={`Edit task · version ${loadedTask.version}`}
        title={loadedTask.name}
      />
      <TaskFormFields
        state={state}
        onSubmit={handleSubmit}
        submitLabel="Save changes"
        submittingLabel="Saving…"
        submitting={updateTask.isPending}
        cancelHref={`/tasks/${loadedTask.id}`}
      />
    </>
  )
}
