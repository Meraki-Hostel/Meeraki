import { useEffect, useState, type FormEvent } from 'react';
import { services } from '@/services';
import type { PropertyInput } from '@/services/interfaces';
import type { Property, PropertyStatus, PropertyType } from '@/types/domain';
import { useQuery } from '@/hooks/useQuery';
import { Button } from '@/components/ui/Button';
import { Checkbox, Input, RadioGroup, Select, Textarea } from '@/components/ui/Field';
import { rules, validate } from '@/lib/validation';

const AMENITIES = ['Wi-Fi', 'Mess', 'Laundry', 'CCTV', 'Power backup', 'Study room', 'Gym', 'AC rooms', 'Parking', 'Biometric entry', 'Co-working lounge'];

export interface PropertyFormProps {
  initial?: Property;
  submitLabel: string;
  pending: boolean;
  serverErrors: Record<string, string>;
  onSubmit: (input: PropertyInput) => void;
  onCancel: () => void;
}

export function PropertyForm({ initial, submitLabel, pending, serverErrors, onSubmit, onCancel }: PropertyFormProps) {
  const managers = useQuery(() => services.staff.list({ role: 'manager' }), []);
  const [f, setF] = useState({
    name: initial?.name ?? '', code: initial?.code ?? '', type: (initial?.type ?? 'boys') as PropertyType, status: (initial?.status ?? 'onboarding') as PropertyStatus,
    locality: initial?.locality ?? '', city: initial?.city ?? 'Lucknow', address: initial?.address ?? '', pincode: initial?.pincode ?? '', phone: initial?.phone ?? '',
    baseRent: initial ? String(initial.baseRent) : '9000', amenities: initial?.amenities ?? ['Wi-Fi', 'Mess', 'CCTV'], managerStaffId: initial?.managerStaffId ?? '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => { setErrors(serverErrors); }, [serverErrors]);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => { setF((p) => ({ ...p, [k]: v })); setErrors((e) => ({ ...e, [k]: '' })); };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const v = validate(f, {
      name: [rules.required('Property name'), rules.minLength(3, 'Property name')], code: [rules.required('Short code')], locality: [rules.required('Locality')],
      city: [rules.required('City')], address: [rules.required('Address')], pincode: [rules.required('PIN code'), rules.pincode()], phone: [rules.required('Phone'), rules.phone()],
      baseRent: [rules.required('Base rent'), rules.positive('Base rent')],
    });
    setErrors(v as Record<string, string>);
    if (Object.keys(v).length) { document.getElementById(`pf-${Object.keys(v)[0]}`)?.focus(); return; }
    onSubmit({ ...f, code: f.code.toUpperCase(), baseRent: Number(f.baseRent), managerStaffId: f.managerStaffId || undefined });
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-3 font-display text-lg font-semibold">Basics</legend>
        <Input id="pf-name" label="Property name" required value={f.name} onChange={(e) => set('name', e.target.value)} error={errors.name} placeholder="e.g. Lotus Residency" />
        <Input id="pf-code" label="Short code" required maxLength={3} value={f.code} onChange={(e) => set('code', e.target.value.toUpperCase())} error={errors.code} hint="2–3 letters used in student IDs, e.g. LR" />
        <RadioGroup label="Residents" name="ptype" inline value={f.type} onChange={(v) => set('type', v)} options={[{ value: 'boys', label: 'Boys' }, { value: 'girls', label: 'Girls' }, { value: 'coed', label: 'Co-ed' }]} />
        <Select label="Status" value={f.status} onChange={(e) => set('status', e.target.value as PropertyStatus)} options={[{ value: 'onboarding', label: 'Onboarding' }, { value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} hint="Onboarding properties are still being set up" />
      </fieldset>
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-3 font-display text-lg font-semibold">Location & contact</legend>
        <Textarea id="pf-address" className="sm:col-span-2" rows={2} label="Street address" required value={f.address} onChange={(e) => set('address', e.target.value)} error={errors.address} />
        <Input id="pf-locality" label="Locality" required value={f.locality} onChange={(e) => set('locality', e.target.value)} error={errors.locality} placeholder="e.g. Mahanagar" />
        <Input id="pf-city" label="City" required value={f.city} onChange={(e) => set('city', e.target.value)} error={errors.city} />
        <Input id="pf-pincode" label="PIN code" required inputMode="numeric" maxLength={6} value={f.pincode} onChange={(e) => set('pincode', e.target.value.replace(/\D/g, ''))} error={errors.pincode} />
        <Input id="pf-phone" label="Front desk phone" required inputMode="tel" value={f.phone} onChange={(e) => set('phone', e.target.value)} error={errors.phone} placeholder="94150 23401" />
      </fieldset>
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-3 font-display text-lg font-semibold">Operations</legend>
        <Input id="pf-baseRent" label="Base rent per bed (₹/month)" type="number" min={1000} required value={f.baseRent} onChange={(e) => set('baseRent', e.target.value)} error={errors.baseRent} />
        <Select label="Manager" value={f.managerStaffId} onChange={(e) => set('managerStaffId', e.target.value)} placeholder="Assign later" options={(managers.data ?? []).map((m) => ({ value: m.id, label: `${m.name}${m.propertyName && m.propertyId !== initial?.id ? ` (now at ${m.propertyName})` : ''}` }))} hint="Invite a new manager from Staff" />
        <div className="sm:col-span-2">
          <p className="mb-2 text-[13px] font-medium text-bark">Amenities</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {AMENITIES.map((a) => <Checkbox key={a} label={a} checked={f.amenities.includes(a)} onChange={(e) => set('amenities', e.target.checked ? [...f.amenities, a] : f.amenities.filter((x) => x !== a))} />)}
          </div>
        </div>
      </fieldset>
      <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={pending}>{submitLabel}</Button>
      </div>
    </form>
  );
}
