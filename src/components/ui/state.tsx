import Link from 'next/link'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'

interface StateMessageProps {
  title: string
  description?: ReactNode
  action?: ReactNode
}

export function StateMessage({ title, description, action }: StateMessageProps) {
  return (
    <div className="grid place-items-center rounded-card border border-border bg-surface px-6 py-16 text-center">
      <h2 className="text-base font-medium">{title}</h2>
      {description && <p className="mt-2 max-w-md text-[13px] leading-5 text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <StateMessage
      title="Something went wrong"
      description="We could not load this page. Check that the services are reachable and try again."
      action={<Button onClick={onRetry}>Retry</Button>}
    />
  )
}

export function NotFoundState({ title, backHref, backLabel }: { title: string; backHref: string; backLabel: string }) {
  return (
    <StateMessage
      title={title}
      description="It does not exist, was deleted, or belongs to another workspace."
      action={
        <Button asChild>
          <Link href={backHref}>{backLabel}</Link>
        </Button>
      }
    />
  )
}
