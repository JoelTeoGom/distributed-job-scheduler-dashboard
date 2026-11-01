'use client'

import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'
import { Toaster } from 'sonner'

import { TooltipProvider } from '@/components/ui/tooltip'
import { ApiError } from '@/lib/http'

const MOCKS_ENABLED = process.env.NEXT_PUBLIC_API_MOCKS === 'true'
const STALE_TIME_MS = 30_000

function shouldRetry(failureCount: number, error: unknown) {
  return error instanceof ApiError && (error.kind === 'server' || error.kind === 'network') && failureCount < 1
}

function createQueryClient(goToLogin: () => void) {
  function redirectWhenUnauthorized(error: unknown) {
    if (error instanceof ApiError && error.kind === 'unauthorized') goToLogin()
  }

  return new QueryClient({
    queryCache: new QueryCache({ onError: redirectWhenUnauthorized }),
    mutationCache: new MutationCache({ onError: redirectWhenUnauthorized }),
    defaultOptions: { queries: { staleTime: STALE_TIME_MS, retry: shouldRetry } },
  })
}

// Queries must not leave the browser before the service worker controls the page.
function MocksGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(!MOCKS_ENABLED)

  useEffect(() => {
    // Inline on purpose: msw has no server build, so the bundler must drop this from SSR. In the
    // browser it stays a lazy chunk that is only fetched with mocks on.
    if (process.env.NEXT_PUBLIC_API_MOCKS === 'true' && typeof window !== 'undefined') {
      void import('@/mocks/browser')
        .then(({ startMockWorker }) => startMockWorker())
        .then(() => setReady(true))
    }
  }, [])

  return ready ? children : null
}

export function Providers({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [queryClient] = useState(() => createQueryClient(() => router.push('/login')))

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <MocksGate>{children}</MocksGate>
        <Toaster
          position="bottom-right"
          theme="dark"
          toastOptions={{
            style: {
              background: 'var(--surface-2)',
              border: '1px solid var(--border-2)',
              color: 'var(--text)',
              fontFamily: 'var(--font-sans)',
              fontSize: 13,
            },
          }}
        />
      </TooltipProvider>
    </QueryClientProvider>
  )
}
