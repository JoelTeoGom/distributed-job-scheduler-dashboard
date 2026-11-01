import 'server-only'

import type { Transport } from '@/lib/http'
import { readSessionToken } from '@/lib/session-token'
import { resolveUpstreamUrl, UPSTREAM_TIMEOUT_MS } from '@/lib/upstream'

// MSW only lives in the browser, so with mocks on, or without a session, the first render is left to the client.
export async function serverTransport(): Promise<Transport | undefined> {
  if (process.env.NEXT_PUBLIC_API_MOCKS === 'true') return undefined

  const token = await readSessionToken()
  if (!token) return undefined

  return async (path, init) => {
    const upstreamUrl = resolveUpstreamUrl(init.method ?? 'GET', path)
    if (!upstreamUrl) throw new Error(`No upstream route for ${path}`)
    return fetch(upstreamUrl, {
      ...init,
      cache: 'no-store',
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      headers: { ...init.headers, Authorization: `Bearer ${token}` },
    })
  }
}
