import { useMemo, useState } from 'react'
import { ImagePlus, Megaphone, X } from 'lucide-react'
import { useStore } from '../../store/AppStore'
import { idx, locationOf } from '../../store/selectors'
import type { AnnouncementCategory, ComplaintCategory, Priority, Student } from '../../lib/types'
import { COMPLAINT_CATEGORIES, CATEGORY_META } from '../../lib/meta'
import { cn, sleep } from '../../lib/utils'
import { Button, Field, Input, Modal, Segmented, Select, Textarea, Toggle, useToast } from '../ui'

export function ComplaintFormModal({ open, onClose, propertyId, studentId: preset, studentMode }: { open: boolean; onClose: () => void; propertyId: string; studentId?: string; studentMode?: boolean }) {
  const { data, createComplaint } = useStore()
  const toast = useToast()
  const [studentId, setStudentId] = useState(preset ?? '')
  const [category, setCategory] = useState<ComplaintCategory>('Electrical')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<Priority>('medium')
  const [image, setImage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const students = useMemo(() => data.students.filter((s) => s.propertyId === propertyId && s.status === 'active' && s.bedId).sort((a, b) => a.name.localeCompare(b.name)), [data.students, propertyId])
  const student = studentId ? idx(data).student.get(studentId) : null
  const loc = locationOf(data, student)

  const submit = async () => {
    if (title.trim().length < 3) return toast.error('Add a short title for the complaint.')
    setSaving(true)
    await sleep(500)
    const c = createComplaint({ propertyId, studentId: studentId || null, roomId: loc?.room.id ?? null, category, title: title.trim(), description: description.trim(), priority, hasImage: !!image })
    setSaving(false)
    toast.success(studentMode ? 'Complaint submitted' : 'Complaint created', { description: `#${c.number} · ${c.title}${studentMode ? ' — the hostel team has been notified.' : ''}` })
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={studentMode ? 'Raise a complaint' : 'New complaint'} description={loc ? `Room ${loc.room.number}` : undefined}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" loading={saving} onClick={submit}>{studentMode ? 'Submit complaint' : 'Create complaint'}</Button></>}>
      <div className="space-y-4">
        {!studentMode && (
          <Field label="Student" hint="Leave empty for common-area issues">
            <Select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
              <option value="">Common area / no student</option>
              {students.map((s: Student) => (
                <option key={s.id} value={s.id}>
                  {s.name} — {locationOf(data, s)?.label}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Category">
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
            {COMPLAINT_CATEGORIES.map((c) => {
              const M = CATEGORY_META[c]
              return (
                <button key={c} type="button" onClick={() => setCategory(c)} className={cn('flex flex-col items-center gap-1.5 rounded-xl border px-1 py-2.5 text-[11px] font-medium transition-all', category === c ? 'border-brand-500 bg-brand-50 text-brand-800 ring-3 ring-brand-500/15' : 'border-slate-200 text-slate-600 hover:border-slate-300')}>
                  <M.icon size={18} strokeWidth={1.75} />
                  {c}
                </button>
              )
            })}
          </div>
        </Field>
        <Field label="Title" required>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Fan not working" />
        </Field>
        <Field label="Description">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the issue so the team can come prepared" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Priority">
            <Segmented items={[{ value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }]} value={priority} onChange={setPriority} />
          </Field>
          <Field label="Photo" hint="Optional (mock upload)">
            {image ? (
              <div className="flex h-10 items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm">
                <span className="truncate text-slate-700">{image}</span>
                <button type="button" onClick={() => setImage(null)} className="text-slate-400 hover:text-slate-700" aria-label="Remove photo">
                  <X size={15} />
                </button>
              </div>
            ) : (
              <label className="flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 text-sm text-slate-500 hover:border-slate-400 hover:text-slate-700">
                <ImagePlus size={16} />
                Attach photo
                <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && setImage(e.target.files[0].name)} />
              </label>
            )}
          </Field>
        </div>
      </div>
    </Modal>
  )
}

export function AnnouncementModal({ open, onClose, propertyId }: { open: boolean; onClose: () => void; propertyId: string }) {
  const { data, publishAnnouncement } = useStore()
  const toast = useToast()
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [category, setCategory] = useState<AnnouncementCategory>('General')
  const [audience, setAudience] = useState<'all' | 'floor' | 'room'>('all')
  const [audienceValue, setAudienceValue] = useState('')
  const [pinned, setPinned] = useState(false)
  const [saving, setSaving] = useState(false)
  const rooms = data.rooms.filter((r) => r.propertyId === propertyId)
  const floors = Array.from(new Set(rooms.map((r) => r.floor))).sort()

  const publish = async () => {
    if (!title.trim() || !message.trim()) return toast.error('Add a title and message.')
    if (audience !== 'all' && !audienceValue) return toast.error(`Select a ${audience}.`)
    setSaving(true)
    await sleep(500)
    publishAnnouncement({ propertyId, title: title.trim(), message: message.trim(), category, audience, audienceValue: audience === 'all' ? undefined : audienceValue, pinned })
    setSaving(false)
    const who = audience === 'all' ? 'all students' : audience === 'floor' ? `Floor ${audienceValue}` : `Room ${rooms.find((r) => r.id === audienceValue)?.number}`
    toast.success('Announcement published', { description: `Visible to ${who} on the student app.` })
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="New announcement" description="Students see this on their home screen and notices"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" icon={Megaphone} loading={saving} onClick={publish}>Publish</Button></>}>
      <div className="space-y-4">
        <Field label="Title" required>
          <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Water maintenance" />
        </Field>
        <Field label="Message" required>
          <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="e.g. Water supply will be unavailable from 2 PM to 4 PM." />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Type">
            <Select value={category} onChange={(e) => setCategory(e.target.value as AnnouncementCategory)}>
              {(['General', 'Maintenance', 'Event', 'Important'] as const).map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
          <Field label="Audience">
            <Segmented items={[{ value: 'all', label: 'All students' }, { value: 'floor', label: 'Floor' }, { value: 'room', label: 'Room' }]} value={audience} onChange={(v) => { setAudience(v); setAudienceValue('') }} />
          </Field>
        </div>
        {audience === 'floor' && (
          <Field label="Floor">
            <Select value={audienceValue} onChange={(e) => setAudienceValue(e.target.value)}>
              <option value="">Select floor</option>
              {floors.map((f) => (
                <option key={f} value={String(f)}>
                  Floor {f}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {audience === 'room' && (
          <Field label="Room">
            <Select value={audienceValue} onChange={(e) => setAudienceValue(e.target.value)}>
              <option value="">Select room</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  Room {r.number} ({r.building})
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Toggle checked={pinned} onChange={setPinned} label="Pin to top" description="Shown as the highlighted notice on the student home screen" />
      </div>
    </Modal>
  )
}

export function EditStudentModal({ open, onClose, student }: { open: boolean; onClose: () => void; student: Student }) {
  const { updateStudent } = useStore()
  const toast = useToast()
  const [f, setF] = useState({ name: student.name, phone: student.phone, email: student.email, guardianName: student.guardianName, guardianPhone: student.guardianPhone, college: student.college, course: student.course, monthlyRent: student.monthlyRent })
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((x) => ({ ...x, [k]: k === 'monthlyRent' ? Number(e.target.value) : e.target.value }))
  const save = () => {
    if (f.name.trim().length < 3) return toast.error('Name is required.')
    updateStudent(student.id, f)
    toast.success('Profile updated')
    onClose()
  }
  return (
    <Modal open={open} onClose={onClose} title="Edit student" footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>Save changes</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" className="sm:col-span-2"><Input value={f.name} onChange={set('name')} /></Field>
        <Field label="Mobile"><Input value={f.phone} onChange={set('phone')} /></Field>
        <Field label="Email"><Input value={f.email} onChange={set('email')} /></Field>
        <Field label="Guardian name"><Input value={f.guardianName} onChange={set('guardianName')} /></Field>
        <Field label="Guardian phone"><Input value={f.guardianPhone} onChange={set('guardianPhone')} /></Field>
        <Field label="College"><Input value={f.college} onChange={set('college')} /></Field>
        <Field label="Course"><Input value={f.course} onChange={set('course')} /></Field>
        <Field label="Monthly rent" hint="Applies to future invoices"><Input prefix="₹" type="number" value={f.monthlyRent} onChange={set('monthlyRent')} /></Field>
      </div>
    </Modal>
  )
}
