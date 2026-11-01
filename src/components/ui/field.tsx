import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface FieldProps {
  id: string
  label: string
  error?: string
  hint?: ReactNode
  className?: string
  children: ReactNode
}

export function Field({ id, label, error, hint, className, children }: FieldProps) {
  return (
    <div className={cn('min-w-0', className)}>
      <label htmlFor={id} className="mb-1.5 block text-[13px] text-muted">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-xs text-red">
          {error}
        </p>
      ) : (
        hint && <p className="mt-1.5 text-xs text-subtle">{hint}</p>
      )}
    </div>
  )
}
