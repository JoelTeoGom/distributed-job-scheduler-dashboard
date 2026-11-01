'use client'

import { Check, Minus } from 'lucide-react'
import { Checkbox as RadixCheckbox } from 'radix-ui'

interface CheckboxProps {
  checked: boolean | 'indeterminate'
  onCheckedChange: (checked: boolean) => void
  label: string
}

export function Checkbox({ checked, onCheckedChange, label }: CheckboxProps) {
  return (
    <RadixCheckbox.Root
      checked={checked}
      onCheckedChange={(state) => onCheckedChange(state === true)}
      aria-label={label}
      className="relative z-10 grid size-[15px] place-items-center rounded-[4px] border border-border-2 data-[state=checked]:border-text data-[state=checked]:bg-text data-[state=indeterminate]:border-text data-[state=indeterminate]:bg-text"
    >
      <RadixCheckbox.Indicator className="text-black">
        {checked === 'indeterminate' ? <Minus className="size-3" strokeWidth={3} /> : <Check className="size-3" strokeWidth={3} />}
      </RadixCheckbox.Indicator>
    </RadixCheckbox.Root>
  )
}
