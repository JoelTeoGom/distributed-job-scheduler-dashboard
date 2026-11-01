'use client'

import { Check, Copy } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Tooltip } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

const COPIED_MS = 1500

export function useCopy(value: string) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => () => clearTimeout(timer.current), [])

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      toast.error('Could not copy to the clipboard')
      return
    }
    setCopied(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), COPIED_MS)
  }

  return { copied, copy }
}

export function CopyIconButton({ value, label, className }: { value: string; label: string; className?: string }) {
  const { copied, copy } = useCopy(value)

  return (
    <Tooltip content={label}>
      <button
        type="button"
        aria-label={label}
        onClick={(event) => {
          event.stopPropagation()
          void copy()
        }}
        className={cn(
          'button-press inline-grid size-5 place-items-center rounded-badge text-subtle hover:text-text',
          className,
        )}
      >
        {copied ? <Check className="size-3 text-green" /> : <Copy className="size-3" />}
      </button>
    </Tooltip>
  )
}

export function CopyButton({ value, children }: { value: string; children: ReactNode }) {
  const { copied, copy } = useCopy(value)

  return (
    <Button onClick={() => void copy()}>
      {copied ? <Check className="text-green" /> : <Copy />}
      {children}
    </Button>
  )
}
