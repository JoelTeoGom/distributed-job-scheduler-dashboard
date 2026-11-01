import type { ReactNode } from 'react'

import { Sidebar } from '@/components/layout/sidebar'
import { Topbar } from '@/components/layout/topbar'

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh grid-cols-[64px_minmax(0,1fr)] lg:grid-cols-[248px_minmax(0,1fr)]">
      <Sidebar />
      <div className="flex min-w-0 flex-col">
        <Topbar />
        <main className="mx-auto w-full max-w-[1180px] px-8 pt-9 pb-12">{children}</main>
      </div>
    </div>
  )
}
