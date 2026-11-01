import { NotFoundState } from '@/components/ui/state'

export default function NotFound() {
  return (
    <main className="mx-auto mt-24 w-full max-w-xl px-4">
      <NotFoundState title="Page not found" backHref="/tasks" backLabel="Back to tasks" />
    </main>
  )
}
