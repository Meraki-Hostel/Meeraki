import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Bell, Building2, Check, ChevronDown, CircleHelp, FlaskConical, Gem, LogOut, Menu as MenuIcon, MoreHorizontal, Plus, RotateCcw, Search, Settings, Siren, X } from 'lucide-react'
import { OWNER_NAME, useStore } from '../../store/AppStore'
import type { Role } from '../../lib/types'
import { cn, formatDateLong, timeAgo, todayStart, weekday } from '../../lib/utils'
import { locationOf } from '../../store/selectors'
import { Avatar, Button, PageSkeleton, Select, useConfirm, useToast } from '../ui'
import { useModals } from '../domain/ModalsProvider'
import { NAV, STUDENT_TABS, type NavGroup } from './nav'
import { buildNotifications } from './notifications'
import { CommandSearch } from './CommandSearch'

export function AppShell({ role }: { role: Role }) {
  const { session, setRole } = useStore()
  const location = useLocation()
  const [mobileNav, setMobileNav] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const first = useRef(true)
  const mainRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (session.role !== role) setRole(role)
  }, [role, session.role, setRole])

  // Short skeleton on page change to mimic data loading
  useLayoutEffect(() => {
    setMobileNav(false)
    window.scrollTo(0, 0)
    mainRef.current?.scrollTo(0, 0)
    if (first.current) {
      first.current = false
      return
    }
    setLoading(true)
    const t = setTimeout(() => setLoading(false), 260)
    return () => clearTimeout(t)
  }, [location.pathname])

  useEffect(() => {
    if (role === 'student') return
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [role])

  return (
    <div className="min-h-dvh lg:h-dvh lg:p-4 xl:p-6">
      {/* Floating app frame on desktop; full-bleed on mobile */}
      <div className="mx-auto lg:flex lg:h-full lg:max-w-[1680px] lg:overflow-hidden lg:rounded-frame lg:bg-white lg:shadow-frame lg:ring-1 lg:ring-slate-200/60">
        <aside className="hidden w-[260px] shrink-0 flex-col border-r border-slate-100 lg:flex">
          <SidebarContent role={role} />
        </aside>

        {/* Mobile drawer */}
        {mobileNav && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 animate-fade-in bg-slate-900/40" onClick={() => setMobileNav(false)} />
            <aside className="relative flex h-full w-72 max-w-[85vw] animate-slide-in-left flex-col rounded-r-frame bg-white shadow-pop">
              <button onClick={() => setMobileNav(false)} className="absolute top-5 right-3 rounded-full p-1.5 text-slate-400 hover:bg-slate-100" aria-label="Close menu">
                <X size={18} />
              </button>
              <SidebarContent role={role} />
            </aside>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar role={role} onMenu={() => setMobileNav(true)} onSearch={() => setSearchOpen(true)} />
          <main ref={mainRef} className="scrollbar-thin lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
            <div className={cn('mx-auto w-full max-w-[1400px] px-4 pt-5 pb-10 sm:px-6 lg:px-8 lg:pt-2', role === 'student' && 'max-w-5xl pb-28 lg:pb-10')}>
              {loading ? <PageSkeleton /> : <div key={location.pathname} className="animate-fade-in"><Outlet /></div>}
            </div>
          </main>
        </div>
      </div>

      {role === 'student' && <StudentTabBar onMore={() => setMobileNav(true)} />}
      {searchOpen && <CommandSearch role={role} onClose={() => setSearchOpen(false)} />}
    </div>
  )
}

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex size-9 items-center justify-center rounded-xl bg-ink text-white">
        <svg viewBox="0 0 32 32" className="size-5" fill="currentColor"><path d="M6 24V12.5l10-5.5 10 5.5V24h-6.5v-7h-7v7z" /></svg>
      </div>
      <div className="leading-tight">
        <div className="text-[17px] font-semibold tracking-tight text-slate-900">StayPookie</div>
        <div className="text-[11px] text-slate-400">Hostel OS</div>
      </div>
    </div>
  )
}

