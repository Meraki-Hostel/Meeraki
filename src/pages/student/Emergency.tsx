import { useState } from 'react'
import { CheckCircle2, Clock, Phone, Siren } from 'lucide-react'
import { useCurrentStudent, useStore } from '../../store/AppStore'
import { locationOf } from '../../store/selectors'
import { cn, formatPhone, formatTime, sleep, timeAgo } from '../../lib/utils'
import { Button, Card, Modal, Textarea, useToast } from '../../components/ui'

const QUICK = ['Medical emergency', 'Fire / smoke', 'Security threat', 'Feeling unsafe']

export default function StudentEmergency() {
  const { data, sendEmergency } = useStore()
  const s = useCurrentStudent()
  const toast = useToast()
  const [confirming, setConfirming] = useState(false)
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)
  const loc = locationOf(data, s)
  const property = data.properties.find((p) => p.id === s.propertyId)!
  const alerts = data.alerts.filter((a) => a.studentId === s.id)
  const active = alerts.find((a) => a.status === 'active')
  const latest = alerts[0]

  const send = async () => {
    setSending(true)
    await sleep(900)
    sendEmergency(s.id, note.trim())
    setSending(false)
    setConfirming(false)
    setNote('')
    toast.success('Emergency alert sent', { description: 'Hostel management has been alerted.' })
  }

  return (
    <div className="mx-auto max-w-lg">
      <div className="py-4 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Emergency</h1>
        <p className="mt-1 text-sm text-slate-500">Instantly alerts the warden, manager and security desk with your room number.</p>
      </div>

      {latest && (
        <Card className={cn('mb-6 p-4', latest.status === 'active' ? 'border-rose-200 bg-rose-50' : 'border-emerald-200 bg-emerald-50')}>
          <div className="flex items-start gap-3">
            {latest.status === 'active' ? <Clock size={20} className="mt-0.5 text-rose-600" /> : <CheckCircle2 size={20} className="mt-0.5 text-emerald-600" />}
            <div>
              <div className={cn('text-sm font-semibold', latest.status === 'active' ? 'text-rose-900' : 'text-emerald-900')}>{latest.status === 'active' ? 'Alert sent — waiting for response' : 'Help is on the way'}</div>
              <div className={cn('text-[13px]', latest.status === 'active' ? 'text-rose-800/80' : 'text-emerald-800/80')}>
                Sent at {formatTime(latest.at)} ({timeAgo(latest.at)}){latest.acknowledgedAt && ` · acknowledged at ${formatTime(latest.acknowledgedAt)}`}
              </div>
            </div>
          </div>
        </Card>
      )}

      <button onClick={() => setConfirming(true)} disabled={!!active} className="group mx-auto flex size-52 flex-col items-center justify-center rounded-full bg-rose-600 text-white shadow-[0_0_0_12px_rgba(225,29,72,0.12),0_0_0_24px_rgba(225,29,72,0.06)] transition-transform hover:bg-rose-700 active:scale-95 disabled:bg-rose-300 disabled:shadow-none">
        <Siren size={48} strokeWidth={1.75} />
        <span className="mt-2 text-lg font-semibold">{active ? 'Alert active' : 'Emergency Alert'}</span>
        <span className="text-xs text-white/80">{active ? 'Management notified' : 'Tap to send'}</span>
      </button>

      <Card className="mt-10 divide-y divide-slate-100">
        {[{ label: `${property.managerName} (Manager)`, phone: property.managerPhone }, { label: 'Security desk', phone: '9826000112' }, { label: 'Ambulance', phone: '108' }, { label: 'Police', phone: '112' }].map((c) => (
          <button key={c.label} onClick={() => toast.info(`Calling ${c.label}…`, { description: 'Simulated call in prototype' })} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50">
            <Phone size={16} className="text-emerald-600" />
            <span className="flex-1 text-sm font-medium text-slate-800">{c.label}</span>
            <span className="text-[13px] text-slate-500 tabular">{c.phone.length === 10 ? formatPhone(c.phone) : c.phone}</span>
          </button>
        ))}
      </Card>

      <Modal open={confirming} onClose={() => setConfirming(false)} size="sm" title="Send emergency alert to hostel management?" description={`Your location Room ${loc?.label ?? '—'}, ${property.name} will be shared.`}
        footer={<><Button onClick={() => setConfirming(false)}>Cancel</Button><Button variant="danger" icon={Siren} loading={sending} onClick={send}>Send alert</Button></>}>
        <div className="mb-3 flex flex-wrap gap-2">
          {QUICK.map((q) => <button key={q} onClick={() => setNote(q)} className={cn('rounded-full border px-3 py-1 text-[13px]', note === q ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-slate-200 text-slate-600')}>{q}</button>)}
        </div>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="What’s happening? (optional)" className="min-h-20" />
      </Modal>
    </div>
  )
}
