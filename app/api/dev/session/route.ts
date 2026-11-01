import { createHmac } from 'node:crypto'

import { NextResponse, type NextRequest } from 'next/server'

import { SESSION_COOKIE } from '@/lib/session'

const SESSION_SECONDS = 12 * 60 * 60
const MIN_SECRET_BYTES = 32

function base64Url(value: string | Buffer) {
  return Buffer.from(value).toString('base64url')
}

// The services verify HS256 with the claims tenant_id and exp, both required.
function signToken(tenantId: string, secret: string, expiresAt: number) {
  const unsigned = `${base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${base64Url(
    JSON.stringify({ tenant_id: tenantId, exp: expiresAt }),
  )}`
  return `${unsigned}.${createHmac('sha256', secret).update(unsigned).digest('base64url')}`
}

// Stands in for the auth service, which does not exist yet. Never available outside development.
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  const secret = process.env.JWT_SECRET
  const tenantId = process.env.DEV_TENANT_ID
  if (!secret || Buffer.byteLength(secret) < MIN_SECRET_BYTES || !tenantId) {
    return NextResponse.json({ error: 'set JWT_SECRET and DEV_TENANT_ID in .env.local' }, { status: 500 })
  }

  const response = NextResponse.redirect(new URL('/tasks', request.url), { status: 303 })
  response.cookies.set(SESSION_COOKIE, signToken(tenantId, secret, Math.floor(Date.now() / 1000) + SESSION_SECONDS), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_SECONDS,
  })
  return response
}