const navItemCls = 'group flex h-10 items-center gap-3 rounded-xl px-3 text-[14px] transition-colors'

function SidebarContent({ role }: { role: Role }) {
  const { data, session } = useStore()
  const toast = useToast()
  const groups: NavGroup[] = NAV[role]
  const ctx = { propertyId: session.managerPropertyId, studentId: session.studentId }
  const student = data.students.find((s) => s.id === session.studentId)
  const property = data.properties.find((p) => p.id === (role === 'student' ? student?.propertyId : session.managerPropertyId))
  const settingsTo = role === 'student' ? '/student/profile' : null
  return (
    <>
      <div className="flex h-20 shrink-0 items-center px-6">
        <Logo />
      </div>
      {role !== 'owner' && property && (
        <div className="mx-4 mb-3 flex items-center gap-2.5 rounded-2xl bg-slate-50 px-3 py-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white text-slate-500 ring-1 ring-slate-200/70">
            <Building2 size={15} />
          </span>
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold text-slate-800">{property.name}</div>
            <div className="truncate text-[11px] text-slate-500">
              {property.area}, {property.city}
            </div>
          </div>
        </div>
      )}
      <nav className="scrollbar-thin flex-1 overflow-y-auto px-4 pt-2 pb-4">
        {groups.map((g, gi) => (
          <div key={gi} className={cn(gi > 0 && 'mt-5')}>
            {(g.label ?? (gi === 0 ? 'Main Menu' : null)) && (
              <div className={cn('mb-2 px-3 text-[12.5px] font-semibold', gi === 0 ? 'text-slate-900' : 'text-slate-400')}>{g.label ?? 'Main Menu'}</div>
            )}
            <div className="space-y-0.5">
              {g.items.map((it) => {
                const n = it.badge?.(data, ctx) ?? 0
                return (
                  <NavLink
                    key={it.to}
                    to={it.to}
                    end={it.end}
                    className={({ isActive }) =>
                      cn(
                        navItemCls,
                        it.tone === 'danger'
                          ? isActive ? 'bg-rose-50 font-semibold text-rose-700' : 'font-medium text-rose-600 hover:bg-rose-50'
                          : isActive ? 'bg-slate-100/80 font-semibold text-ink' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <it.icon size={19} strokeWidth={isActive ? 2.1 : 1.7} className={cn(it.tone !== 'danger' && (isActive ? 'text-ink' : 'text-slate-400 group-hover:text-slate-700'))} />
                        <span className="flex-1 truncate">{it.label}</span>
                        {n > 0 && <span className={cn('rounded-full px-1.5 text-[11px] font-semibold tabular', isActive ? 'bg-ink text-white' : 'bg-slate-100 text-slate-500')}>{n}</span>}
                      </>
                    )}
                  </NavLink>
                )
              })}
            </div>
          </div>
        ))}
        <QuickActionCard role={role} />
      </nav>
      <div className="space-y-0.5 border-t border-slate-100 px-4 py-3">
        <button onClick={() => toast.info('Help Center', { description: 'Reach the StayPookie team at support@staypookie.app — this is a prototype, so no ticket is created.' })} className={cn(navItemCls, 'w-full text-slate-500 hover:bg-slate-50 hover:text-slate-900')}>
          <CircleHelp size={19} strokeWidth={1.7} className="text-slate-400" />
          Help Center
        </button>
        {settingsTo && (
          <NavLink to={settingsTo} className={cn(navItemCls, 'text-slate-500 hover:bg-slate-50 hover:text-slate-900')}>
            <Settings size={19} strokeWidth={1.7} className="text-slate-400" />
            Settings
          </NavLink>
        )}
        <button onClick={() => toast.info('Sign-in isn’t built yet', { description: 'Use the profile menu at the top right to switch between demo roles.' })} className={cn(navItemCls, 'w-full text-slate-500 hover:bg-slate-50 hover:text-slate-900')}>
          <LogOut size={19} strokeWidth={1.7} className="text-slate-400" />
          Sign Out
        </button>
        <div className="flex items-center gap-1.5 px-3 pt-2 text-[11px] text-slate-400">
          <FlaskConical size={12} className="shrink-0" />
          Prototype — all data is simulated
        </div>
      </div>
    </>
  )
}

