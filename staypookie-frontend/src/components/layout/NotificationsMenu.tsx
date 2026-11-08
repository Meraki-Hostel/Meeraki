import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { services } from '@/services';
import { useQuery } from '@/hooks/useQuery';
import { relativeTime } from '@/lib/format';
import { now } from '@/lib/clock';
import { cn } from '@/lib/cn';
import { IconButton } from '@/components/ui/Button';

export function NotificationsMenu() {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const q = useQuery(() => services.notifications.list(), []);
  const items = q.data ?? [];
  const unread = items.filter((n) => !n.read).length;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <div ref={wrap} className="relative">
      <IconButton label={unread ? `Notifications, ${unread} unread` : 'Notifications'} onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="dialog">
        <Bell className="size-5" />
        {unread > 0 && <span className="absolute right-2 top-2 size-2.5 rounded-full border-2 border-cream bg-brick" aria-hidden />}
      </IconButton>
      {open && (
        <div role="dialog" aria-label="Recent notifications" className="anim-rise absolute right-0 z-50 mt-2 w-[min(92vw,380px)] overflow-hidden rounded-2xl border border-line bg-cream shadow-[var(--shadow-lift)]">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="font-display text-base font-semibold">Notifications</h2>
            <button type="button" disabled={!unread} onClick={() => void services.notifications.markAllRead()} className="inline-flex items-center gap-1 text-xs font-medium text-clay-700 hover:underline disabled:text-mute disabled:no-underline">
              <CheckCheck className="size-3.5" aria-hidden /> Mark all read
            </button>
          </div>
          <ul className="scroll-thin max-h-96 overflow-y-auto">
            {items.length === 0 && <li className="px-4 py-8 text-center text-sm text-dust">You’re all caught up.</li>}
            {items.slice(0, 6).map((n) => (
              <li key={n.id}>
                <button type="button" className={cn('flex w-full gap-3 border-b border-line/60 px-4 py-3 text-left hover:bg-sand/60', !n.read && 'bg-clay-50/50')}
                  onClick={() => { void services.notifications.markRead(n.id, true); setOpen(false); if (n.link) navigate(n.link); }}>
                  <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', n.read ? 'bg-transparent' : 'bg-clay-600')} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-espresso">{n.title}{!n.read && <span className="sr-only"> (unread)</span>}</span>
                    <span className="line-clamp-2 block text-xs text-dust">{n.body}</span>
                    <span className="mt-1 block text-[11px] text-mute">{relativeTime(n.createdAt, now())}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <Link to="/notifications" onClick={() => setOpen(false)} className="block px-4 py-3 text-center text-sm font-medium text-clay-700 hover:bg-sand/60">View all notifications</Link>
        </div>
      )}
    </div>
  );
}
