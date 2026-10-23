import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, BedDouble, Check, IndianRupee, User, ClipboardCheck } from 'lucide-react'
import { useStore } from '../../store/AppStore'
import { idx } from '../../store/selectors'
import { DEMO_TODAY, cn, formatDate, formatINR, sleep } from '../../lib/utils'
import { Button, Field, Input, Modal, Select, Toggle, useToast } from '../ui'
import { BedPicker } from './BedPicker'

const STEPS = [
  { key: 'details', label: 'Student details', icon: User },
  { key: 'room', label: 'Room & bed', icon: BedDouble },
  { key: 'fees', label: 'Fees', icon: IndianRupee },
  { key: 'review', label: 'Review', icon: ClipboardCheck },
] as const

const COURSES = ['B.Tech CSE', 'B.Tech ECE', 'B.Tech Mechanical', 'BBA', 'B.Com', 'MBA', 'B.Pharm', 'MBBS', 'B.Des', 'BCA', 'M.Tech', 'BA LLB']

export function AddStudentWizard({ open, onClose, propertyId, presetBedId }: { open: boolean; onClose: () => void; propertyId: string; presetBedId?: string }) {
  const { data, addStudent } = useStore()
  const toast = useToast()
  const navigate = useNavigate()
  const property = data.properties.find((p) => p.id === propertyId)!
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [form, setForm] = useState({
    name: '', phone: '', email: '', gender: 'M' as 'M' | 'F', guardianName: '', guardianPhone: '',
    college: property.colleges[0] ?? '', course: 'B.Tech CSE', idNumber: '',
  })
  const [bedId, setBedId] = useState<string | null>(presetBedId ?? null)
  const presetRoom = presetBedId ? idx(data).room.get(idx(data).bed.get(presetBedId)!.roomId) : null
  const [fees, setFees] = useState({ rent: presetRoom?.rent ?? 8000, deposit: presetRoom ? Math.round((presetRoom.rent * 1.5) / 1000) * 1000 : 12000, joinDate: DEMO_TODAY, depositPaid: true })

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const i = idx(data)
  const bed = bedId ? i.bed.get(bedId) : null
  const room = bed ? i.room.get(bed.roomId) : null

  const validateDetails = () => {
    const e: Record<string, string> = {}
    if (form.name.trim().length < 3) e.name = 'Enter the student’s full name'
    if (form.phone.replace(/\D/g, '').length !== 10) e.phone = 'Enter a 10-digit mobile number'
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) e.email = 'Enter a valid email'
    if (form.guardianPhone && form.guardianPhone.replace(/\D/g, '').length !== 10) e.guardianPhone = 'Enter a 10-digit mobile number'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const next = () => {
    if (step === 0 && !validateDetails()) return
    if (step === 1) {
      if (!bedId) return toast.error('Please select a bed.', { description: 'Choose a room, then pick an available bed.' })
      if (room) setFees((f) => ({ ...f, rent: room.rent, deposit: Math.round((room.rent * 1.5) / 1000) * 1000 }))
    }
    setStep((s) => Math.min(3, s + 1))
  }

  const submit = async () => {
    if (!bedId) return
    setSaving(true)
    await sleep(650)
    const res = addStudent({ ...form, bedId, monthlyRent: fees.rent, deposit: fees.deposit, joinDate: fees.joinDate, depositPaid: fees.depositPaid })
    setSaving(false)
    if (!res.ok) return toast.error(res.error)
    toast.success('Student added successfully.', {
      description: `${form.name} → Room ${room?.number}-${bed?.label}`,
      action: { label: 'View profile', onClick: () => navigate(`/manager/students/${res.studentId}`) },
    })
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Add student"
      description={`${property.name} · Step ${step + 1} of 4`}
      footer={
        <>
          {step > 0 && (
            <Button icon={ArrowLeft} onClick={() => setStep((s) => s - 1)} className="sm:mr-auto">
              Back
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          {step < 3 ? (
            <Button variant="primary" iconRight={ArrowRight} onClick={next}>
              Continue
            </Button>
          ) : (
            <Button variant="primary" icon={Check} loading={saving} onClick={submit}>
              Add Student
            </Button>
          )}
        </>
      }
    >
      <ol className="mb-6 grid grid-cols-4 gap-2">
        {STEPS.map((s, n) => (
          <li key={s.key} className="min-w-0">
            <div className={cn('h-1 rounded-full', n <= step ? 'bg-brand-600' : 'bg-slate-200')} />
            <div className={cn('mt-2 flex items-center gap-1.5 text-xs font-medium', n === step ? 'text-slate-900' : n < step ? 'text-brand-700' : 'text-slate-400')}>
              {n < step ? <Check size={13} /> : <s.icon size={13} />}
              <span className="truncate">{s.label}</span>
            </div>
          </li>
        ))}
      </ol>

      {step === 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" required error={errors.name} className="sm:col-span-2">
            <Input autoFocus value={form.name} onChange={set('name')} placeholder="e.g. Kunal Joshi" invalid={!!errors.name} />
          </Field>
          <Field label="Mobile number" required error={errors.phone}>
            <Input value={form.phone} onChange={set('phone')} placeholder="98260 12345" inputMode="numeric" invalid={!!errors.phone} />
          </Field>
          <Field label="Email" error={errors.email}>
            <Input value={form.email} onChange={set('email')} placeholder="kunal.joshi@gmail.com" type="email" invalid={!!errors.email} />
          </Field>
          <Field label="Guardian name">
            <Input value={form.guardianName} onChange={set('guardianName')} placeholder="e.g. Sanjay Joshi" />
          </Field>
          <Field label="Guardian phone" error={errors.guardianPhone}>
            <Input value={form.guardianPhone} onChange={set('guardianPhone')} placeholder="94250 67890" inputMode="numeric" invalid={!!errors.guardianPhone} />
          </Field>
          <Field label="College">
            <Select value={form.college} onChange={set('college')}>
              {property.colleges.map((c) => (
                <option key={c}>{c}</option>
              ))}
              <option>Other</option>
            </Select>
          </Field>
          <Field label="Course">
            <Select value={form.course} onChange={set('course')}>
              {COURSES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
          <Field label="Gender">
            <Select value={form.gender} onChange={set('gender')}>
              <option value="M">Male</option>
              <option value="F">Female</option>
            </Select>
          </Field>
          <Field label="ID number" hint="Aadhaar / college ID — stored masked">
            <Input value={form.idNumber} onChange={set('idNumber')} placeholder="XXXX XXXX 1234" />
          </Field>
        </div>
      )}

      {step === 1 && <BedPicker propertyId={propertyId} value={bedId} onChange={setBedId} />}

      {step === 2 && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-sm sm:col-span-2">
            <span className="text-slate-500">Allocated: </span>
            <span className="font-medium text-slate-900">
              Room {room?.number}-{bed?.label} · {room?.type} · {room?.building}
            </span>
          </div>
          <Field label="Monthly rent" hint={`Standard rent for this room: ${formatINR(room?.rent ?? 0)}`}>
            <Input prefix="₹" type="number" value={fees.rent} onChange={(e) => setFees((f) => ({ ...f, rent: Number(e.target.value) }))} />
          </Field>
          <Field label="Security deposit">
            <Input prefix="₹" type="number" value={fees.deposit} onChange={(e) => setFees((f) => ({ ...f, deposit: Number(e.target.value) }))} />
          </Field>
          <Field label="Joining date">
            <Input type="date" value={fees.joinDate} onChange={(e) => setFees((f) => ({ ...f, joinDate: e.target.value }))} />
          </Field>
          <div className="flex items-end pb-2">
            <Toggle checked={fees.depositPaid} onChange={(v) => setFees((f) => ({ ...f, depositPaid: v }))} label="Deposit collected now" description="Records the deposit and generates a receipt" />
          </div>
          <p className="text-[13px] text-slate-500 sm:col-span-2">The first rent invoice ({formatINR(fees.rent)}, October 2026) will be generated automatically with due date 5 Oct.</p>
        </div>
      )}

      {step === 3 && (
        <div className="grid gap-3 sm:grid-cols-2">
          <ReviewBlock title="Student" onEdit={() => setStep(0)} rows={[['Name', form.name], ['Mobile', form.phone], ['Email', form.email || '—'], ['Guardian', form.guardianName ? `${form.guardianName} · ${form.guardianPhone}` : '—'], ['College', `${form.college} · ${form.course}`]]} />
          <ReviewBlock title="Room & bed" onEdit={() => setStep(1)} rows={[['Room', `${room?.number} (${room?.type})`], ['Bed', `Bed ${bed?.label}`], ['Building', `${room?.building}, Floor ${room?.floor}`]]} />
          <ReviewBlock title="Fees" onEdit={() => setStep(2)} className="sm:col-span-2" rows={[['Monthly rent', formatINR(fees.rent)], ['Security deposit', `${formatINR(fees.deposit)}${fees.depositPaid ? ' · collected' : ' · pending'}`], ['Joining date', formatDate(fees.joinDate, { year: true })]]} />
        </div>
      )}
    </Modal>
  )
}

function ReviewBlock({ title, rows, onEdit, className }: { title: string; rows: [string, string][]; onEdit: () => void; className?: string }) {
  return (
    <div className={cn('rounded-xl border border-slate-200 p-4', className)}>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold tracking-wide text-slate-400 uppercase">{title}</span>
        <button onClick={onEdit} className="text-xs font-medium text-brand-700 hover:text-brand-800">
          Edit
        </button>
      </div>
      <dl className="space-y-1.5">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 text-sm">
            <dt className="text-slate-500">{k}</dt>
            <dd className="text-right font-medium text-slate-800">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
