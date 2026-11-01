import { setupWorker } from 'msw/browser'

import { handlers } from './handlers'

let workerStarted: Promise<unknown> | undefined

// Strict Mode runs effects twice in development, and MSW can only patch the globals once.
export function startMockWorker() {
  workerStarted ??= setupWorker(...handlers).start({ onUnhandledFrame: 'bypass', quiet: true })
  return workerStarted
}
