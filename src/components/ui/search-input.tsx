'use client'

import { Search } from 'lucide-react'
import { useEffect, useRef } from 'react'

function isTyping(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  )
}

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder: string
  label: string
}

export function SearchInput({ value, onChange, placeholder, label }: SearchInputProps) {
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function focusOnSlash(event: KeyboardEvent) {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return
      event.preventDefault()
      input.current?.focus()
    }

    document.addEventListener('keydown', focusOnSlash)
    return () => document.removeEventListener('keydown', focusOnSlash)
  }, [])

  return (
    <label className="field-control flex min-w-0 flex-1 items-center gap-2.5 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-blue">
      <Search className="size-[15px] shrink-0 text-muted" aria-hidden />
      <span className="sr-only">{label}</span>
      <input
        ref={input}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        className="h-full w-full min-w-0 bg-transparent text-sm outline-none [&::-webkit-search-cancel-button]:hidden"
      />
    </label>
  )
}
