import { Link } from 'react-router-dom';
import { BedDouble, Boxes, Building2, CalendarDays, CreditCard, DoorOpen, Megaphone, MessageSquareWarning, Settings, Star, UserRound, Users, Wrench } from 'lucide-react';
import type { ActivityCategory } from '@/types/domain';
import type { ActivityView } from '@/services/interfaces';
import { formatDateTime, relativeTime } from '@/lib/format';
import { now } from '@/lib/clock';
import { EmptyState } from '@/components/ui/States';

const ICON: Record<ActivityCategory, typeof Users> = {
  student: Users, payment: CreditCard, complaint: MessageSquareWarning, leave: DoorOpen, visitor: UserRound, maintenance: Wrench,
  inventory: Boxes, announcement: Megaphone, event: CalendarDays, room: BedDouble, property: Building2, staff: Users, settings: Settings, feedback: Star,
};

export function ActivityFeed({ items, showProperty, compact }: { items: ActivityView[]; showProperty?: boolean; compact?: boolean }) {
  if (!items.length) return <EmptyState title="No activity yet" message="Actions taken by staff and residents will be logged here." />;
  return (
    <ol className="relative space-y-0">
      {items.map((a, i) => {
        const Icon = ICON[a.category];
        const body = (
          <>
            <span className="relative z-10 grid size-8 shrink-0 place-items-center rounded-full border border-line bg-cream text-clay-600" aria-hidden><Icon className="size-3.5" /></span>
            <span className="min-w-0 flex-1 pb-4">
              <span className="block text-sm text-espresso">{a.message}</span>
              <span className="mt-0.5 block text-xs text-dust">
                {a.actorName}{showProperty && a.propertyName ? ` · ${a.propertyName}` : ''} · <time dateTime={a.createdAt} title={formatDateTime(a.createdAt)}>{compact ? relativeTime(a.createdAt, now()) : formatDateTime(a.createdAt)}</time>
              </span>
            </span>
          </>
        );
        return (
          <li key={a.id} className="relative flex gap-3">
            {i < items.length - 1 && <span className="absolute left-4 top-8 h-[calc(100%-2rem)] w-px bg-line" aria-hidden />}
            {a.link ? <Link to={a.link} className="flex flex-1 gap-3 rounded-lg hover:bg-sand/40">{body}</Link> : <div className="flex flex-1 gap-3">{body}</div>}
          </li>
        );
      })}
    </ol>
  );
}
