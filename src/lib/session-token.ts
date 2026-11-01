import 'server-only'

import { cookies } from 'next/headers'

import { SESSION_COOKIE } from '@/lib/session'

// With no auth service yet, development falls back to the test JWT from local-env.
export async function readSessionToken() {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(SESSION_COOKIE)?.value
  if (sessionToken) return sessionToken
  return process.env.NODE_ENV === 'development' ? process.env.DEV_JWT : undefined
}
