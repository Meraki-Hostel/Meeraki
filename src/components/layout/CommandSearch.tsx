import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { BedDouble, MessageSquareWarning, Receipt, Search, Users, type LucideIcon } from 'lucide-react'
import { useStore } from '../../store/AppStore'
import { idx, locationOf, studentPaymentStatus } from '../../store/selectors'
import type { Role } from '../../lib/types'
import { cn, formatINR } from '../../lib/utils'
import { Avatar, StatusBadge } from '../ui'

interface Result {
  key: string
  group: 'Students' | 'Rooms' | 'Complaints' | 'Payments'
  title: string
  sub: string
  to: string
  icon?: LucideIcon
  avatar?: string
  status?: string
}

export function CommandSearch({ role, onClose }: { role: Role; onClose: () => void }) {
  const { data, session } = useStore()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const owner = role === 'owner'
  const inScope = (pid: string) => owner || pid === session.managerPropertyId
  const pName = (pid: string) => data.properties.find((p) => p.id === pid)?.name ?? ''

  const results = useMemo<Result[]>(() => {
    const t = q.trim().toLowerCase()
    if (!t) return []
    const i = idx(data)
    const out: Result[] = []
    const students = data.students.filter((s) => inScope(s.propertyId) && (s.name.toLowerCase().includes(t) || s.phone.includes(t) || locationOf(data, s)?.label.toLowerCase().startsWith(t)))
    for (const s of students.slice(0, 6)) {
      const loc = locationOf(data, s)
      out.push({ key: s.id, group: 'Students', title: s.name, sub: `${loc ? `Room ${loc.label}` : s.status === 'checked-out' ? 'Checked out' : 'Awaiting bed'}${owner ? ` · ${pName(s.propertyId)}` : ''}`, to: owner ? `/owner/students/${s.id}` : `/manager/students/${s.id}`, avatar: s.name, status: s.status === 'active' ? studentPaymentStatus(data, s.id) : undefined })
    }
    for (const r of data.rooms.filter((r) => inScope(r.propertyId) && r.number.startsWith(t)).slice(0, 4)) {
      const beds = i.bedsByRoom.get(r.id) ?? []
      const occ = beds.filter((b) => b.status === 'occupied').length
      out.push({ key: r.id, group: 'Rooms', title: `Room ${r.number}`, sub: `${r.type} · ${occ}/${beds.length} occupied · ${r.building}${owner ? ` · ${pName(r.propertyId)}` : ''}`, to: owner ? `/owner/properties/${r.propertyId}` : `/manager/rooms?room=${r.id}`, icon: BedDouble })
    }
    for (const c of data.complaints.filter((c) => inScope(c.propertyId) && (c.title.toLowerCase().includes(t) || `#${c.number}`.includes(t) || String(c.number) === t)).slice(0, 4)) {
      out.push({ key: c.id, group: 'Complaints', title: `#${c.number} ${c.title}`, sub: `${c.roomId ? `Room ${i.room.get(c.roomId)?.number}` : 'Common area'} · ${c.category}`, to: owner ? '/owner/complaints' : `/manager/complaints?open=${c.id}`, icon: MessageSquareWarning, status: c.status })
    }
    for (const tx of data.transactions.filter((x) => inScope(x.propertyId) && x.receiptNo.toLowerCase().includes(t)).slice(0, 3)) {
      out.push({ key: tx.id, group: 'Payments', title: tx.receiptNo, sub: `${i.student.get(tx.studentId)?.name} · ${formatINR(tx.amount)} · ${tx.method}`, to: owner ? '/owner/finance' : `/manager/payments?q=${encodeURIComponent(i.student.get(tx.studentId)?.name ?? '')}`, icon: Receipt })
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, data, session.managerPropertyId, owner])

  useEffect(() => setActive(0), [q])
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActive((a) => Math.min(results.length - 1, a + 1))
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActive((a) => Math.max(0, a - 1))
      }
      if (e.key === 'Enter' && results[active]) go(results[active]!)
    }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  })

  const go = (r: Result) => {
    onClose()
    navigate(r.to)
  }

  const groups = ['Students', 'Rooms', 'Complaints', 'Payments'] as const
  let n = -1
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-3 pt-[10vh]">
      <div className="absolute inset-0 animate-fade-in bg-slate-900/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full max-w-xl animate-slide-up overflow-hidden rounded-2xl bg-white shadow-pop">
        <div className="flex items-center gap-3 border-b border-slate-100 px-4">
          <Search size={18} className="text-slate-400" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={owner ? 'Search across all properties…' : 'Search students, rooms, complaints, receipts…'} className="h-14 flex-1 bg-transparent text-[15px] outline-none placeholder:text-slate-400" />
          <kbd className="rounded border border-slate-200 px-1.5 text-[11px] text-slate-400">Esc</kbd>
        </div>
        <div className="scrollbar-thin max-h-[60vh] overflow-y-auto p-2">
          {!q && (
            <div className="px-3 py-8 text-center text-[13px] text-slate-500">
              Try <b className="text-slate-700">Rahul</b>, <b className="text-slate-700">204</b>, <b className="text-slate-700">fan</b> or <b className="text-slate-700">REC-10</b>
            </div>
          )}
          {q && results.length === 0 && <div className="px-3 py-8 text-center text-[13px] text-slate-500">No results for “{q}”</div>}
          {groups.map((g) => {
            const items = results.filter((r) => r.group === g)
            if (!items.length) return null
            return (
              <div key={g} className="mb-1">
                <div className="flex items-center gap-1.5 px-3 pt-2 pb-1 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
                  {g === 'Students' && <Users size={12} />}
                  {g}
                </div>
                {items.map((r) => {
                  n++
                  const idxN = n
                  return (
                    <button key={r.key} onMouseEnter={() => setActive(idxN)} onClick={() => go(r)} className={cn('flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left', active === idxN ? 'bg-slate-100' : '')}>
                      {r.avatar ? (
                        <Avatar name={r.avatar} size="sm" />
                      ) : (
                        r.icon && (
                          <span className="flex size-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                            <r.icon size={16} />
                          </span>
                        )
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-slate-900">{r.title}</span>
                        <span className="block truncate text-xs text-slate-500">{r.sub}</span>
                      </span>
                      {r.status && <StatusBadge status={r.status} />}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>,
    document.body,
  )
}
