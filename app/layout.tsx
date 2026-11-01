import { GeistMono } from 'geist/font/mono'
import { GeistSans } from 'geist/font/sans'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import { Providers } from '@/components/providers'

import './globals.css'

export const metadata: Metadata = {
  title: { default: 'Scheduler', template: '%s · Scheduler' },
  description: 'Schedule HTTP calls, follow their runs and retry the ones that failed.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
