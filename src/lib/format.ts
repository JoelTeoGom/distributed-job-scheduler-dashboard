import cronstrue from 'cronstrue'
import { differenceInCalendarDays, addDays } from 'date-fns'
import { formatInTimeZone } from 'date-fns-tz'

export const DEAD_LETTER_RETENTION_DAYS = 14

const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const RELATIVE_LIMIT = 7 * DAY

export function formatDateTime(isoTimestamp: string, withSeconds = false): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: withSeconds ? '2-digit' : undefined,
    hourCycle: 'h23',
  }).format(new Date(isoTimestamp))
}

export function formatFullDate(date: Date): string {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
}

export function formatClockMillis(isoTimestamp: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
    hourCycle: 'h23',
  }).format(new Date(isoTimestamp))
}

export function formatUtc(isoTimestamp: string): string {
  return formatInTimeZone(new Date(isoTimestamp), 'UTC', "yyyy-MM-dd HH:mm:ss.SSS 'UTC'")
}

export function formatRelative(isoTimestamp: string, now: number): string {
  const delta = new Date(isoTimestamp).getTime() - now
  const distance = Math.abs(delta)
  if (distance >= RELATIVE_LIMIT) return formatDateTime(isoTimestamp)

  const amount =
    distance < MINUTE
      ? `${Math.max(1, Math.round(distance / SECOND))} s`
      : distance < HOUR
        ? `${Math.round(distance / MINUTE)} min`
        : distance < DAY
          ? `${Math.round(distance / HOUR)} h`
          : `${Math.round(distance / DAY)} d`

  return delta >= 0 ? `in ${amount}` : `${amount} ago`
}

export function formatDuration(milliseconds: number): string {
  if (milliseconds < SECOND) return `${Math.round(milliseconds)} ms`
  if (milliseconds < MINUTE) return `${(milliseconds / SECOND).toFixed(1)} s`
  const totalSeconds = Math.floor(milliseconds / SECOND)
  return `${Math.floor(totalSeconds / 60)} m ${totalSeconds % 60} s`
}

// Configured values are whole seconds, so they read "30 s" and not "30.0 s".
export function formatSeconds(seconds: number): string {
  return seconds < 60 ? `${seconds} s` : formatDuration(seconds * SECOND)
}

export function elapsedBetween(fromIso: string | undefined, toIso: string | undefined): number | undefined {
  if (!fromIso || !toIso) return undefined
  return new Date(toIso).getTime() - new Date(fromIso).getTime()
}

export function formatLag(scheduledAt: string, startedAt: string | undefined): string | undefined {
  const lag = elapsedBetween(scheduledAt, startedAt)
  if (lag === undefined) return undefined
  return `+${formatDuration(Math.max(0, lag))}`
}

export function truncateId(id: string): string {
  if (id.length <= 13) return id
  return `${id.slice(0, 8)}…${id.slice(-4)}`
}

export function retryDeadline(finishedAt: string): Date {
  return addDays(new Date(finishedAt), DEAD_LETTER_RETENTION_DAYS)
}

export function daysUntil(deadline: Date, now: number): number {
  return Math.max(0, differenceInCalendarDays(deadline, new Date(now)))
}

function ordinal(day: number): string {
  const lastTwoDigits = day % 100
  if (lastTwoDigits >= 11 && lastTwoDigits <= 13) return `${day}th`
  const suffixes: Record<number, string> = { 1: 'st', 2: 'nd', 3: 'rd' }
  return `${day}${suffixes[day % 10] ?? 'th'}`
}

const WEEKDAYS = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays']

function isNumber(cronField: string): boolean {
  return /^\d+$/.test(cronField)
}

// cronstrue reads "At 02:00"; the common shapes get the wording of the mockups.
function describeCommonCron(cronExpression: string): string | undefined {
  const [minute, hour, dayOfMonth, month, dayOfWeek] = cronExpression.trim().split(/\s+/)
  if (!minute || !hour || !dayOfMonth || !month || !dayOfWeek || month !== '*') return undefined

  if (isNumber(minute) && hour === '*' && dayOfMonth === '*' && dayOfWeek === '*') {
    return `Every hour at :${minute.padStart(2, '0')}`
  }
  const everyHours = /^\*\/(\d+)$/.exec(hour)?.[1]
  if (minute === '0' && everyHours && dayOfMonth === '*' && dayOfWeek === '*') return `Every ${everyHours} hours`
  if (!isNumber(minute) || !isNumber(hour)) return undefined

  const clock = `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`
  if (dayOfMonth === '*' && dayOfWeek === '*') return `Every day at ${clock}`
  if (dayOfMonth === '*' && isNumber(dayOfWeek)) {
    const weekday = WEEKDAYS[Number(dayOfWeek) % 7]
    return weekday ? `${weekday} at ${clock}` : undefined
  }
  if (isNumber(dayOfMonth) && dayOfWeek === '*') return `${ordinal(Number(dayOfMonth))} of each month at ${clock}`
  return undefined
}

export function describeCron(cronExpression: string): string | undefined {
  const common = describeCommonCron(cronExpression)
  if (common) return common
  try {
    return cronstrue.toString(cronExpression, { use24HourTimeFormat: true, throwExceptionOnParseError: true })
  } catch {
    return undefined
  }
}

// Interval crons fire at the same moments everywhere, so only fixed hours need the timezone.
export function describeSchedule(schedule: {
  type: string
  cron_expr?: string
  run_at?: string
  timezone?: string
}): string {
  const timezone = schedule.timezone ?? 'UTC'

  if (schedule.type === 'at') {
    if (!schedule.run_at) return 'Once'
    return `Once · ${formatInTimeZone(new Date(schedule.run_at), timezone, 'MMM d, yyyy HH:mm')}`
  }

  const cronExpression = schedule.cron_expr ?? ''
  const description = describeCron(cronExpression) ?? cronExpression
  const hourField = cronExpression.trim().split(/\s+/)[1] ?? ''
  return isNumber(hourField) && timezone !== 'UTC' ? `${description} · ${timezone}` : description
}
