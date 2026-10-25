import { useEffect, useState, type FormEvent } from 'react';
import { Laptop, RotateCcw, Smartphone } from 'lucide-react';
import { services } from '@/services';
import type { OrganizationSettings } from '@/types/domain';
import { useQuery } from '@/hooks/useQuery';
import { useMutation } from '@/hooks/useMutation';
import { useConfirm } from '@/app/providers/ConfirmProvider';
import { useToast } from '@/app/providers/ToastProvider';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select, Switch, Textarea } from '@/components/ui/Field';
import { PageSkeleton } from '@/components/ui/States';

export function SettingsPage() {
  const q = useQuery(() => services.settings.get(), []);
  const [f, setF] = useState<OrganizationSettings | null>(null);
  const confirm = useConfirm();
  const toast = useToast();
  useEffect(() => { if (q.data && !f) setF(q.data); }, [q.data, f]);
  const save = useMutation(services.settings.update, { success: 'Settings saved. They’ll persist after refresh.', onSuccess: (s) => setF(s) });
  if (!f || !q.data) return <PageSkeleton />;
  const dirty = JSON.stringify(f) !== JSON.stringify(q.data);
  const set = <K extends keyof OrganizationSettings>(k: K, v: OrganizationSettings[K]) => setF({ ...f, [k]: v });
  const e = save.fieldErrors;
  const submit = (ev: FormEvent) => { ev.preventDefault(); void save.run(f); };
  const reset = async () => {
    if (!(await confirm({ title: 'Reset all demo data?', message: 'Every change made in this browser will be replaced with the original demo data. This cannot be undone.', confirmLabel: 'Reset demo data', tone: 'danger' }))) return;
    await services.settings.resetDemoData();
    setF(null);
    toast.success('Demo data restored.');
  };

  return (
    <form onSubmit={submit} noValidate>
      <PageHeader title="Settings" subtitle="Organization profile, rent rules, notifications and security."
        actions={<><Button variant="ghost" disabled={!dirty} onClick={() => { setF(q.data!); save.clearErrors(); }}>Discard</Button><Button type="submit" loading={save.pending} disabled={!dirty} title={dirty ? undefined : 'No unsaved changes'}>Save changes</Button></>} />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <CardHeader title="Organization" subtitle="Shown on receipts and invitations" />
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Input label="Display name" required value={f.orgName} onChange={(ev) => set('orgName', ev.target.value)} error={e.orgName} />
            <Input label="Legal name" value={f.legalName} onChange={(ev) => set('legalName', ev.target.value)} />
            <Input label="Contact email" type="email" required value={f.contactEmail} onChange={(ev) => set('contactEmail', ev.target.value)} error={e.contactEmail} />
            <Input label="Contact phone" required value={f.contactPhone} onChange={(ev) => set('contactPhone', ev.target.value)} error={e.contactPhone} />
            <Input label="GSTIN" value={f.gstin} onChange={(ev) => set('gstin', ev.target.value.toUpperCase())} error={e.gstin} maxLength={15} />
            <Input label="Website" value={f.website} onChange={(ev) => set('website', ev.target.value)} />
            <Textarea className="sm:col-span-2" rows={2} label="Registered address" value={f.address} onChange={(ev) => set('address', ev.target.value)} />
          </div>
        </Card>
        <div className="space-y-5">
          <Card className="p-5">
            <CardHeader title="Rent rules" subtitle="Applied when new monthly charges are raised" />
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Input label="Rent due day" type="number" min={1} max={28} value={f.rentDueDay} onChange={(ev) => set('rentDueDay', Number(ev.target.value))} error={e.rentDueDay} hint="Day of month, 1–28" />
              <Input label="Late fee per day (₹)" type="number" min={0} value={f.lateFeePerDay} onChange={(ev) => set('lateFeePerDay', Number(ev.target.value))} error={e.lateFeePerDay} />
              <Input label="Currency" value="Indian Rupee (₹)" disabled />
              <Input label="Time zone" value="Asia/Kolkata (IST)" disabled />
            </div>
          </Card>
          <Card className="p-5">
            <CardHeader title="Notify me about" />
            <div className="mt-2 divide-y divide-line/70">
              {([['paymentReceived', 'Payments received', 'Each time a manager records rent'], ['newComplaint', 'Urgent complaints', 'Complaints marked urgent by residents'], ['leaveRequests', 'Leave requests', 'Copied when managers receive them'], ['lowStock', 'Low stock', 'When an item drops to its reorder level'], ['weeklySummary', 'Weekly summary', 'Monday morning portfolio digest']] as const).map(([k, l, d]) => (
                <Switch key={k} label={l} description={d} checked={f.notifications[k]} onChange={(v) => set('notifications', { ...f.notifications, [k]: v })} />
              ))}
            </div>
          </Card>
        </div>
        <Card className="p-5">
          <CardHeader title="Security" subtitle="Demo controls — authentication is mocked" />
          <div className="mt-2 divide-y divide-line/70">
            <Switch label="Require two-step verification" description="OTP on sign-in for all staff (not enforced in demo)" checked={f.security.twoFactor} onChange={(v) => set('security', { ...f.security, twoFactor: v })} />
            <div className="py-3"><Select label="Sign out after inactivity" value={String(f.security.sessionTimeoutMins)} onChange={(ev) => set('security', { ...f.security, sessionTimeoutMins: Number(ev.target.value) })} options={[15, 30, 60, 240].map((m) => ({ value: String(m), label: m < 60 ? `${m} minutes` : `${m / 60} hour${m > 60 ? 's' : ''}` }))} /></div>
          </div>
          <h3 className="mb-2 mt-4 text-base font-semibold">Active sessions</h3>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center gap-3 rounded-xl bg-sand/50 px-3 py-2"><Laptop className="size-4 text-dust" aria-hidden /><span className="flex-1">This browser · Lucknow</span><span className="text-xs text-moss">Current</span></li>
            <li className="flex items-center gap-3 rounded-xl bg-sand/50 px-3 py-2"><Smartphone className="size-4 text-dust" aria-hidden /><span className="flex-1">Android app · 2 days ago (sample)</span></li>
          </ul>
          <Button variant="secondary" size="sm" className="mt-3" onClick={() => toast.info('Other sessions would be signed out. Sessions are simulated in demo mode.')}>Sign out other sessions</Button>
        </Card>
        <Card className="border-brick/30 p-5">
          <CardHeader title="Demo data" subtitle="Everything you change lives in this browser’s storage" />
          <p className="mt-3 text-sm text-bark">Resetting restores the original properties, residents, payments and requests. You will stay signed in.</p>
          <Button variant="danger" className="mt-4" icon={<RotateCcw className="size-4" />} onClick={() => void reset()}>Reset demo data</Button>
        </Card>
      </div>
    </form>
  );
}
