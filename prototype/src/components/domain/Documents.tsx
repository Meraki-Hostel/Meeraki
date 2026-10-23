import { useState } from 'react'
import { Download, Eye, FileText, IdCard, Receipt, ScrollText, Upload } from 'lucide-react'
import { useStore } from '../../store/AppStore'
import { dueLabel, idx, locationOf } from '../../store/selectors'
import type { Student } from '../../lib/types'
import { formatDate, formatDateLong, formatINR } from '../../lib/utils'
import { Button, Card, CardHeader, Modal, useToast } from '../ui'
import { useModals } from './ModalsProvider'

export function DocumentsList({ student, canUpload }: { student: Student; canUpload: boolean }) {
  const { data, uploadDocument } = useStore()
  const toast = useToast()
  const modals = useModals()
  const [agreement, setAgreement] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const txns = idx(data).txnsByStudent.get(student.id) ?? []
  const uploaded = data.documents.filter((d) => d.studentId === student.id)

  const mockDownload = (name: string) => toast.success('Download started', { description: `${name} (mock file)` })

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader title="Agreement & ID" subtitle="Generated at admission" action={canUpload && (
          <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-700 hover:bg-slate-50">
            <Upload size={15} /> Upload
            <input type="file" className="hidden" onChange={(e) => {
              const f = e.target.files?.[0]
              if (!f) return
              uploadDocument(student.id, f.name, /id|aadhaar|pan/i.test(f.name) ? 'ID Proof' : 'Other', `${Math.max(1, Math.round(f.size / 1024))} KB`)
              toast.success('Document uploaded', { description: `${f.name} (stored only in this browser demo)` })
              e.target.value = ''
            }} />
          </label>
        )} />
        <ul className="divide-y divide-slate-100 border-t border-slate-100">
          <DocRow icon={ScrollText} name="Hostel rental agreement" meta={`Signed ${formatDate(student.joinDate, { year: true })} · PDF`} onView={() => setAgreement(true)} onDownload={() => mockDownload('Hostel-agreement.pdf')} />
          <DocRow icon={IdCard} name="Government ID (Aadhaar)" meta={`${student.idNumber} · verified`} onView={() => setPreview('Government ID (Aadhaar)')} onDownload={() => mockDownload('Aadhaar.pdf')} />
          {uploaded.map((d) => (
            <DocRow key={d.id} icon={FileText} name={d.name} meta={`${d.kind} · ${d.size} · ${formatDate(d.uploadedAt, { year: true })}`} onView={() => setPreview(d.name)} onDownload={() => mockDownload(d.name)} />
          ))}
        </ul>
      </Card>
      <Card>
        <CardHeader title="Receipts" subtitle={`${txns.length} payments`} />
        <ul className="scrollbar-thin max-h-96 divide-y divide-slate-100 overflow-y-auto border-t border-slate-100">
          {txns.map((t) => {
            const due = data.dues.find((d) => d.id === t.dueId)
            return <DocRow key={t.id} icon={Receipt} name={`${t.receiptNo} · ${formatINR(t.amount)}`} meta={`${due ? dueLabel(due.cycle) : 'Rent'} · ${formatDate(t.date, { year: true })}`} onView={() => modals.open({ type: 'receipt', txnId: t.id })} />
          })}
          {!txns.length && <li className="px-5 py-8 text-center text-[13px] text-slate-500">No receipts yet.</li>}
        </ul>
      </Card>
      <AgreementModal open={agreement} onClose={() => setAgreement(false)} student={student} onDownload={() => mockDownload('Hostel-agreement.pdf')} />
      <Modal open={!!preview} onClose={() => setPreview(null)} title={preview ?? ''} size="sm">
        <div className="flex aspect-[4/3] flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-center">
          <FileText size={28} className="mb-2 text-slate-400" />
          <p className="text-sm font-medium text-slate-700">Document preview</p>
          <p className="mt-1 max-w-56 text-xs text-slate-500">Files are not stored in this prototype — this placeholder stands in for the real viewer.</p>
        </div>
      </Modal>
    </div>
  )
}

function DocRow({ icon: Icon, name, meta, onView, onDownload }: { icon: typeof FileText; name: string; meta: string; onView: () => void; onDownload?: () => void }) {
  return (
    <li className="flex items-center gap-3 px-5 py-3">
      <span className="flex size-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500"><Icon size={17} /></span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-slate-900">{name}</div>
        <div className="truncate text-xs text-slate-500">{meta}</div>
      </div>
      <Button size="sm" variant="ghost" icon={Eye} onClick={onView} aria-label="View" />
      {onDownload && <Button size="sm" variant="ghost" icon={Download} onClick={onDownload} aria-label="Download" />}
    </li>
  )
}

export function AgreementModal({ open, onClose, student, onDownload }: { open: boolean; onClose: () => void; student: Student; onDownload: () => void }) {
  const { data } = useStore()
  const p = data.properties.find((x) => x.id === student.propertyId)!
  const loc = locationOf(data, student)
  return (
    <Modal open={open} onClose={onClose} size="lg" title="Hostel rental agreement" footer={<Button variant="primary" icon={Download} onClick={onDownload}>Download PDF</Button>}>
      <article className="space-y-3 text-[13.5px] leading-relaxed text-slate-700">
        <p className="text-center text-xs font-semibold tracking-[0.14em] text-slate-400">LEAVE & LICENSE AGREEMENT</p>
        <p>This agreement is made on <b>{formatDateLong(student.joinDate)}</b> between <b>{p.name}</b>, {p.address} (“the Hostel”), and <b>{student.name}</b>, student of {student.college} (“the Resident”), with guardian <b>{student.guardianName || '—'}</b>.</p>
        <ol className="list-decimal space-y-2 pl-5">
          <li>The Resident is allotted <b>{loc ? `Room ${loc.room.number}, Bed ${loc.bed.label}` : 'a bed'}</b> on a shared basis for the academic year.</li>
          <li>Monthly rent of <b>{formatINR(student.monthlyRent)}</b> is payable on or before the {data.settings.rentDueDay}th of each month. A late fee of {formatINR(data.settings.lateFeePerDay)} per day applies after the due date.</li>
          <li>A refundable security deposit of <b>{formatINR(student.deposit)}</b> is held and returned within 15 days of checkout, less any damages.</li>
          <li>Visitors are allowed between 9 AM and 8 PM and must be registered at the reception.</li>
          <li>Leave or night-outs require prior approval from the warden through the Meraki app.</li>
          <li>Either party may terminate this agreement with 30 days’ written notice.</li>
        </ol>
        <div className="grid grid-cols-2 gap-6 pt-4 text-xs text-slate-500">
          <div className="border-t border-slate-200 pt-2">For {p.name}<br /><b className="text-slate-700">{p.managerName}</b></div>
          <div className="border-t border-slate-200 pt-2">Resident<br /><b className="text-slate-700">{student.name}</b></div>
        </div>
      </article>
    </Modal>
  )
}
