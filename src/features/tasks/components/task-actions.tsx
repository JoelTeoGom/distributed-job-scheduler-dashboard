'use client'

import { Pause, Pencil, Play, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { ActionsMenu, MenuItem, MenuSeparator } from '@/components/ui/dropdown'

import { useDeleteTask, useSetTaskPaused } from '../hooks'
import type { Task } from '../schemas'

export function DeleteTaskDialog({
  task,
  open,
  onOpenChange,
  onDeleted,
}: {
  task: Task
  open: boolean
  onOpenChange: (open: boolean) => void
  onDeleted?: () => void
}) {
  const deleteTask = useDeleteTask()

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Delete ${task.name}?`}
      description="The task stops running and disappears from every list. Jobs already created keep their history. This cannot be undone."
    >
      <Button onClick={() => onOpenChange(false)}>Cancel</Button>
      <Button
        variant="danger"
        loading={deleteTask.isPending}
        onClick={() =>
          deleteTask.mutate(task, {
            onSuccess: () => {
              onOpenChange(false)
              onDeleted?.()
            },
          })
        }
      >
        {deleteTask.isPending ? 'Deleting…' : 'Delete task'}
      </Button>
    </Dialog>
  )
}

export function TaskRowMenu({ task }: { task: Task }) {
  const setPaused = useSetTaskPaused()
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const isPaused = task.status === 'paused'

  return (
    <>
      <ActionsMenu label={`Actions for ${task.name}`}>
        <MenuItem onSelect={() => setPaused.mutate({ task, paused: !isPaused })}>
          {isPaused ? <Play aria-hidden /> : <Pause aria-hidden />}
          {isPaused ? 'Resume' : 'Pause'}
        </MenuItem>
        <MenuItem asChild>
          <Link href={`/tasks/${task.id}/edit`}>
            <Pencil aria-hidden /> Edit
          </Link>
        </MenuItem>
        <MenuSeparator />
        <MenuItem destructive onSelect={() => setConfirmingDelete(true)}>
          <Trash2 aria-hidden /> Delete task…
        </MenuItem>
      </ActionsMenu>
      <DeleteTaskDialog task={task} open={confirmingDelete} onOpenChange={setConfirmingDelete} />
    </>
  )
}
