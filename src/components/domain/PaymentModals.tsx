import { useMemo, useState } from 'react'
import { CheckCircle2, Download, Printer, Receipt, Search, Wallet } from 'lucide-react'
import { useStore } from '../../store/AppStore'
import { dueLabel, dueStatus, idx, locationOf } from '../../store/selectors'
import type { AppData, PaymentMethod, Transaction } from '../../lib/types'
import { cn, formatDate, formatDateLong, formatINR, formatTime, sleep } from '../../lib/utils'
import { Avatar, Button, EmptyState, Field, Input, Modal, Segmented, StatusBadge, useToast } from '../ui'

export function RecordPaymentModal({ open, onClose, propertyId, studentId: presetStudent, dueId: presetDue, onReceipt }: {
  open: boolean
  onClose: () => void
  propertyId: string
  studentId?: string
  dueId?: string
  onReceipt: (txnId: string) => void
}) {
  const { data, recordPayment } = useStore()
  const toast = useToast()
  const i = idx(data)
  const [studentId, setStudentId] = useState<string | null>(presetStudent ?? (presetDue ? data.dues.find((d) => d.id === presetDue)?.studentId ?? null : null))
  const [q, setQ] = useState('')
  const dues = (studentId ? i.duesByStudent.get(studentId) ?? [] : []).filter((d) => d.paid < d.amount).sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  const [dueId, setDueId] = useState<string | null>(presetDue ?? null)
  const due = data.dues.find((d) => d.id === (dueId ?? dues[0]?.id))
  const remaining = due ? due.amount - due.paid : 0
  const [amount, setAmount] = useState<string>('')
  const [method, setMethod] = useState<PaymentMethod>('UPI')
  const [reference, setReference] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState<{ txnId: string; paid: number; remaining: number; status: string } | null>(null)
  const student = studentId ? i.student.get(studentId) : null
  const loc = locationOf(data, student)

  const matches = useMemo(() => {
    const t = q.trim().toLowerCase()
    return data.students
      .filter((s) => s.propertyId === propertyId && s.status === 'active')
      .filter((s) => !t || s.name.toLowerCase().includes(t) || locationOf(data, s)?.label.toLowerCase().includes(t))
      .slice(0, 6)
  }, [q, data, propertyId])

  const save = async () => {
    if (!due) return
    const amt = Number(amount || remaining)
    setSaving(true)
    await sleep(500)
    const res = recordPayment(due.id, amt, method, reference || undefined)
    setSaving(false)
    if (!res.ok) return toast.error(res.error)
    const left = remaining - amt
    toast.success('Payment recorded successfully.', { description: `${formatINR(amt)} from ${student?.name}` })
    setDone({ txnId: res.txnId, paid: due.paid + amt, remaining: left, status: left > 0 ? 'partial' : 'paid' })
  }

  if (done && due)
    return (
      <Modal open={open} onClose={onClose} size="sm" hideClose footer={<><Button onClick={onClose}>Done</Button><Button variant="primary" icon={Receipt} onClick={() => onReceipt(done.txnId)}>View receipt</Button></>}>
        <div className="flex flex-col items-center py-2 text-center">
          <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <CheckCircle2 size={26} />
          </div>
          <h2 className="text-base font-semibold text-slate-900">Payment recorded</h2>
          <p className="mt-1 text-sm text-slate-500">
            {student?.name} · {dueLabel(due.cycle)}
          </p>
          <div className="mt-5 grid w-full grid-cols-3 divide-x divide-slate-100 rounded-xl border border-slate-200 py-3">
            <Stat label="Paid" value={formatINR(done.paid)} />
            <Stat label="Remaining" value={formatINR(done.remaining)} />
            <div className="flex flex-col items-center gap-1">
              <span className="text-xs text-slate-500">Status</span>
              <StatusBadge status={done.status} />
            </div>
          </div>
        </div>
      </Modal>
    )

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record payment"
      description="Log a cash, UPI or bank transfer payment received at the office"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={saving} disabled={!due} onClick={save}>
            Save payment
          </Button>
        </>
      }
    >
      {!student ? (
        <div>
          <Field label="Student">
            <div className="relative">
              <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
              <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or room (e.g. Rahul, 204)" className="pl-9" />
            </div>
          </Field>
          <div className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200">
            {matches.map((s) => {
              const l = locationOf(data, s)
              const out = (i.duesByStudent.get(s.id) ?? []).reduce((a, d) => a + d.amount - d.paid, 0)
              return (
                <button key={s.id} onClick={() => setStudentId(s.id)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50">
                  <Avatar name={s.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-slate-900">{s.name}</div>
                    <div className="text-xs text-slate-500">{l ? `Room ${l.label}` : 'No bed'}</div>
                  </div>
                  <span className={cn('text-[13px] font-medium tabular', out ? 'text-slate-900' : 'text-slate-400')}>{out ? `${formatINR(out)} due` : 'No dues'}</span>
                </button>
              )
            })}
            {!matches.length && <EmptyState compact icon={Search} title="No students found" />}
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3">
            <Avatar name={student.name} />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-slate-900">{student.name}</div>
              <div className="text-xs text-slate-500">{loc ? `Room ${loc.label}` : 'No bed assigned'}</div>
            </div>
            {!presetStudent && !presetDue && (
              <Button size="sm" variant="ghost" onClick={() => { setStudentId(null); setDueId(null) }}>
                Change
              </Button>
            )}
          </div>
          {dues.length === 0 ? (
            <EmptyState compact icon={Wallet} title="No outstanding dues" description={`${student.name} has cleared all invoices.`} />
          ) : (
            <>
              {dues.length > 1 && (
                <Field label="Invoice">
                  <div className="grid gap-2 sm:grid-cols-2">
                    {dues.map((d) => (
                      <button key={d.id} onClick={() => { setDueId(d.id); setAmount('') }} className={cn('flex items-center justify-between rounded-lg border px-3 py-2 text-left', due?.id === d.id ? 'border-brand-500 bg-brand-50/50 ring-3 ring-brand-500/15' : 'border-slate-200 hover:border-slate-300')}>
                        <span>
                          <span className="block text-sm font-medium text-slate-900">{dueLabel(d.cycle)}</span>
                          <span className="text-xs text-slate-500">{formatINR(d.amount - d.paid)} remaining</span>
                        </span>
                        <StatusBadge status={dueStatus(d)} />
                      </button>
                    ))}
                  </div>
                </Field>
              )}
              {due && (
                <div className="grid grid-cols-3 divide-x divide-slate-100 rounded-xl bg-slate-50 py-3">
                  <Stat label="Due" value={formatINR(due.amount)} />
                  <Stat label="Paid so far" value={formatINR(due.paid)} />
                  <Stat label="Remaining" value={formatINR(remaining)} strong />
                </div>
              )}
              <Field label="Amount received" hint={Number(amount) > 0 && Number(amount) < remaining ? `Partial payment — ${formatINR(remaining - Number(amount))} will remain due` : undefined}>
                <Input prefix="₹" type="number" inputMode="numeric" value={amount} placeholder={String(remaining)} onChange={(e) => setAmount(e.target.value)} />
              </Field>
              <Field label="Payment method">
                <Segmented items={[{ value: 'Cash', label: 'Cash' }, { value: 'UPI', label: 'UPI' }, { value: 'Bank Transfer', label: 'Bank transfer' }]} value={method as 'Cash' | 'UPI' | 'Bank Transfer'} onChange={setMethod} />
              </Field>
              {method !== 'Cash' && (
                <Field label="Reference / UTR" hint="Optional">
                  <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. UTR 4829 1034 5521" />
                </Field>
              )}
            </>
          )}
        </div>
      )}
    </Modal>
  )
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-2">
      <span className="text-xs text-slate-500">{label}</span>
      <span className={cn('text-sm tabular', strong ? 'font-semibold text-slate-900' : 'font-medium text-slate-700')}>{value}</span>
    </div>
  )
}

