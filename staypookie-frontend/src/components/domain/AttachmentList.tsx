import { useState } from 'react';
import { Paperclip } from 'lucide-react';
import { services } from '@/services';
import type { ComplaintView } from '@/services/interfaces';
import { errorMessage } from '@/services/errors';
import { useToast } from '@/app/providers/ToastProvider';

/** Complaint attachments; each opens through a short-lived signed link from the API. */
export function AttachmentList({ complaint }: { complaint: ComplaintView }) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const files = complaint.attachmentFiles ?? [];
  if (!files.length && !complaint.attachments.length) return null;
  const open = async (id: string) => {
    // Open the tab synchronously so pop-up blockers allow it, then point it at the file.
    const tab = window.open('', '_blank');
    setBusy(id);
    try {
      const url = await services.uploads.fileUrl(id);
      if (tab) tab.location.href = url; else window.location.href = url;
    } catch (e) {
      tab?.close();
      toast.error(errorMessage(e));
    } finally { setBusy(null); }
  };
  const chip = 'inline-flex items-center gap-1 rounded-lg border border-line bg-white px-2 py-1 text-xs text-bark';
  return (
    <ul className="mt-2 flex flex-wrap gap-2">
      {files.length
        ? files.map((f) => (
          <li key={f.id}><button type="button" className={`${chip} hover:border-clay-300 hover:text-clay-700`} disabled={busy === f.id} onClick={() => void open(f.id)}>
            <Paperclip className="size-3" aria-hidden />{f.fileName}<span className="text-dust">· {f.sizeKb} KB</span>
          </button></li>
        ))
        : complaint.attachments.map((a) => <li key={a} className={chip}><Paperclip className="size-3" aria-hidden />{a}</li>)}
    </ul>
  );
}
