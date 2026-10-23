import { BedDouble, Phone, ShieldAlert } from 'lucide-react'
import { useCurrentStudent, useStore } from '../../store/AppStore'
import { idx, locationOf } from '../../store/selectors'
import { formatDate, formatINR, formatPhone } from '../../lib/utils'
import { Avatar, Card, CardHeader, InfoRow, useToast } from '../../components/ui'

export default function StudentProfilePage() {
  const { data } = useStore()
  const s = useCurrentStudent()
  const toast = useToast()
  const loc = locationOf(data, s)
  const i = idx(data)
  const property = data.properties.find((p) => p.id === s.propertyId)!
  const roommates = loc ? (i.bedsByRoom.get(loc.room.id) ?? []).filter((b) => b.studentId && b.studentId !== s.id).map((b) => ({ bed: b.label, name: i.student.get(b.studentId!)!.name })) : []
  return (
    <div className="space-y-5">
      <Card className="flex items-center gap-4 p-5">
        <Avatar name={s.name} size="xl" />
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-slate-900">{s.name}</h1>
          <p className="text-[13px] text-slate-500">{s.course} · {s.college}</p>
          <p className="mt-1 inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-700"><BedDouble size={14} />{loc ? `Room ${loc.room.number} · Bed ${loc.bed.label}` : 'Bed not assigned'}</p>
        </div>
      </Card>
      <div className="grid gap-5 md:grid-cols-2">
        <Card>
          <CardHeader title="My room" />
          <div className="divide-y divide-slate-100 px-5 pb-3">
            <InfoRow label="Hostel" value={property.name} />
            <InfoRow label="Room" value={loc ? `${loc.room.number} · ${loc.room.type}` : '—'} />
            <InfoRow label="Building" value={loc ? `${loc.room.building}, Floor ${loc.room.floor}` : '—'} />
            <InfoRow label="Roommates" value={roommates.length ? roommates.map((r) => `${r.name} (${r.bed})`).join(', ') : 'None'} />
            <InfoRow label="Monthly rent" value={formatINR(s.monthlyRent)} />
            <InfoRow label="Resident since" value={formatDate(s.joinDate, { year: true })} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Personal details" subtitle="Contact the office to change these" />
          <div className="divide-y divide-slate-100 px-5 pb-3">
            <InfoRow label="Mobile" value={formatPhone(s.phone)} />
            <InfoRow label="Email" value={s.email} />
            <InfoRow label="Guardian" value={`${s.guardianName} · ${formatPhone(s.guardianPhone)}`} />
            <InfoRow label="Blood group" value={s.bloodGroup} />
            <InfoRow label="ID" value={s.idNumber} />
          </div>
        </Card>
        <Card className="md:col-span-2">
          <CardHeader title="Hostel contacts" />
          <div className="grid gap-2 px-5 pb-5 sm:grid-cols-2">
            {[{ label: `${property.managerName} · Manager`, phone: property.managerPhone }, { label: 'Security desk (24×7)', phone: '9826000112' }].map((c) => (
              <button key={c.label} onClick={() => toast.info(`Calling ${c.label.split(' ·')[0]}…`, { description: `${formatPhone(c.phone)} (simulated)` })} className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-left hover:bg-slate-50">
                <span className="flex size-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600"><Phone size={16} /></span>
                <span><span className="block text-sm font-medium text-slate-900">{c.label}</span><span className="text-xs text-slate-500">{formatPhone(c.phone)}</span></span>
              </button>
            ))}
          </div>
          <p className="flex items-center gap-2 border-t border-slate-100 px-5 py-3 text-xs text-slate-500"><ShieldAlert size={14} />For urgent help use the red Emergency button at the top.</p>
        </Card>
      </div>
    </div>
  )
}