function receiptModel(data: AppData, t: Transaction) {
  const i = idx(data)
  const s = i.student.get(t.studentId)!
  const p = data.properties.find((x) => x.id === t.propertyId)!
  const due = data.dues.find((d) => d.id === t.dueId)
  const loc = locationOf(data, s)
  return { s, p, due, room: loc?.label ?? '—', t }
}

export function ReceiptModal({ open, onClose, txnId }: { open: boolean; onClose: () => void; txnId: string }) {
  const { data } = useStore()
  const toast = useToast()
  const t = data.transactions.find((x) => x.id === txnId)
  if (!t) return null
  const m = receiptModel(data, t)
  const download = () => {
    const blob = new Blob([receiptHtml(m)], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${t.receiptNo}.html`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Receipt downloaded', { description: `${t.receiptNo}.html (mock receipt file)` })
  }
  const print = () => {
    const w = window.open('', '_blank', 'width=720,height=900')
    if (!w) return toast.error('Pop-up blocked', { description: 'Allow pop-ups to print the receipt.' })
    w.document.write(receiptHtml(m))
    w.document.close()
    w.focus()
    w.print()
  }
  return (
    <Modal open={open} onClose={onClose} size="md" title="Payment receipt" footer={<><Button icon={Printer} onClick={print}>Print</Button><Button variant="primary" icon={Download} onClick={download}>Download receipt</Button></>}>
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex items-start justify-between border-b border-dashed border-slate-200 px-5 py-4">
          <div>
            <div className="text-[11px] font-semibold tracking-[0.14em] text-slate-400">HOSTEL RECEIPT</div>
            <div className="mt-1 text-base font-semibold text-slate-900">{m.p.name}</div>
            <div className="text-xs text-slate-500">{m.p.address}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-500">Receipt</div>
            <div className="text-sm font-semibold text-slate-900">#{t.receiptNo}</div>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 px-5 py-4 text-sm">
          <Row k="Student" v={m.s.name} />
          <Row k="Room" v={m.room} />
          <Row k="For" v={m.due ? dueLabel(m.due.cycle, true) : 'Rent'} />
          <Row k="Payment method" v={t.method} />
          <Row k="Date" v={formatDateLong(t.date)} />
          <Row k="Time" v={formatTime(t.date)} />
          {t.reference && <Row k="Reference" v={t.reference} />}
          <Row k="Recorded by" v={t.recordedBy} />
        </dl>
        <div className="flex items-center justify-between rounded-b-xl bg-slate-50 px-5 py-4">
          <span className="text-sm text-slate-500">Amount received</span>
          <span className="text-xl font-semibold text-slate-900 tabular">{formatINR(t.amount)}</span>
        </div>
      </div>
      <p className="mt-3 text-center text-xs text-slate-400">Prototype receipt — not a tax invoice.</p>
    </Modal>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{k}</dt>
      <dd className="mt-0.5 font-medium text-slate-800">{v}</dd>
    </div>
  )
}

function receiptHtml({ s, p, due, room, t }: ReturnType<typeof receiptModel>) {
  const esc = (x: string) => x.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!)
  return `<!doctype html><html><head><meta charset="utf-8"><title>${t.receiptNo}</title><style>
body{font-family:Inter,system-ui,sans-serif;color:#0f172a;max-width:560px;margin:40px auto;padding:0 20px}
.card{border:1px solid #e2e8f0;border-radius:14px;overflow:hidden}.hd{padding:20px;border-bottom:1px dashed #cbd5e1;display:flex;justify-content:space-between}
.k{font-size:12px;color:#64748b}.v{font-weight:600;margin-top:2px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;padding:20px}
.ft{background:#f8fafc;padding:18px 20px;display:flex;justify-content:space-between;align-items:center}.amt{font-size:22px;font-weight:700}
.eyebrow{font-size:11px;letter-spacing:.14em;color:#94a3b8;font-weight:600}</style></head><body>
<div class="card"><div class="hd"><div><div class="eyebrow">HOSTEL RECEIPT</div><div class="v" style="font-size:17px">${esc(p.name)}</div><div class="k">${esc(p.address)}</div></div>
<div style="text-align:right"><div class="k">Receipt</div><div class="v">#${t.receiptNo}</div></div></div>
<div class="grid"><div><div class="k">Student</div><div class="v">${esc(s.name)}</div></div><div><div class="k">Room</div><div class="v">${room}</div></div>
<div><div class="k">For</div><div class="v">${due ? dueLabel(due.cycle, true) : 'Rent'}</div></div><div><div class="k">Payment method</div><div class="v">${t.method}</div></div>
<div><div class="k">Date</div><div class="v">${formatDate(t.date, { year: true })}</div></div><div><div class="k">Reference</div><div class="v">${t.reference ?? '—'}</div></div></div>
<div class="ft"><span class="k">Amount received</span><span class="amt">${formatINR(t.amount)}</span></div></div>
<p class="k" style="text-align:center;margin-top:14px">Prototype receipt generated by Meraki — not a tax invoice.</p></body></html>`
}
