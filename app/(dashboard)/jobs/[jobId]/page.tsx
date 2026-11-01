import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query'
import type { Metadata } from 'next'

import { JobScreen } from '@/features/jobs/components/job-screen'
import { jobQuery } from '@/features/jobs/queries'
import { serverTransport } from '@/lib/server-transport'

export const metadata: Metadata = { title: 'Job' }

export default async function JobPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params
  const queryClient = new QueryClient()
  const transport = await serverTransport()
  if (transport) await queryClient.prefetchQuery(jobQuery(jobId, transport))

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <JobScreen jobId={jobId} />
    </HydrationBoundary>
  )
}
