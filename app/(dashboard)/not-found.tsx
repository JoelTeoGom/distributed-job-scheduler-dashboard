import { NotFoundState } from '@/components/ui/state'

export default function DashboardNotFound() {
  return <NotFoundState title="Page not found" backHref="/tasks" backLabel="Back to tasks" />
}
