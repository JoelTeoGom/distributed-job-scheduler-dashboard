import { toast } from 'sonner'

import { ApiError } from '@/lib/http'

interface NotifyOptions {
  retry?: () => void
  reload?: () => void
}

export function notifyApiError(error: unknown, { retry, reload }: NotifyOptions = {}) {
  const kind = error instanceof ApiError ? error.kind : 'server'

  switch (kind) {
    case 'version-conflict':
      toast.error('This task was changed elsewhere', {
        action: reload ? { label: 'Reload', onClick: reload } : undefined,
      })
      return
    case 'conflict':
      toast.error('Job is no longer in the dead letter')
      return
    case 'idempotency-mismatch':
    case 'validation':
    case 'not-found':
      toast.error((error as ApiError).message)
      return
    case 'unauthorized':
      return
    default:
      toast.error('Something went wrong', { action: retry ? { label: 'Retry', onClick: retry } : undefined })
  }
}
