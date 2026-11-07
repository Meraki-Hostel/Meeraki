import type { ComplaintView } from '@/services/interfaces';
import { formatDateTime } from '@/lib/format';
import { StatusBadge, statusLabel } from '@/components/ui/StatusBadge';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/cn';

/** Merges status history and comments into one chronological thread. */
export function ComplaintTimeline({ complaint }: { complaint: ComplaintView }) {
  const entries = [
    ...complaint.history.map((h) => ({ kind: 'status' as const, at: h.at, id: h.id, h })),
    ...complaint.comments.map((c) => ({ kind: 'comment' as const, at: c.createdAt, id: c.id, c })),
  ].sort((a, b) => a.at.localeCompare(b.at));
  return (
    <ol className="space-y-3" aria-label="Complaint timeline">
      {entries.map((e) => e.kind === 'status' ? (
        <li key={e.id} className="flex items-start gap-3 text-sm">
          <span className="mt-1.5 size-2 shrink-0 rounded-full bg-clay-400" aria-hidden />
          <div className="min-w-0">
            <p className="text-espresso"><span className="font-medium">{e.h.changedBy}</span> {e.h.status === 'open' ? 'raised this complaint' : <>marked it <StatusBadge kind="complaint" value={e.h.status} /></>}</p>
            {e.h.note && <p className="text-bark">“{e.h.note}”</p>}
            <p className="text-xs text-mute">{formatDateTime(e.at)}</p>
          </div>
        </li>
      ) : (
        <li key={e.id} className={cn('rounded-2xl border px-3.5 py-3 text-sm', e.c.internal ? 'border-amber/30 bg-amber-wash/60' : e.c.authorRole === 'student' ? 'border-line bg-white/70' : 'border-slate-soft/60 bg-slate-wash/60')}>
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="font-medium text-espresso">{e.c.authorName}</span>
            <span className="text-xs text-dust">{e.c.authorRole === 'student' ? 'Resident' : e.c.authorRole === 'owner' ? 'Owner' : 'Hostel office'}</span>
            {e.c.internal && <Badge tone="amber" dot={false}>Internal note</Badge>}
            <span className="ml-auto text-xs text-mute">{formatDateTime(e.at)}</span>
          </div>
          <p className="whitespace-pre-line text-bark">{e.c.body}</p>
        </li>
      ))}
      {entries.length === 0 && <li className="text-sm text-dust">No updates yet.</li>}
      <li className="sr-only">Current status: {statusLabel('complaint', complaint.status)}</li>
    </ol>
  );
}
