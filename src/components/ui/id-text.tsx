import { CopyIconButton } from '@/components/ui/copy-button'
import { Tooltip } from '@/components/ui/tooltip'
import { truncateId } from '@/lib/format'
import { cn } from '@/lib/utils'

export function IdText({ id, className, copyable = true }: { id: string; className?: string; copyable?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1">
      <Tooltip content={<span className="font-mono">{id}</span>}>
        <span className={cn('font-mono text-[13px] text-muted tabular-nums', className)}>{truncateId(id)}</span>
      </Tooltip>
      {copyable && <CopyIconButton value={id} label="Copy ID" />}
    </span>
  )
}
