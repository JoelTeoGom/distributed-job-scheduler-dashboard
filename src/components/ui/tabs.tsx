'use client'

import { Tabs as RadixTabs } from 'radix-ui'
import type { ReactNode } from 'react'

export interface TabDefinition {
  value: string
  label: string
  content: ReactNode
}

export function Tabs({ tabs }: { tabs: TabDefinition[] }) {
  return (
    <RadixTabs.Root defaultValue={tabs[0]?.value}>
      <RadixTabs.List className="mb-[22px] flex gap-[22px] border-b border-border">
        {tabs.map((tab) => (
          <RadixTabs.Trigger
            key={tab.value}
            value={tab.value}
            className="-mb-px border-b-2 border-transparent py-2.5 text-muted hover:text-text data-[state=active]:border-text data-[state=active]:text-text"
          >
            {tab.label}
          </RadixTabs.Trigger>
        ))}
      </RadixTabs.List>
      {tabs.map((tab) => (
        <RadixTabs.Content key={tab.value} value={tab.value}>
          {tab.content}
        </RadixTabs.Content>
      ))}
    </RadixTabs.Root>
  )
}
