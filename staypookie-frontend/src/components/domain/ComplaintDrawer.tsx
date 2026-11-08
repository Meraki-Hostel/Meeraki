import { useEffect, useState } from 'react';
import { services } from '@/services';
import type { ComplaintView, StaffView } from '@/services/interfaces';
import type { ComplaintStatus, Priority } from '@/types/domain';
import { useMutation } from '@/hooks/useMutation';
import { useQuery } from '@/hooks/useQuery';
import { Drawer } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Checkbox, Select, Textarea } from '@/components/ui/Field';
import { DescriptionList } from '@/components/ui/Card';
import { StatusBadge, statusOptions } from '@/components/ui/StatusBadge';
import { formatDateTime, sentenceCase } from '@/lib/format';
import { ComplaintTimeline } from './ComplaintTimeline';
import { AttachmentList } from './AttachmentList';

/** Staff-side complaint detail with triage controls, used by Manager and Owner. */
export function ComplaintDrawer({ complaintId, onClose, staff }: { complaintId: string | null; onClose: () => void; staff: StaffView[] }) {
  const q = useQuery(() => (complaintId ? services.complaints.get(complaintId) : Promise.resolve(null)), [complaintId]);
  const c = q.data;
  const [status, setStatus] = useState<ComplaintStatus>('open');
  const [priority, setPriority] = useState<Priority>('medium');
  const [assignee, setAssignee] = useState('');
  const [note, setNote] = useState('');
  const [comment, setComment] = useState('');
  const [internal, setInternal] = useState(false);

  useEffect(() => { if (c) { setStatus(c.status); setPriority(c.priority); setAssignee(c.assigneeStaffId ?? ''); setNote(''); } }, [c?.id, c?.status, c?.priority, c?.assigneeStaffId]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = useMutation((id: string) => services.complaints.update(id, { status, priority, assigneeStaffId: assignee || null, note }), { success: 'Complaint updated. The resident has been notified.', onSuccess: () => setNote('') });
  const addComment = useMutation((id: string) => services.complaints.addComment(id, comment, internal), { success: internal ? 'Internal note added.' : 'Reply sent to resident.', onSuccess: () => setComment('') });

  const dirty = c && (status !== c.status || priority !== c.priority || (assignee || undefined) !== c.assigneeStaffId);
  const propertyStaff = staff.filter((s) => c && s.propertyId === c.propertyId && s.status !== 'inactive');

  return (
    <Drawer open={!!complaintId} onClose={onClose} title={c ? c.title : 'Complaint'}
      description={c && <span className="flex flex-wrap items-center gap-2">{c.ticketNo} <StatusBadge kind="complaint" value={c.status} /> <StatusBadge kind="priority" value={c.priority} /></span>}>
      {!c ? <p className="text-sm text-dust">{q.error ?? 'Loading…'}</p> : (
        <div className="space-y-6">
          <DescriptionList items={[
            { label: 'Resident', value: c.studentName },
            { label: 'Property · room', value: `${c.propertyName}${c.roomNumber ? ` · Room ${c.roomNumber}` : ''}` },
            { label: 'Category', value: sentenceCase(c.category) },
            { label: 'Raised', value: formatDateTime(c.createdAt) },
          ]} />
          <div>
            <h3 className="mb-1 font-sans text-xs font-medium text-dust">Description</h3>
            <p className="whitespace-pre-line text-sm text-espresso">{c.description}</p>
            <AttachmentList complaint={c} />
          </div>

          <section className="rounded-2xl border border-line bg-white/60 p-4" aria-labelledby="triage-h">
            <h3 id="triage-h" className="mb-3 text-base font-semibold">Triage</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value as ComplaintStatus)} options={statusOptions('complaint')} />
              <Select label="Priority" value={priority} onChange={(e) => setPriority(e.target.value as Priority)} options={statusOptions('priority')} />
              <Select label="Assignee" value={assignee} onChange={(e) => setAssignee(e.target.value)} placeholder="Unassigned" error={update.fieldErrors.assigneeStaffId}
                options={propertyStaff.map((s) => ({ value: s.id, label: `${s.name} (${sentenceCase(s.role)})` }))} />
            </div>
            <Textarea className="mt-3" label={status !== c.status ? 'Note for status change (shared with resident)' : 'Reply to resident (optional)'} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
            <div className="mt-3 flex justify-end">
              <Button onClick={() => void update.run(c.id)} loading={update.pending} disabled={!dirty && !note.trim()} title={!dirty && !note.trim() ? 'Change status, priority, assignee or add a note first' : undefined}>Save update</Button>
            </div>
          </section>

          <section aria-labelledby="thread-h">
            <h3 id="thread-h" className="mb-3 text-base font-semibold">Timeline</h3>
            <ComplaintTimeline complaint={c} />
            <div className="mt-4 rounded-2xl border border-line bg-white/60 p-3">
              <Textarea label="Add a comment" hideLabel rows={2} placeholder="Write a reply or an internal note…" value={comment} onChange={(e) => setComment(e.target.value)} error={addComment.fieldErrors.body} />
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <Checkbox label="Internal note (hidden from resident)" checked={internal} onChange={(e) => setInternal(e.target.checked)} />
                <Button size="sm" variant="secondary" onClick={() => void addComment.run(c.id)} loading={addComment.pending} disabled={!comment.trim()}>Post</Button>
              </div>
            </div>
          </section>
        </div>
      )}
    </Drawer>
  );
}

export type { ComplaintView };
