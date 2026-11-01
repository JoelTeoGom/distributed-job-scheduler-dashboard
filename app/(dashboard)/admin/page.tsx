import { Shield } from 'lucide-react'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardEmpty, CardHeader } from '@/components/ui/card'
import { PendingSelect } from '@/components/ui/select'
import { PendingStat, StatRow } from '@/components/ui/stat-card'
import { DisabledHint } from '@/components/ui/tooltip'
import { features } from '@/lib/features'

export const metadata: Metadata = { title: 'Platform metrics' }

const EMPTY_TEXT = 'Coming soon with the metrics service.'

function EmptyCard({ title, aside }: { title: string; aside?: ReactNode }) {
  return (
    <Card>
      <CardHeader title={title} aside={aside} />
      <CardEmpty>{EMPTY_TEXT}</CardEmpty>
    </Card>
  )
}

export default function AdminPage() {
  return (
    <>
      <PageHeader
        icon={<Shield />}
        eyebrow="Internal · all tenants"
        title="Platform metrics"
        actions={
          <>
            <div className="w-40">
              <PendingSelect label="Last 24 hours" hint="Metrics coming soon" />
            </div>
            <DisabledHint hint="Metrics coming soon">
              <Button disabled>Grafana ↗</Button>
            </DisabledHint>
          </>
        }
      />

      {features.metrics ? null : (
        <p className="mb-5 rounded-[10px] border border-border bg-surface px-4 py-3 text-muted">
          This page needs the metrics service and an admin role in the JWT. It stays empty until both exist.
        </p>
      )}

      <StatRow>
        <PendingStat label="Jobs · 24h" />
        <PendingStat label="Throughput now" />
        <PendingStat label="Executors" />
        <PendingStat label="Dead rate · 24h" />
      </StatRow>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="lg:col-span-2">
          <EmptyCard title="Jobs started per second" />
        </div>
        <EmptyCard title="Scheduling lag · p99 vs SLO" aside="started_at − scheduled_at" />
        <EmptyCard title="Pending jobs by priority" aside="due now, not claimed" />
        <EmptyCard title="Top tenants · 24h" />
        <EmptyCard title="MySQL shards" />
      </div>
    </>
  )
}
