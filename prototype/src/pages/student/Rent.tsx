import { useState } from 'react'
import { CheckCircle2, CreditCard, Landmark, Loader2, Lock, Receipt, ShieldCheck, Smartphone, Wallet } from 'lucide-react'
import { useCurrentStudent, useStore } from '../../store/AppStore'
import { dueLabel, dueStatus, idx, locationOf } from '../../store/selectors'
import type { Due } from '../../lib/types'
import { cn, firstName, formatDate, formatINR, sleep } from '../../lib/utils'
import { Button, Card, CardHeader, EmptyState, Modal, PageHeader, StatusBadge } from '../../components/ui'
import { useModals } from '../../components/domain/ModalsProvider'

export default function StudentRent() {
  const { data } = useStore()
  const s = useCurrentStudent()
  const modals = useModals()
  const [paying, setPaying] = useState<Due | null>(null)
  const i = idx(data)
  const dues = i.duesByStudent.get(s.id) ?? []
  const open = dues.filter((d) => d.paid < d.amount).sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  const next = open[0]
  const txns = i.txnsByStudent.get(s.id) ?? []
  const totalDue = open.reduce((a, d) => a + d.amount - d.paid, 0)

  return (
    <div>
      <PageHeader title="Rent & Fees" description={`${formatINR(s.monthlyRent)} per month · Room ${locationOf(data, s)?.label ?? '—'}`} />
      <Card className="mb-5 overflow-hidden">
        <div className="bg-gradient-to-br from-brand-700 to-brand-600 p-5 text-white sm:p-6">
          <div className="text-[13px] font-medium text-white/70">{next ? 'Amount due' : 'All paid up'}</div>
          <div className="mt-1 text-3xl font-semibold tracking-tight tabular">{formatINR(totalDue)}</div>
          {next ? (
            <div className="mt-1 text-[13px] text-white/80">{dueLabel(next.cycle)} · due on {formatDate(next.dueDate, { year: false })}{dueStatus(next) === 'overdue' && ' · overdue'}</div>
          ) : (
            <div className="mt-1 text-[13px] text-white/80">No pending dues. Your next invoice is generated on the 1st.</div>
          )}
          {next && (
            <Button size="lg" className="mt-5 w-full border-0 bg-white text-brand-800 hover:bg-white/90 sm:w-auto" onClick={() => setPaying(next)}>
              Pay {formatINR(next.amount - next.paid)}
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2 px-5 py-3 text-xs text-slate-500">
          <ShieldCheck size={14} className="text-emerald-600" /> Payments update your hostel account instantly with a receipt.
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Invoices" />
          <ul className="divide-y divide-slate-100 border-t border-slate-100">
            {dues.map((d) => (
              <li key={d.id} className="flex items-center gap-3 px-5 py-3">
                <div className="flex-1">
                  <div className="text-sm font-medium text-slate-900">{dueLabel(d.cycle)}</div>
                  <div className="text-xs text-slate-500">Due {formatDate(d.dueDate)} · {formatINR(d.amount)}{d.paid > 0 && d.paid < d.amount && ` · ${formatINR(d.paid)} paid`}</div>
                </div>
                <StatusBadge status={dueStatus(d)} label={dueStatus(d) === 'pending' ? 'Unpaid' : undefined} />
                {d.paid < d.amount && <Button size="xs" variant="subtle" onClick={() => setPaying(d)}>Pay</Button>}
              </li>
            ))}
            {!dues.length && <EmptyState compact icon={Wallet} title="No invoices yet" />}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Payment history" subtitle="Tap to view receipt" />
          <ul className="divide-y divide-slate-100 border-t border-slate-100">
            {txns.map((t) => {
              const d = data.dues.find((x) => x.id === t.dueId)
              return (
                <li key={t.id}>
                  <button onClick={() => modals.open({ type: 'receipt', txnId: t.id })} className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-slate-50">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600"><Receipt size={16} /></span>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-slate-900">{formatINR(t.amount)} · {d ? dueLabel(d.cycle) : 'Rent'}</div>
                      <div className="text-xs text-slate-500">{t.receiptNo} · {formatDate(t.date, { year: true })} · {t.method}</div>
                    </div>
                  </button>
                </li>
              )
            })}
            {!txns.length && <EmptyState compact icon={Receipt} title="No payments yet" />}
          </ul>
        </Card>
      </div>
      {paying && <PayRentModal due={paying} onClose={() => setPaying(null)} />}
    </div>
  )
}

type Method = 'upi' | 'card' | 'netbanking'

export function PayRentModal({ due, onClose }: { due: Due; onClose: () => void }) {
  const { data, recordPayment } = useStore()
  const modals = useModals()
  const [step, setStep] = useState<'summary' | 'method' | 'processing' | 'done'>('summary')
  const [method, setMethod] = useState<Method>('upi')
  const [upiApp, setUpiApp] = useState('GPay')
  const [txnId, setTxnId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const property = data.properties.find((p) => p.id === due.propertyId)!
  const amount = due.amount - due.paid

  const pay = async () => {
    setStep('processing')
    await sleep(1600)
    const res = recordPayment(due.id, amount, method === 'card' ? 'Online (Card)' : 'Online (UPI)', `SIM${Date.now().toString().slice(-9)}`)
    if (!res.ok) {
      setError(res.error)
      setStep('method')
      return
    }
    setTxnId(res.txnId)
    setStep('done')
  }

  return (
    <Modal open onClose={step === 'processing' ? () => {} : onClose} size="sm" hideClose={step === 'processing' || step === 'done'} title={step === 'summary' ? 'Payment summary' : step === 'method' ? 'Choose payment method' : undefined}>
      {step === 'summary' && (
        <div>
          <div className="rounded-xl border border-slate-200">
            <Row k="Paying to" v={property.name} />
            <Row k="For" v={dueLabel(due.cycle, true)} />
            <Row k="Rent" v={formatINR(due.amount)} />
            {due.paid > 0 && <Row k="Already paid" v={`− ${formatINR(due.paid)}`} />}
            <Row k="Late fee" v={formatINR(0)} />
            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-4 py-3 rounded-b-xl">
              <span className="text-sm font-medium text-slate-700">Total</span>
              <span className="text-lg font-semibold text-slate-900 tabular">{formatINR(amount)}</span>
            </div>
          </div>
          <Button variant="primary" size="lg" className="mt-5 w-full" onClick={() => setStep('method')}>Continue to pay</Button>
          <p className="mt-3 text-center text-xs text-slate-400">Prototype: this is a simulated payment — no money is charged.</p>
        </div>
      )}
      {step === 'method' && (
        <div>
          {error && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-[13px] text-rose-700">{error}</p>}
          <div className="space-y-2">
            {([['upi', 'UPI', 'GPay, PhonePe, Paytm, BHIM', Smartphone], ['card', 'Debit / Credit card', 'Visa, Mastercard, RuPay', CreditCard], ['netbanking', 'Net banking', 'All major banks', Landmark]] as const).map(([v, label, sub, Icon]) => (
              <button key={v} onClick={() => setMethod(v)} className={cn('flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all', method === v ? 'border-brand-500 bg-brand-50/50 ring-3 ring-brand-500/15' : 'border-slate-200 hover:border-slate-300')}>
                <Icon size={20} className={method === v ? 'text-brand-600' : 'text-slate-400'} />
                <span className="flex-1">
                  <span className="block text-sm font-semibold text-slate-900">{label}</span>
                  <span className="text-xs text-slate-500">{sub}</span>
                </span>
                <span className={cn('size-4 rounded-full border-2', method === v ? 'border-brand-600 bg-brand-600 ring-2 ring-white ring-inset' : 'border-slate-300')} />
              </button>
            ))}
          </div>
          {method === 'upi' && (
            <div className="mt-4 grid grid-cols-4 gap-2">
              {['GPay', 'PhonePe', 'Paytm', 'BHIM'].map((a) => (
                <button key={a} onClick={() => setUpiApp(a)} className={cn('rounded-lg border py-2 text-xs font-medium', upiApp === a ? 'border-brand-500 bg-brand-50 text-brand-800' : 'border-slate-200 text-slate-600')}>{a}</button>
              ))}
            </div>
          )}
          {method === 'card' && (
            <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-[13px] text-slate-600">
              •••• •••• •••• 4821 · {firstName(data.students.find((x) => x.id === due.studentId)?.name ?? '')}’s saved card <span className="text-slate-400">(demo)</span>
            </div>
          )}
          <Button variant="primary" size="lg" icon={Lock} className="mt-5 w-full" onClick={pay}>Complete Payment · {formatINR(amount)}</Button>
          <button onClick={() => setStep('summary')} className="mt-3 w-full text-center text-[13px] font-medium text-slate-500 hover:text-slate-800">Back</button>
        </div>
      )}
      {step === 'processing' && (
        <div className="flex flex-col items-center py-10 text-center">
          <Loader2 size={34} className="animate-spin text-brand-600" />
          <p className="mt-4 text-sm font-semibold text-slate-900">Processing payment…</p>
          <p className="mt-1 text-[13px] text-slate-500">{method === 'upi' ? `Waiting for approval in ${upiApp}` : 'Contacting your bank'}</p>
        </div>
      )}
      {step === 'done' && (
        <div className="flex flex-col items-center py-4 text-center">
          <div className="flex size-14 animate-slide-up items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <CheckCircle2 size={32} />
          </div>
          <p className="mt-4 text-lg font-semibold text-slate-900">Payment successful</p>
          <p className="mt-1 text-sm text-slate-500">{formatINR(amount)} paid for {dueLabel(due.cycle)}</p>
          <div className="mt-6 grid w-full grid-cols-2 gap-2">
            <Button onClick={onClose}>Done</Button>
            <Button variant="primary" icon={Receipt} onClick={() => txnId && modals.open({ type: 'receipt', txnId })}>View receipt</Button>
          </div>
        </div>
      )}
    </Modal>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 text-sm">
      <span className="text-slate-500">{k}</span>
      <span className="font-medium text-slate-800 tabular">{v}</span>
    </div>
  )
}
