import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { BedDouble, Building2, FileText, Megaphone, MessageSquareWarning, Receipt, Search, UserRound, Users } from 'lucide-react';
import { services } from '@/services';
import type { SearchResult } from '@/services/interfaces';
import { useDebounced } from '@/hooks/misc';
import { cn } from '@/lib/cn';

const ICONS: Record<SearchResult['kind'], typeof Search> = { student: UserRound, room: BedDouble, property: Building2, complaint: MessageSquareWarning, staff: Users, page: FileText, notice: Megaphone, payment: Receipt };
const KIND_LABEL: Record<SearchResult['kind'], string> = { student: 'Student', room: 'Room', property: 'Property', complaint: 'Complaint', staff: 'Staff', page: 'Page', notice: 'Notice', payment: 'Receipt' };

export function GlobalSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [active, setActive] = useState(0);
  const dq = useDebounced(q, 120);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  useEffect(() => { if (open) { setQ(''); setActive(0); setTimeout(() => inputRef.current?.focus(), 20); } }, [open]);
  useEffect(() => {
    if (!open) return;
    let alive = true;
    services.search.search(dq).then((r) => { if (alive) { setResults(r); setActive(0); } }).catch(() => alive && setResults([]));
    return () => { alive = false; };
  }, [dq, open]);

  if (!open) return null;
  const go = (r: SearchResult) => { onClose(); navigate(r.link); };

  return createPortal(
    <div className="fixed inset-0 z-[75] flex items-start justify-center p-4 pt-[12vh]">
      <div className="anim-fade absolute inset-0 bg-espresso/30 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div role="dialog" aria-modal="true" aria-label="Search" className="anim-rise relative w-full max-w-xl overflow-hidden rounded-3xl border border-line bg-cream shadow-[var(--shadow-lift)]"
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose();
          else if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(results.length - 1, a + 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
          else if (e.key === 'Enter' && results[active]) { e.preventDefault(); go(results[active]!); }
          else if (e.key === 'Tab') e.preventDefault();
        }}>
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search className="size-5 text-dust" aria-hidden />
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search students, rooms, complaints, pages…"
            role="combobox" aria-expanded="true" aria-controls={listId} aria-activedescendant={results[active] ? `${listId}-${active}` : undefined} aria-label="Search"
            className="h-14 flex-1 bg-transparent text-[15px] text-espresso placeholder:text-mute focus:outline-none" />
          <kbd className="rounded-md border border-line bg-white px-1.5 py-0.5 text-[11px] text-dust">Esc</kbd>
        </div>
        <ul id={listId} role="listbox" aria-label="Search results" className="scroll-thin max-h-[50vh] overflow-y-auto p-2">
          {results.length === 0 && <li className="px-4 py-8 text-center text-sm text-dust">No matches for “{q}”. Try a name, room number or ticket ID.</li>}
          {results.map((r, i) => {
            const Icon = ICONS[r.kind];
            return (
              <li key={`${r.kind}-${r.id}`} id={`${listId}-${i}`} role="option" aria-selected={i === active}
                onMouseEnter={() => setActive(i)} onClick={() => go(r)}
                className={cn('flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5', i === active && 'bg-sand')}>
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white text-clay-600" aria-hidden><Icon className="size-4" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-espresso">{r.title}</span>
                  <span className="block truncate text-xs text-dust">{r.subtitle}</span>
                </span>
                <span className="text-[11px] text-mute">{KIND_LABEL[r.kind]}</span>
              </li>
            );
          })}
        </ul>
        <p className="border-t border-line px-4 py-2 text-[11px] text-dust">↑ ↓ to move · Enter to open · Results are limited to what your role can see</p>
      </div>
    </div>,
    document.body,
  );
}