function QuickActionCard({ role }: { role: Role }) {
  const { data, session } = useStore()
  const modals = useModals()
  const navigate = useNavigate()
  const student = data.students.find((s) => s.id === session.studentId)
  const propertyId = role === 'student' ? student?.propertyId : session.managerPropertyId
  const faces =
    role === 'owner'
      ? data.properties.slice(0, 3).map((p) => p.managerName)
      : data.students.filter((s) => s.propertyId === propertyId && s.status === 'active' && s.id !== session.studentId).slice(0, 3).map((s) => s.name)
  const cfg =
    role === 'manager'
      ? { title: 'Quick add new students', cta: 'Add Student', icon: Plus, onClick: () => modals.open({ type: 'addStudent' }) }
      : role === 'owner'
        ? { title: 'Grow your portfolio with StayPookie Pro', cta: 'View plans', icon: Gem, onClick: () => navigate('/owner/plans') }
        : { title: 'Something not working in your room?', cta: 'Raise complaint', icon: Plus, onClick: () => student && modals.open({ type: 'complaint', studentId: student.id, studentMode: true }) }
  return (
    <div className="mt-6 rounded-3xl border border-slate-100 bg-gradient-to-b from-slate-50 to-white px-4 pt-5 pb-4 text-center">
      <div className="flex justify-center -space-x-2">
        {faces.map((n, i) => (
          <Avatar key={n} name={n} size={i === 1 ? 'md' : 'sm'} className={cn('ring-2 ring-white', i === 1 && 'z-10 -mt-1')} />
        ))}
      </div>
      <p className="mx-auto mt-3 max-w-[11rem] text-[14px] leading-snug font-medium text-slate-900">{cfg.title}</p>
      <Button variant="primary" size="sm" icon={cfg.icon} onClick={cfg.onClick} className="mt-3.5">
        {cfg.cta}
      </Button>
    </div>
  )
}

function pageTitle(role: Role, path: string) {
  const items = NAV[role].flatMap((g) => g.items.map((it) => ({ ...it, group: g.label })))
  const hit = items.find((it) => (it.end ? path === it.to : path === it.to || path.startsWith(`${it.to}/`)))
  return hit?.group ?? hit?.label ?? 'Main Menu'
}

function Topbar({ role, onMenu, onSearch }: { role: Role; onMenu: () => void; onSearch: () => void }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b border-slate-200/70 bg-white/85 px-4 backdrop-blur-md sm:px-6 lg:static lg:h-24 lg:gap-6 lg:border-0 lg:bg-white lg:px-8 lg:backdrop-blur-none">
      <button onClick={onMenu} className={cn('-ml-1 rounded-full p-2 text-slate-500 hover:bg-slate-100 lg:hidden', role === 'student' && 'hidden')} aria-label="Open menu">
        <MenuIcon size={20} />
      </button>
      <div className={cn('lg:hidden', role !== 'student' && 'hidden sm:block')}>
        <Logo />
      </div>
      <div className="hidden w-52 shrink-0 leading-tight lg:block">
        <div className="truncate text-[19px] font-semibold tracking-tight text-slate-900">{pageTitle(role, pathname)}</div>
        <div className="mt-1 text-[12.5px] text-slate-400">{weekday(todayStart())}, {formatDateLong(todayStart())}</div>
      </div>
      {role !== 'student' ? (
        <button onClick={onSearch} className="flex h-10 min-w-0 flex-1 items-center gap-2.5 rounded-full border border-slate-100 bg-slate-50 pr-1.5 pl-4 text-sm text-slate-400 transition-colors hover:border-slate-200 hover:bg-white sm:max-w-md lg:h-12 lg:max-w-lg">
          <Search size={18} className="text-slate-500" />
          <span className="truncate">Search students, rooms, complaints…</span>
          <kbd className="ml-auto hidden h-8 items-center rounded-full bg-white px-3 font-sans text-[12px] font-medium text-slate-400 ring-1 ring-slate-200/70 sm:flex lg:h-9">⌘K</kbd>
        </button>
      ) : (
        <div className="flex-1" />
      )}
      <div className="ml-auto flex items-center gap-2 lg:gap-3">
        {role === 'student' && (
          <button onClick={() => navigate('/student/emergency')} className="flex h-10 items-center gap-1.5 rounded-full bg-rose-600 px-4 text-[13px] font-semibold text-white shadow-sm hover:bg-rose-700 lg:h-12">
            <Siren size={16} />
            <span className="hidden sm:inline">Emergency</span>
          </button>
        )}
        <NotificationsButton role={role} />
        <RoleSwitcher role={role} />
      </div>
    </header>
  )
}

