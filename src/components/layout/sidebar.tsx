'use client'

import {
  Bell,
  ChartColumn,
  ChartPie,
  ChevronDown,
  Clock,
  FileText,
  Inbox,
  List,
  Lock,
  Settings,
  Shield,
  Webhook,
  type LucideIcon,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { SoonPill } from '@/components/ui/badge'
import { DisabledHint, Tooltip } from '@/components/ui/tooltip'
import { useDeadJobs } from '@/features/jobs/hooks'
import { features } from '@/lib/features'
import { cn } from '@/lib/utils'

interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  available: boolean
  showsDeadCount?: boolean
}

const navSections: { label: string; items: NavItem[] }[] = [
  {
    label: 'Workspace',
    items: [
      { label: 'Tasks', href: '/tasks', icon: List, available: true },
      { label: 'Runs', href: '/runs', icon: Clock, available: features.globalRuns },
      { label: 'Dead letter', href: '/dead-letter', icon: Inbox, available: true, showsDeadCount: true },
      { label: 'Metrics', href: '/admin', icon: ChartColumn, available: features.metrics },
    ],
  },
  {
    label: 'Configure',
    items: [
      { label: 'Alerts', href: '/alerts', icon: Bell, available: features.alerts },
      { label: 'Callbacks', href: '/callbacks', icon: Webhook, available: features.callbacks },
      { label: 'API keys', href: '/api-keys', icon: Lock, available: features.apiKeys },
      { label: 'Audit log', href: '/audit-log', icon: FileText, available: features.auditLog },
      { label: 'Usage', href: '/usage', icon: ChartPie, available: features.usage },
      { label: 'Settings', href: '/settings', icon: Settings, available: features.settings },
    ],
  },
  {
    label: 'Internal',
    items: [{ label: 'Admin', href: '/admin', icon: Shield, available: true }],
  },
]

const navRowStyles = 'flex h-[34px] items-center gap-[11px] rounded-[7px] px-2.5 text-sm max-lg:justify-center'

function DeadCount() {
  const deadJobs = useDeadJobs()
  const count = deadJobs.data?.pages.reduce((total, page) => total + page.jobs.length, 0) ?? 0
  if (count === 0) return null
  return <span className="ml-auto rounded-full bg-red-bg px-[7px] text-[11px] text-red max-lg:hidden">{count}</span>
}

function NavEntry({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon

  if (!item.available) {
    return (
      <DisabledHint hint="Not available yet">
        <span aria-disabled className={cn(navRowStyles, 'w-full cursor-not-allowed text-subtle')}>
          <Icon className="size-4 shrink-0" strokeWidth={1.6} aria-hidden />
          <span className="max-lg:sr-only">{item.label}</span>
          <SoonPill />
        </span>
      </DisabledHint>
    )
  }

  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={cn(navRowStyles, active ? 'bg-surface-3 text-text' : 'text-muted hover:bg-surface-2 hover:text-text')}
    >
      <Icon className="size-4 shrink-0" strokeWidth={1.6} aria-hidden />
      <span className="max-lg:sr-only">{item.label}</span>
      {item.showsDeadCount && features.counts && <DeadCount />}
    </Link>
  )
}

function WorkspaceSwitcher() {
  return (
    <DisabledHint hint="Not available yet">
      <span
        aria-disabled
        className="mx-1 mb-3.5 flex h-[38px] w-[calc(100%-8px)] cursor-not-allowed items-center justify-between rounded-control border border-border px-2.5 text-[13px] text-subtle max-lg:hidden"
      >
        Workspace
        <ChevronDown className="size-3.5" aria-hidden />
      </span>
    </DisabledHint>
  )
}

function UserBlock() {
  return (
    <Tooltip content="Not available yet">
      <div tabIndex={0} className="mt-auto flex items-center gap-2.5 border-t border-border pt-3.5 pl-2.5 max-lg:justify-center max-lg:pl-0">
        <span
          aria-hidden
          className="size-[26px] shrink-0 rounded-full border border-border-2 bg-[linear-gradient(135deg,#3a3a3a,#1a1a1a)]"
        />
        <span className="min-w-0 max-lg:hidden">
          <span className="block truncate text-[13px] text-muted">Dev session</span>
          <span className="block text-[11px] text-subtle">No auth service yet</span>
        </span>
      </div>
    </Tooltip>
  )
}

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="sticky top-0 flex h-dvh flex-col gap-1 overflow-y-auto border-r border-border bg-bg px-3.5 py-5">
      <Link href="/tasks" className="mb-1 flex items-center gap-2.5 rounded-control px-2.5 pt-1 pb-4 max-lg:justify-center max-lg:px-0">
        <span aria-hidden className="grid size-[22px] shrink-0 place-items-center rounded-badge bg-text">
          <span className="size-[9px] rounded-full border-2 border-black border-t-transparent" />
        </span>
        <span className="text-base font-semibold tracking-[-0.01em] max-lg:sr-only">Scheduler</span>
      </Link>

      <WorkspaceSwitcher />

      <nav aria-label="Main" className="flex flex-col">
        {navSections.map((section) => (
          <div key={section.label} className="flex flex-col gap-0.5">
            <div className="px-2.5 pt-3.5 pb-1.5 text-[11px] tracking-[0.06em] text-subtle uppercase max-lg:sr-only">
              {section.label}
            </div>
            {section.items.map((item) => (
              <NavEntry
                key={item.label}
                item={item}
                active={item.available && (pathname === item.href || pathname.startsWith(`${item.href}/`))}
              />
            ))}
          </div>
        ))}
      </nav>

      <UserBlock />
    </aside>
  )
}
