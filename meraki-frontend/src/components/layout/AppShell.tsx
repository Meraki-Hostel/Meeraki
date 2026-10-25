import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Menu, Search } from 'lucide-react';
import { useSession } from '@/app/providers/SessionProvider';
import { cn } from '@/lib/cn';
import { IconButton } from '@/components/ui/Button';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { SidebarContent } from './Sidebar';
import { GlobalSearch } from './GlobalSearch';
import { NotificationsMenu } from './NotificationsMenu';
import { UserMenu } from './UserMenu';
import { getUiPrefs, setUiPrefs } from '@/services/uiPreferences';

export function AppShell({ children }: { children?: React.ReactNode }) {
  const { role } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => getUiPrefs().sidebarCollapsed);
  const location = useLocation();

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);
  useEffect(() => { window.scrollTo(0, 0); document.getElementById('main')?.focus({ preventScroll: true }); }, [location.pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSearchOpen((o) => !o); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMobileOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  const toggleCollapse = () => setCollapsed((c) => { setUiPrefs({ sidebarCollapsed: !c }); return !c; });
  if (!role) return null;
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

  return (
    <div className="min-h-dvh bg-ivory">
      <a href="#main" className="sr-only z-[90] rounded-lg bg-espresso px-3 py-2 text-cream focus:not-sr-only focus:fixed focus:left-3 focus:top-3">Skip to content</a>

      <aside className={cn('fixed inset-y-0 left-0 z-30 hidden border-r border-line bg-cream/80 backdrop-blur lg:block', collapsed ? 'w-[76px]' : 'w-64')} aria-label="Sidebar">
        <SidebarContent role={role} collapsed={collapsed} onCollapse={toggleCollapse} />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div className="anim-fade absolute inset-0 bg-espresso/35" onClick={() => setMobileOpen(false)} aria-hidden />
          <aside className="anim-rise absolute inset-y-0 left-0 w-[min(84vw,300px)] border-r border-line bg-cream shadow-[var(--shadow-lift)]" aria-label="Navigation drawer" role="dialog" aria-modal="true">
            <SidebarContent role={role} onNavigate={() => setMobileOpen(false)} onCloseMobile={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className={cn('flex min-h-dvh flex-col', collapsed ? 'lg:pl-[76px]' : 'lg:pl-64')}>
        <header className="sticky top-0 z-20 border-b border-line/70 bg-ivory/85 backdrop-blur">
          <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-2 px-3 sm:px-6">
            <IconButton label="Open navigation" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-expanded={mobileOpen}><Menu className="size-5" /></IconButton>
            <span className="lg:hidden"><BrandLogo compact /></span>
            <button type="button" onClick={() => setSearchOpen(true)}
              className="ml-1 flex h-10 min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-line bg-cream/80 px-3 text-left text-sm text-mute transition-colors hover:border-line-strong sm:max-w-md md:ml-4"
              aria-label="Open search" aria-keyshortcuts="Control+K Meta+K">
              <Search className="size-4 shrink-0" aria-hidden />
              <span className="truncate">{role === 'student' ? 'Search notices, complaints…' : 'Search students, rooms…'}</span>
              <kbd className="ml-auto hidden rounded-md border border-line bg-white px-1.5 py-0.5 text-[11px] text-dust sm:inline">{isMac ? '⌘' : 'Ctrl'} K</kbd>
            </button>
            <div className="ml-auto flex items-center gap-1 sm:gap-2">
              <NotificationsMenu />
              <UserMenu />
            </div>
          </div>
        </header>
        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[1440px] flex-1 px-4 pb-16 pt-6 focus:outline-none sm:px-6 lg:px-8">
          {children ?? <Outlet />}
        </main>
      </div>
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
