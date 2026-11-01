import type { Metadata } from 'next'

import { Button } from '@/components/ui/button'

export const metadata: Metadata = { title: 'Sign in' }

export default function LoginPage() {
  const canStartDevSession = process.env.NODE_ENV === 'development'

  return (
    <main className="mx-auto mt-[20vh] w-full max-w-sm rounded-card border border-border bg-surface p-6 text-center">
      <h1 className="text-base font-medium">Sign in is not available yet</h1>
      <p className="mt-2 text-[13px] leading-5 text-muted">It arrives with the auth service.</p>
      {canStartDevSession && (
        <form action="/api/dev/session" method="post" className="mt-5">
          <Button type="submit" variant="primary">
            Start dev session
          </Button>
        </form>
      )}
    </main>
  )
}
