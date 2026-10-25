import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeftRight, BedDouble, Eye, IndianRupee, LogOut, MoreHorizontal, Plus, SlidersHorizontal, Users } from 'lucide-react'
import { useStore } from '../../store/AppStore'
import { isAway, locationOf, studentOutstanding, studentPaymentStatus } from '../../store/selectors'
import type { Student } from '../../lib/types'
import { formatDate, formatINR, formatPhone } from '../../lib/utils'
import { Avatar, Button, Card, Chip, EmptyState, Menu, PageHeader, Pagination, SearchInput, Select, StatusBadge, Table, Td, Th, Tr } from '../../components/ui'
import { useModals } from '../../components/domain/ModalsProvider'

type SortKey = 'name' | 'room' | 'joined' | 'due'
const PAGE = 15

export default function StudentsPage({ owner }: { owner?: boolean }) {
  const { data, session } = useStore()
  const navigate = useNavigate()
  const modals = useModals()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState(params.get('q') ?? '')
  const status = params.get('status') ?? 'active'
  const [payment, setPayment] = useState('all')
  const [building, setBuilding] = useState('all')
  const [floor, setFloor] = useState('all')
  const [propertyId, setPropertyId] = useState(owner ? 'all' : session.managerPropertyId)
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'room', dir: 'asc' })
  const [page, setPage] = useState(1)
  const [showFilters, setShowFilters] = useState(false)
  const pid = owner ? propertyId : session.managerPropertyId
  const property = data.properties.find((p) => p.id === pid)

  const base = useMemo(() => data.students.filter((s) => pid === 'all' || s.propertyId === pid), [data.students, pid])
  const counts = {
    active: base.filter((s) => s.status === 'active' && s.bedId).length,
    unassigned: base.filter((s) => s.status === 'active' && !s.bedId).length,
    away: base.filter((s) => s.status === 'active' && isAway(data, s.id)).length,
    'checked-out': base.filter((s) => s.status === 'checked-out').length,
  }

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase()
    const list = base
      .filter((s) => {
        if (status === 'active') return s.status === 'active' && !!s.bedId
        if (status === 'unassigned') return s.status === 'active' && !s.bedId
        if (status === 'away') return s.status === 'active' && isAway(data, s.id)
        if (status === 'checked-out') return s.status === 'checked-out'
        return true
      })
      .filter((s) => {
        const loc = locationOf(data, s)
        if (t && !(s.name.toLowerCase().includes(t) || s.phone.includes(t) || loc?.label.toLowerCase().includes(t) || s.college.toLowerCase().includes(t))) return false
        if (payment !== 'all' && studentPaymentStatus(data, s.id) !== payment) return false
        if (building !== 'all' && loc?.room.building !== building) return false
        if (floor !== 'all' && String(loc?.room.floor) !== floor) return false
        return true
      })
    const dir = sort.dir === 'asc' ? 1 : -1
    return list.sort((a, b) => {
      if (sort.key === 'name') return a.name.localeCompare(b.name) * dir
      if (sort.key === 'joined') return a.joinDate.localeCompare(b.joinDate) * dir
      if (sort.key === 'due') return (studentOutstanding(data, a.id) - studentOutstanding(data, b.id)) * dir
      return (locationOf(data, a)?.label ?? 'zzz').localeCompare(locationOf(data, b)?.label ?? 'zzz', undefined, { numeric: true }) * dir
    })
  }, [base, q, status, payment, building, floor, sort, data])

  const paged = rows.slice((page - 1) * PAGE, page * PAGE)
  const setStatus = (v: string) => {
    params.set('status', v)
    setParams(params, { replace: true })
    setPage(1)
  }
  const toggleSort = (key: SortKey) => setSort((s) => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' }))
  const open = (s: Student) => navigate(owner ? `/owner/students/${s.id}` : `/manager/students/${s.id}`)
  const floors = Array.from(new Set(data.rooms.filter((r) => pid === 'all' || r.propertyId === pid).map((r) => r.floor))).sort()
  const activeFilters = [payment, building, floor].filter((x) => x !== 'all').length

  const actions = (s: Student) => [
    { label: 'View profile', icon: Eye, onClick: () => open(s) },
    ...(!owner && s.status === 'active'
      ? [
          { label: 'Record payment', icon: IndianRupee, onClick: () => modals.open({ type: 'recordPayment', studentId: s.id }) },
          s.bedId ? { label: 'Transfer bed', icon: ArrowLeftRight, onClick: () => modals.open({ type: 'transfer', studentId: s.id }) } : { label: 'Assign bed', icon: BedDouble, onClick: () => modals.open({ type: 'assignBed', studentId: s.id }) },
          'divider' as const,
          { label: 'Check out', icon: LogOut, danger: true, onClick: () => modals.checkout(s.id) },
        ]
      : []),
  ]

  return (
    <div>
      <PageHeader
        title="Students"
        description={owner ? 'All residents across your properties' : `${counts.active} residents at ${property?.name}`}
        actions={!owner && <Button variant="primary" icon={Plus} onClick={() => modals.open({ type: 'addStudent' })}>Add Student</Button>}
      />

      <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto">
        <Chip active={status === 'active'} onClick={() => setStatus('active')}>Residents <span className="text-slate-400 tabular">{counts.active}</span></Chip>
        <Chip active={status === 'unassigned'} onClick={() => setStatus('unassigned')}>Awaiting bed <span className="text-slate-400 tabular">{counts.unassigned}</span></Chip>
        <Chip active={status === 'away'} onClick={() => setStatus('away')}>On leave today <span className="text-slate-400 tabular">{counts.away}</span></Chip>
        <Chip active={status === 'checked-out'} onClick={() => setStatus('checked-out')}>Checked out <span className="text-slate-400 tabular">{counts['checked-out']}</span></Chip>
      </div>

      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center">
          <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1) }} placeholder="Search name, phone, room or college" className="lg:w-80" />
          <Button className="lg:hidden" icon={SlidersHorizontal} onClick={() => setShowFilters((x) => !x)}>
            Filters{activeFilters ? ` (${activeFilters})` : ''}
          </Button>
          <div className={`${showFilters ? 'grid' : 'hidden'} grid-cols-2 gap-2 lg:ml-auto lg:flex`}>
            {owner && (
              <Select value={propertyId} onChange={(e) => { setPropertyId(e.target.value); setBuilding('all'); setPage(1) }} className="h-9 lg:w-48">
                <option value="all">All properties</option>
                {data.properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            )}
            <Select value={payment} onChange={(e) => { setPayment(e.target.value); setPage(1) }} className="h-9 lg:w-40">
              <option value="all">Any payment</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="partial">Partial</option>
              <option value="overdue">Overdue</option>
            </Select>
            {property && property.buildings.length > 1 && (
              <Select value={building} onChange={(e) => { setBuilding(e.target.value); setPage(1) }} className="h-9 lg:w-36">
                <option value="all">All buildings</option>
                {property.buildings.map((b) => <option key={b}>{b}</option>)}
              </Select>
            )}
            <Select value={floor} onChange={(e) => { setFloor(e.target.value); setPage(1) }} className="h-9 lg:w-32">
              <option value="all">All floors</option>
              {floors.map((f) => <option key={f} value={String(f)}>Floor {f}</option>)}
            </Select>
            <Select value={`${sort.key}:${sort.dir}`} onChange={(e) => { const [key, dir] = e.target.value.split(':') as [SortKey, 'asc' | 'desc']; setSort({ key, dir }) }} className="h-9 lg:hidden">
              <option value="room:asc">Sort: Room</option>
              <option value="name:asc">Sort: Name</option>
              <option value="due:desc">Sort: Highest dues</option>
              <option value="joined:desc">Sort: Newest</option>
            </Select>
          </div>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon={Users}
            title={status === 'unassigned' ? 'No one is waiting for a bed' : 'No students found'}
            description={q || activeFilters ? 'Try a different search or clear the filters.' : status === 'checked-out' ? 'Checked-out students will appear here.' : 'Add a student to get started.'}
            action={(q || activeFilters > 0) && <Button size="sm" onClick={() => { setQ(''); setPayment('all'); setBuilding('all'); setFloor('all') }}>Clear filters</Button>}
          />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block">
              <Table>
                <thead>
                  <tr>
                    <Th sort={sort.key === 'name' ? sort.dir : null} onSort={() => toggleSort('name')}>Student</Th>
                    {owner && <Th>Property</Th>}
                    <Th sort={sort.key === 'room' ? sort.dir : null} onSort={() => toggleSort('room')}>Room · Bed</Th>
                    <Th>Phone</Th>
                    <Th sort={sort.key === 'due' ? sort.dir : null} onSort={() => toggleSort('due')}>Payment</Th>
                    <Th sort={sort.key === 'joined' ? sort.dir : null} onSort={() => toggleSort('joined')}>Joined</Th>
                    <Th>Status</Th>
                    <Th className="w-12" />
                  </tr>
                </thead>
                <tbody>
                  {paged.map((s) => {
                    const loc = locationOf(data, s)
                    const ps = studentPaymentStatus(data, s.id)
                    const out = studentOutstanding(data, s.id)
                    return (
                      <Tr key={s.id} onClick={() => open(s)}>
                        <Td>
                          <div className="flex items-center gap-3">
                            <Avatar name={s.name} size="sm" />
                            <div className="min-w-0">
                              <div className="font-medium text-slate-900">{s.name}</div>
                              <div className="truncate text-xs text-slate-500">{s.course} · {s.college}</div>
                            </div>
                          </div>
                        </Td>
                        {owner && <Td className="text-[13px]">{data.properties.find((p) => p.id === s.propertyId)?.name}</Td>}
                        <Td>
                          {loc ? (
                            <div>
                              <span className="font-medium text-slate-900">{loc.room.number}</span>
                              <span className="text-slate-400"> · </span>
                              <span>Bed {loc.bed.label}</span>
                              <div className="text-xs text-slate-500">{loc.room.building} · Floor {loc.room.floor}</div>
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </Td>
                        <Td className="text-[13px] whitespace-nowrap tabular">{formatPhone(s.phone)}</Td>
                        <Td>
                          {s.status === 'active' ? (
                            <div className="flex flex-col items-start gap-0.5">
                              <StatusBadge status={ps} />
                              {out > 0 && <span className="text-xs text-slate-500 tabular">{formatINR(out)} due</span>}
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </Td>
                        <Td className="text-[13px] whitespace-nowrap">{formatDate(s.joinDate, { year: true })}</Td>
                        <Td><StudentStatus s={s} /></Td>
                        <Td>
                          <Menu items={actions(s)} trigger={() => <Button size="sm" variant="ghost" icon={MoreHorizontal} aria-label="Actions" />} />
                        </Td>
                      </Tr>
                    )
                  })}
                </tbody>
              </Table>
            </div>
            {/* Mobile cards */}
            <ul className="divide-y divide-slate-100 md:hidden">
              {paged.map((s) => {
                const loc = locationOf(data, s)
                return (
                  <li key={s.id} onClick={() => open(s)} className="flex items-center gap-3 px-4 py-3 active:bg-slate-50">
                    <Avatar name={s.name} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-slate-900">{s.name}</div>
                      <div className="text-xs text-slate-500">{loc ? `Room ${loc.label}` : s.status === 'checked-out' ? 'Checked out' : 'Awaiting bed'} · {formatPhone(s.phone)}</div>
                    </div>
                    {s.status === 'active' ? <StatusBadge status={studentPaymentStatus(data, s.id)} /> : <StudentStatus s={s} />}
                  </li>
                )
              })}
            </ul>
            <Pagination page={page} pageSize={PAGE} total={rows.length} onPage={setPage} />
          </>
        )}
      </Card>
    </div>
  )
}

export function StudentStatus({ s }: { s: Student }) {
  const { data } = useStore()
  if (s.status === 'checked-out') return <StatusBadge status="checked-out-student" />
  if (!s.bedId) return <StatusBadge status="unassigned" />
  if (isAway(data, s.id)) return <StatusBadge status="on-leave" />
  return <StatusBadge status="active" />
}
