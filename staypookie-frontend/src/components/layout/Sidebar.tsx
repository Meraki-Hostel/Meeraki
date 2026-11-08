import { NavLink } from 'react-router-dom';
import { PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { Role } from '@/types/domain';
import { BrandLogo, BrandMark } from '@/components/brand/BrandLogo';
import { IconButton } from '@/components/ui/Button';
import { HELP_ITEM, NAV, type NavItem } from './nav';
import { useNavBadges } from './useNavBadges';
import { routeAvailable } from '@/lib/features';

function Item({ item, collapsed, badge, onNavigate }: { item: NavItem; collapsed: boolean; badge?: number; onNavigate?: () => void }) {
  const Icon = item.icon;
  return (
    <NavLink to={item.to} onClick={onNavigate} title={collapsed ? item.label : undefined}
      className={({ isActive }) => cn('group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
        isActive ? 'bg-clay-50 text-espresso shadow-[inset_0_0_0_1px_var(--color-clay-100)]' : 'text-bark hover:bg-sand/70 hover:text-espresso', collapsed && 'justify-center px-0')}>
      {({ isActive }) => (
        <>
          <Icon className={cn('size-[18px] shrink-0', isActive ? 'text-clay-600' : 'text-dust group-hover:text-bark')} aria-hidden />
          <span className={cn('flex-1 truncate', collapsed && 'sr-only')}>{item.label}</span>
          {!!badge && (
            <span className={cn('rounded-full bg-clay-600 px-1.5 py-px text-[11px] font-semibold tabular-nums text-white', collapsed && 'absolute right-1 top-1 px-1 text-[9px]')}
              aria-label={`${badge} pending`}>{badge}</span>
          )}
        </>
      )}
    </NavLink>
  );
}

export function SidebarContent({ role, collapsed = false, onNavigate, onCollapse, onCloseMobile }: { role: Role; collapsed?: boolean; onNavigate?: () => void; onCollapse?: () => void; onCloseMobile?: () => void }) {
  const badges = useNavBadges(role);
  return (
    <div className="flex h-full flex-col">
      <div className={cn('flex h-16 items-center gap-2 px-4', collapsed && 'justify-center px-2')}>
        {collapsed ? <BrandMark /> : <BrandLogo />}
        {onCloseMobile && <IconButton label="Close navigation" className="ml-auto" onClick={onCloseMobile}><X className="size-5" /></IconButton>}
      </div>
      <nav aria-label="Main" className="scroll-thin flex-1 space-y-5 overflow-y-auto px-3 pb-4 pt-2">
        {NAV[role].map((g) => ({ ...g, items: g.items.filter((it) => routeAvailable(it.to)) })).filter((g) => g.items.length).map((g, i) => (
          <div key={i}>
            {g.heading && !collapsed && <p className="mb-1.5 px-3 text-[11px] font-semibold text-mute">{g.heading}</p>}
            {g.heading && collapsed && <div className="mx-3 mb-2 h-px bg-line" />}
            <ul className="space-y-0.5">{g.items.map((it) => <li key={it.to}><Item item={it} collapsed={collapsed} badge={it.badge ? badges[it.badge] : undefined} onNavigate={onNavigate} /></li>)}</ul>
          </div>
        ))}
        <ul><li><Item item={HELP_ITEM} collapsed={collapsed} onNavigate={onNavigate} /></li></ul>
      </nav>
      {!collapsed && (
        <p className="px-6 pb-4 font-display text-[15px] font-light italic leading-snug text-bark/80 [@media(max-height:820px)]:hidden">Happier students.<br />Smoother operations.</p>
      )}
      {onCollapse && (
        <div className={cn('border-t border-line p-3', collapsed && 'flex justify-center')}>
          <button type="button" onClick={onCollapse} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-[13px] text-dust hover:bg-sand/70 hover:text-espresso" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            {collapsed ? <PanelLeftOpen className="size-4" /> : <><PanelLeftClose className="size-4" /> Collapse</>}
          </button>
        </div>
      )}
    </div>
  );
}
