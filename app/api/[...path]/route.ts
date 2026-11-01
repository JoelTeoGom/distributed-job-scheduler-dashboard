import { NextResponse, type NextRequest } from 'next/server'

import { readSessionToken } from '@/lib/session-token'
import { resolveUpstreamUrl, UPSTREAM_TIMEOUT_MS } from '@/lib/upstream'

const forwardedRequestHeaders = ['content-type', 'idempotency-key', 'if-match']
const forwardedResponseHeaders = ['content-type', 'etag', 'location']

function errorResponse(status: number, message: string) {
  return NextResponse.json({ error: message }, { status })
}

async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const upstreamUrl = resolveUpstreamUrl(request.method, `${pathname.replace(/^\/api/, '')}${search}`)
  if (!upstreamUrl) return errorResponse(404, 'not found')

  const token = await readSessionToken()
  if (!token) return errorResponse(401, 'unauthorized')

  const headers = new Headers({ Authorization: `Bearer ${token}` })
  for (const name of forwardedRequestHeaders) {
    const value = request.headers.get(name)
    if (value) headers.set(name, value)
  }

  // Raw bytes: the Task Service hashes the body to check the Idempotency-Key.
  const hasBody = request.method !== 'GET' && request.method !== 'DELETE'
  const body = hasBody ? await request.arrayBuffer() : undefined

  let upstreamResponse: Response
  try {
    upstreamResponse = await fetch(upstreamUrl, {
      method: request.method,
      headers,
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    })
  } catch {
    return errorResponse(502, 'upstream service unavailable')
  }

  const responseHeaders = new Headers()
  for (const name of forwardedResponseHeaders) {
    const value = upstreamResponse.headers.get(name)
    if (value) responseHeaders.set(name, value)
  }

  const isBodyless = upstreamResponse.status === 204 || upstreamResponse.status === 202
  return new NextResponse(isBodyless ? null : upstreamResponse.body, {
    status: upstreamResponse.status,
    headers: responseHeaders,
  })
}

export { proxy as GET, proxy as POST, proxy as PATCH, proxy as DELETE }