function NotificationsButton({ role }: { role: Role }) {
  const store = useStore()
  const { data, session, markNotificationsRead, markStudentNotificationsRead } = store
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const items = buildNotifications(data, session, role)
  const unread = items.filter((n) => !n.read).length
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])
  const markAll = () => {
    markNotificationsRead(items.map((n) => n.key))
    if (role === 'student') markStudentNotificationsRead(session.studentId)
  }
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} className="relative flex size-10 items-center justify-center rounded-full border border-slate-100 bg-slate-50 text-slate-600 transition-colors hover:bg-white hover:text-slate-900 lg:size-12" aria-label="Notifications">
        <Bell size={19} />
        {unread > 0 && <span className="absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] leading-4 font-semibold text-white ring-2 ring-white">{unread}</span>}
      </button>
      {open && (
        <div className="fixed inset-x-3 top-16 z-40 animate-slide-up rounded-2xl border border-slate-200 bg-white shadow-pop sm:absolute sm:inset-x-auto sm:top-auto sm:right-0 sm:mt-2 sm:w-96 sm:rounded-3xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <span className="text-sm font-semibold text-slate-900">Notifications</span>
            {unread > 0 && (
              <button onClick={markAll} className="text-xs font-medium text-brand-700 hover:text-brand-800">
                Mark all as read
              </button>
            )}
          </div>
          <div className="scrollbar-thin max-h-[60vh] overflow-y-auto p-1.5">
            {items.length === 0 && (
              <div className="px-4 py-10 text-center">
                <Check className="mx-auto mb-2 text-emerald-500" size={22} />
                <p className="text-sm font-medium text-slate-800">You’re all caught up</p>
                <p className="text-xs text-slate-500">Nothing needs your attention right now.</p>
              </div>
            )}
            {items.map((n) => (
              <button
                key={n.key}
                onClick={() => {
                  markNotificationsRead([n.key])
                  setOpen(false)
                  navigate(n.link)
                }}
                className="flex w-full gap-3 rounded-xl px-2.5 py-2.5 text-left hover:bg-slate-50"
              >
                <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-full', n.tone)}>
                  <n.icon size={15} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn('block text-[13px] leading-snug', n.read ? 'text-slate-600' : 'font-semibold text-slate-900')}>{n.title}</span>
                  {n.body && <span className="mt-0.5 block truncate text-xs text-slate-500">{n.body}</span>}
                  {n.at && <span className="mt-0.5 block text-[11px] text-slate-400">{timeAgo(n.at)}</span>}
                </span>
                {!n.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand-500" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const ROLES: { role: Role; label: string; desc: string }[] = [
  { role: 'student', label: 'Student', desc: 'Resident mobile experience' },
  { role: 'manager', label: 'Manager / Warden', desc: 'Day-to-day operations of one property' },
  { role: 'owner', label: 'Owner', desc: 'Portfolio, finance & analytics' },
]

function RoleSwitcher({ role }: { role: Role }) {
  const { data, session, setStudentPersona, setManagerProperty, resetDemo } = useStore()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])
  const student = data.students.find((s) => s.id === session.studentId)
  const property = data.properties.find((p) => p.id === session.managerPropertyId)!
  const name = role === 'student' ? student?.name ?? 'Student' : role === 'owner' ? OWNER_NAME : property.managerName
  const subtitle = role === 'student' ? `Room ${locationOf(data, student)?.label ?? '—'}` : role === 'owner' ? 'Owner' : 'Manager'
  const personaOptions = data.students.filter((s) => s.propertyId === 'p1' && s.status === 'active' && s.bedId).sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2.5 rounded-full border border-slate-100 bg-white p-1 transition-colors hover:bg-slate-50 md:pr-4 lg:p-1.5 lg:pr-4">
        <Avatar name={name} size="md" />
        <span className="hidden text-left leading-tight md:block">
          <span className="block text-[14px] font-semibold text-slate-900">{name}</span>
          <span className="block text-[12px] text-slate-500">{subtitle}</span>
        </span>
        <ChevronDown size={16} className="ml-2 hidden text-slate-700 md:block" />
        <MoreHorizontal size={16} className="text-slate-400 md:hidden" />
      </button>
      {open && (
        <div className="fixed inset-x-3 top-16 z-40 animate-slide-up rounded-2xl border border-slate-200 bg-white p-2 shadow-pop sm:absolute sm:inset-x-auto sm:top-auto sm:right-0 sm:mt-2 sm:w-80 sm:rounded-3xl">
          <div className="flex items-center gap-2 px-2.5 pt-1.5 pb-2">
            <FlaskConical size={14} className="text-amber-600" />
            <span className="text-[11px] font-semibold tracking-wider text-amber-700 uppercase">Prototype · Switch demo role</span>
          </div>
          {ROLES.map((r) => (
            <button
              key={r.role}
              onClick={() => {
                setOpen(false)
                navigate(`/${r.role}`)
              }}
              className={cn('flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left', r.role === role ? 'bg-brand-50' : 'hover:bg-slate-50')}
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-semibold text-slate-900">{r.label}</span>
                <span className="block text-xs text-slate-500">{r.desc}</span>
              </span>
              {r.role === role && <Check size={16} className="text-brand-600" />}
            </button>
          ))}
          <div className="my-2 h-px bg-slate-100" />
          <div className="space-y-3 px-2.5 py-1">
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium text-slate-500">Student persona (Shanti Residency)</span>
              <Select value={session.studentId} onChange={(e) => setStudentPersona(e.target.value)} className="h-9 text-[13px]">
                {personaOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} — {locationOf(data, s)?.label}
                  </option>
                ))}
              </Select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium text-slate-500">Manager’s property</span>
              <Select value={session.managerPropertyId} onChange={(e) => setManagerProperty(e.target.value)} className="h-9 text-[13px]">
                {data.properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {p.managerName}
                  </option>
                ))}
              </Select>
            </label>
          </div>
          <div className="my-2 h-px bg-slate-100" />
          <button
            onClick={async () => {
              setOpen(false)
              const { ok } = await confirm({ title: 'Reset demo data?', description: 'All changes made in this prototype (students, payments, complaints…) will be discarded and the original mock data restored.', confirmLabel: 'Reset data', tone: 'danger' })
              if (ok) {
                resetDemo()
                navigate(`/${role}`)
                toast.success('Demo data reset')
              }
            }}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium text-slate-600 hover:bg-slate-50"
          >
            <RotateCcw size={15} className="text-slate-400" />
            Reset demo data
          </button>
        </div>
      )}
    </div>
  )
}

function StudentTabBar({ onMore }: { onMore: () => void }) {
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur lg:hidden">
      <div className="mx-auto grid max-w-lg grid-cols-5">
        {STUDENT_TABS.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => cn('flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium', isActive ? 'text-ink' : 'text-slate-400')}>
            {({ isActive }) => (
              <>
                <t.icon size={21} strokeWidth={isActive ? 2.2 : 1.8} />
                {t.label}
              </>
            )}
          </NavLink>
        ))}
        <button onClick={onMore} className="flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-slate-500">
          <MenuIcon size={21} strokeWidth={1.8} />
          More
        </button>
      </div>
    </nav>
  )
}
