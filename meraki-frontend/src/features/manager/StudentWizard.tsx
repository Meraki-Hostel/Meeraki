import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import { services } from '@/services';
import type { StudentInput } from '@/services/interfaces';
import { useQuery } from '@/hooks/useQuery';
import { useMutation } from '@/hooks/useMutation';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Field';
import { DescriptionList } from '@/components/ui/Card';
import { BedPicker } from '@/components/domain/BedPicker';
import { rules, validate } from '@/lib/validation';
import { todayISO } from '@/lib/clock';
import { formatDate, formatINR, formatPhone } from '@/lib/format';
import { cn } from '@/lib/cn';

const STEPS = ['Personal', 'Guardian & emergency', 'Bed & rent', 'Review'];
type Form = Record<keyof Omit<StudentInput, 'year' | 'monthlyRent' | 'bedId'>, string> & { year: string; monthlyRent: string; bedId: string };

const blank = (): Form => ({ name: '', email: '', phone: '', gender: 'male', dob: '', studentCode: '', college: '', course: '', year: '1', address: '', bloodGroup: 'O+', guardianName: '', guardianRelation: 'Father', guardianPhone: '', emergencyName: '', emergencyPhone: '', joinedOn: todayISO(), monthlyRent: '', bedId: '' });

/** Four-step add-student wizard. Validates per step; the service re-validates duplicates on submit. */
export function StudentWizard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [f, setF] = useState<Form>(blank);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const rooms = useQuery(() => (open ? services.rooms.list() : Promise.resolve([])), [open]);
  useEffect(() => {
    if (!open) return;
    setStep(0); setErrors({}); const b = blank(); setF(b);
    void services.students.nextStudentCode().then((code) => setF((x) => ({ ...x, studentCode: code })));
  }, [open]);
  const set = (k: keyof Form, v: string) => { setF((x) => ({ ...x, [k]: v })); setErrors((e) => ({ ...e, [k]: '' })); };
  const bedRoom = rooms.data?.find((r) => r.beds.some((b) => b.id === f.bedId));
  const bed = bedRoom?.beds.find((b) => b.id === f.bedId);
  useEffect(() => { if (bedRoom) setF((x) => ({ ...x, monthlyRent: String(bedRoom.rent) })); }, [bedRoom?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const create = useMutation(services.students.create, { success: (s) => `${s.name} added${f.bedId ? ' and allotted a bed' : ''}. October rent has been raised.`, onSuccess: (s) => { onClose(); navigate(`/manager/students/${s.id}`); } });
  useEffect(() => {
    const fe = create.fieldErrors;
    if (!Object.keys(fe).length) return;
    setErrors(fe);
    const s1 = ['name', 'email', 'phone', 'dob', 'studentCode', 'college'];
    const s2 = ['guardianName', 'guardianPhone', 'emergencyPhone'];
    setStep(Object.keys(fe).some((k) => s1.includes(k)) ? 0 : Object.keys(fe).some((k) => s2.includes(k)) ? 1 : 2);
  }, [create.fieldErrors]);

  const checkStep = (): boolean => {
    const schemas: Array<Partial<Record<keyof Form, ReturnType<typeof rules.required>[]>>> = [
      { name: [rules.required('Full name'), rules.minLength(3, 'Full name')], email: [rules.required('Email'), rules.email()], phone: [rules.required('Mobile number'), rules.phone()], dob: [rules.required('Date of birth')], studentCode: [rules.required('Student ID')], college: [rules.required('College')], course: [rules.required('Course')] },
      { guardianName: [rules.required('Guardian name')], guardianPhone: [rules.required('Guardian phone'), rules.phone()], emergencyName: [rules.required('Emergency contact')], emergencyPhone: [rules.required('Emergency phone'), rules.phone()], address: [rules.required('Home address'), rules.minLength(8, 'Address')] },
      { monthlyRent: [rules.required('Monthly rent'), rules.positive('Monthly rent')], joinedOn: [rules.required('Move-in date')] },
    ];
    const v = validate(f, schemas[step] ?? {});
    setErrors(v as Record<string, string>);
    return Object.keys(v).length === 0;
  };
  const next = () => { if (checkStep()) setStep((s) => s + 1); };
  const submit = () => void create.run({ ...f, gender: f.gender as StudentInput['gender'], year: Number(f.year), monthlyRent: Number(f.monthlyRent), bedId: f.bedId || undefined });

  return (
    <Modal open={open} onClose={onClose} size="xl" title="Add student" description="Admission details, guardian, and bed allotment."
      footer={<>
        {step > 0 && <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>Back</Button>}
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        {step < 3 ? <Button onClick={next}>Continue</Button> : <Button loading={create.pending} onClick={submit}>Add student</Button>}
      </>}>
      <ol className="mb-6 flex flex-wrap gap-2" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s} aria-current={i === step ? 'step' : undefined} className={cn('flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium', i === step ? 'border-clay-400 bg-clay-50 text-clay-800' : i < step ? 'border-moss/30 bg-moss-wash text-moss' : 'border-line text-dust')}>
            <span className="grid size-5 place-items-center rounded-full bg-white/80 text-[11px]">{i < step ? <Check className="size-3" aria-hidden /> : i + 1}</span>{s}
          </li>
        ))}
      </ol>
      {step === 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Full name" required value={f.name} onChange={(e) => set('name', e.target.value)} error={errors.name} autoFocus />
          <Input label="Student ID" required value={f.studentCode} onChange={(e) => set('studentCode', e.target.value.toUpperCase())} error={errors.studentCode} hint="Suggested automatically; must be unique" />
          <Input label="Mobile number" required inputMode="tel" value={f.phone} onChange={(e) => set('phone', e.target.value)} error={errors.phone} placeholder="98765 43210" />
          <Input label="Email" type="email" required value={f.email} onChange={(e) => set('email', e.target.value)} error={errors.email} />
          <Select label="Gender" value={f.gender} onChange={(e) => set('gender', e.target.value)} options={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }, { value: 'other', label: 'Other' }]} />
          <Input label="Date of birth" type="date" required max="2010-12-31" value={f.dob} onChange={(e) => set('dob', e.target.value)} error={errors.dob} />
          <Input label="College" required value={f.college} onChange={(e) => set('college', e.target.value)} error={errors.college} placeholder="e.g. Lucknow University" />
          <Input label="Course" required value={f.course} onChange={(e) => set('course', e.target.value)} error={errors.course} placeholder="e.g. B.Com" />
          <Select label="Year" value={f.year} onChange={(e) => set('year', e.target.value)} options={['1', '2', '3', '4', '5'].map((y) => ({ value: y, label: `Year ${y}` }))} />
          <Select label="Blood group" value={f.bloodGroup} onChange={(e) => set('bloodGroup', e.target.value)} options={['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map((b) => ({ value: b, label: b }))} />
        </div>
      )}
      {step === 1 && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Guardian name" required value={f.guardianName} onChange={(e) => set('guardianName', e.target.value)} error={errors.guardianName} />
          <Select label="Relation" value={f.guardianRelation} onChange={(e) => set('guardianRelation', e.target.value)} options={['Father', 'Mother', 'Uncle', 'Aunt', 'Sibling', 'Other'].map((r) => ({ value: r, label: r }))} />
          <Input label="Guardian phone" required inputMode="tel" value={f.guardianPhone} onChange={(e) => set('guardianPhone', e.target.value)} error={errors.guardianPhone} />
          <span className="hidden sm:block" />
          <Input label="Emergency contact name" required value={f.emergencyName} onChange={(e) => set('emergencyName', e.target.value)} error={errors.emergencyName} />
          <Input label="Emergency phone" required inputMode="tel" value={f.emergencyPhone} onChange={(e) => set('emergencyPhone', e.target.value)} error={errors.emergencyPhone} />
          <Textarea className="sm:col-span-2" rows={2} label="Home address" required value={f.address} onChange={(e) => set('address', e.target.value)} error={errors.address} />
        </div>
      )}
      {step === 2 && (
        <div className="space-y-4">
          <BedPicker rooms={rooms.data} loading={rooms.loading} value={f.bedId || null} onChange={(id) => set('bedId', id ?? '')} />
          <div className="grid gap-4 sm:grid-cols-3">
            <Input label="Monthly rent (₹)" type="number" required value={f.monthlyRent} onChange={(e) => set('monthlyRent', e.target.value)} error={errors.monthlyRent} hint={bedRoom ? `Room ${bedRoom.number} rate` : 'Set from the bed you pick'} />
            <Input label="Move-in date" type="date" required value={f.joinedOn} onChange={(e) => set('joinedOn', e.target.value)} error={errors.joinedOn} />
            <div className="flex items-end">{f.bedId ? <Button variant="ghost" size="sm" onClick={() => set('bedId', '')}>Skip bed for now</Button> : <p className="text-xs text-dust">No bed selected — the student will be “Awaiting bed”.</p>}</div>
          </div>
        </div>
      )}
      {step === 3 && (
        <div className="space-y-5">
          <DescriptionList cols={3} items={[
            { label: 'Name', value: f.name }, { label: 'Student ID', value: f.studentCode }, { label: 'Mobile', value: formatPhone(f.phone) },
            { label: 'Email', value: f.email }, { label: 'College', value: `${f.college}, ${f.course} (Year ${f.year})` }, { label: 'Date of birth', value: formatDate(f.dob) },
            { label: 'Guardian', value: `${f.guardianName} (${f.guardianRelation}) · ${formatPhone(f.guardianPhone)}` }, { label: 'Emergency', value: `${f.emergencyName} · ${formatPhone(f.emergencyPhone)}` },
            { label: 'Bed', value: bed && bedRoom ? `Room ${bedRoom.number}, Bed ${bed.label}` : 'Not allotted yet' }, { label: 'Rent', value: formatINR(Number(f.monthlyRent)) }, { label: 'Move-in', value: formatDate(f.joinedOn) },
          ]} />
          <p className="rounded-xl bg-sand/60 px-3 py-2 text-xs text-bark">On save: the document checklist is created and October rent is raised as a due.</p>
        </div>
      )}
    </Modal>
  );
}
