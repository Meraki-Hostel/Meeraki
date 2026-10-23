import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface MenuItem { label: string; icon?: ReactNode; onSelect: () => void; danger?: boolean; disabled?: boolean; hint?: string }
export type MenuEntry = MenuItem | 'separator' | { heading: string };

/** Accessible menu button with arrow-key navigation. */
export function Dropdown({ trigger, items, align = 'right', label, className }: { trigger: (p: { open: boolean; toggle: () => void; id: string }) => ReactNode; items: MenuEntry[]; align?: 'left' | 'right'; label: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const id = useRef(`menu-${Math.random().toString(36).slice(2, 8)}`).current;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); (wrap.current?.querySelector('[aria-haspopup]') as HTMLElement | null)?.focus(); }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const els = Array.from(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? []);
        const i = els.indexOf(document.activeElement as HTMLElement);
        els[(i + (e.key === 'ArrowDown' ? 1 : -1) + els.length) % els.length]?.focus();
      }
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    setTimeout(() => menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus(), 10);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <div ref={wrap} className={cn('relative', className)}>
      {trigger({ open, toggle: () => setOpen((o) => !o), id })}
      {open && (
        <div ref={menu} id={id} role="menu" aria-label={label}
          className={cn('anim-rise absolute z-50 mt-2 min-w-56 overflow-hidden rounded-2xl border border-line bg-cream p-1.5 shadow-[var(--shadow-lift)]', align === 'right' ? 'right-0' : 'left-0')}>
          {items.map((it, i) => {
            if (it === 'separator') return <div key={i} className="my-1 h-px bg-line" role="separator" />;
            if ('heading' in it) return <p key={i} className="px-3 pb-1 pt-2 text-[11px] font-semibold text-mute">{it.heading}</p>;
            return (
              <button key={i} role="menuitem" type="button" disabled={it.disabled} title={it.hint}
                onClick={() => { setOpen(false); it.onSelect(); }}
                className={cn('flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition-colors focus:outline-none focus-visible:bg-sand disabled:opacity-50',
                  it.danger ? 'text-brick hover:bg-brick-wash' : 'text-espresso hover:bg-sand')}>
                {it.icon && <span className="text-dust" aria-hidden>{it.icon}</span>}
                <span className="flex-1">{it.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
