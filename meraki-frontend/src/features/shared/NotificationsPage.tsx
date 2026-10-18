import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Mail, MailOpen } from 'lucide-react';
import { services } from '@/services';
import { useQuery } from '@/hooks/useQuery';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button, IconButton } from '@/components/ui/Button';
import { FilterSelect } from '@/components/ui/FilterBar';
import { SegmentedControl } from '@/components/ui/Tabs';
import { EmptyState, QueryBoundary, Skeleton } from '@/components/ui/States';
import { formatDateTime, relativeTime, sentenceCase } from '@/lib/format';
import { now } from '@/lib/clock';
import { cn } from '@/lib/cn';
import type { NotificationCategory } from '@/types/domain';

const CATS: NotificationCategory[] = ['payment', 'complaint', 'leave', 'visitor', 'notice', 'event', 'maintenance', 'inventory', 'system'];

export function NotificationsPage() {
  const [view, setView] = useState<'all' | 'unread'>('all');
  const [cat, setCat] = useState('');
  const navigate = useNavigate();
  const q = useQuery(() => services.notifications.list({ category: (cat || undefined) as NotificationCategory | undefined, unreadOnly: view === 'unread' }), [view, cat]);
  const unread = (q.data ?? []).filter((n) => !n.read).length;

  return (
    <>
      <PageHeader title="Notifications" subtitle="Updates for your account. Read state is saved in this browser."
        actions={<Button variant="secondary" icon={<CheckCheck className="size-4" />} disabled={!unread} onClick={() => void services.notifications.markAllRead()} title={unread ? undefined : 'Everything is already read'}>Mark all read</Button>} />
      <Card className="p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <SegmentedControl label="Show" value={view} onChange={setView} options={[{ value: 'all', label: 'All' }, { value: 'unread', label: 'Unread' }]} />
          <FilterSelect label="Categories" value={cat} onChange={setCat} options={CATS.map((c) => ({ value: c, label: sentenceCase(c) }))} />
        </div>
        <QueryBoundary query={q} skeleton={<div className="space-y-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}</div>}>
          {(items) => items.length === 0 ? (
            <EmptyState icon={<Bell className="size-5" />} title={view === 'unread' ? 'No unread notifications' : 'No notifications'} message="New activity on your account will appear here." />
          ) : (
            <ul className="divide-y divide-line/70">
              {items.map((n) => (
                <li key={n.id} className={cn('flex items-start gap-3 py-3.5', !n.read && 'rounded-xl bg-clay-50/40 px-2')}>
                  <span className={cn('mt-2 size-2 shrink-0 rounded-full', n.read ? 'bg-line-strong' : 'bg-clay-600')} aria-hidden />
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => { void services.notifications.markRead(n.id, true); if (n.link) navigate(n.link); }}>
                    <span className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-sm font-semibold text-espresso">{n.title}</span>
                      <span className="text-xs text-mute">{sentenceCase(n.category)} · <time dateTime={n.createdAt} title={formatDateTime(n.createdAt)}>{relativeTime(n.createdAt, now())}</time></span>
                    </span>
                    <span className="mt-0.5 block text-sm text-bark">{n.body}</span>
                  </button>
                  <IconButton size="sm" label={n.read ? 'Mark as unread' : 'Mark as read'} onClick={() => void services.notifications.markRead(n.id, !n.read)}>
                    {n.read ? <Mail className="size-4" /> : <MailOpen className="size-4" />}
                  </IconButton>
                </li>
              ))}
            </ul>
          )}
        </QueryBoundary>
      </Card>
    </>
  );
}
