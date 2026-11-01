import type { Metadata } from 'next'

import { CreateTaskForm } from '@/features/tasks/components/task-form'

export const metadata: Metadata = { title: 'New task' }

export default function NewTaskPage() {
  return <CreateTaskForm />
}
