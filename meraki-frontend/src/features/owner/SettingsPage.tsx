import { useEffect, useState, type FormEvent } from 'react';
import { Laptop } from 'lucide-react';
import { services } from '@/services';
import type { OrganizationSettings } from '@/types/domain';
import { useQuery } from '@/hooks/useQuery';
import { useMutation } from '@/hooks/useMutation';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select, Switch, Textarea } from '@/components/ui/Field';
import { PageSkeleton } from '@/components/ui/States';

export function SettingsPage() {
  const q = useQuery(() => services.settings.get(), []);
  const [f, setF] = useState<OrganizationSettings | null>(null);
  useEffect(() => { if (q.data && !f) setF(q.data); }, [q.data, f]);
  const save = useMutation(services.settings.update, { success: 'Settings saved.', onSuccess: (s) => setF(s) });
  // Ends every session of this account, this one included, then returns to sign-in.
  const signOutAll = useMutation(() => services.auth.logoutAll(), { onSuccess: () => { window.location.assign('/login'); } });
  if (!f || !q.data) return <PageSkeleton />;
  const dirty = JSON.stringify(f) !== JSON.stringify(q.data);
  const set = <K extends keyof OrganizationSettings>(k: K, v: OrganizationSettings[K]) => setF({ ...f, [k]: v });
  const e = save.fieldErrors;
  const submit = (ev: FormEvent) => { ev.preventDefault(); void save.run(f); };
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
              <Input label="Late fee (₹, flat)" type="number" min={0} value={f.lateFeeFlat} onChange={(ev) => set('lateFeeFlat', Number(ev.target.value))} error={e.lateFeeFlat} hint="Added once per month when rent is still unpaid. 0 = off" />
              <Input label="Grace period (days)" type="number" min={0} max={30} value={f.lateFeeGraceDays} onChange={(ev) => set('lateFeeGraceDays', Number(ev.target.value))} error={e.lateFeeGraceDays} hint="Days after the due date before the late fee" />
              <Input label="Currency" value="Indian Rupee (₹)" disabled />
            </div>
            <div className="mt-2"><Switch label="Pro-rate the first month" description="A resident who moves in mid-month pays only for the days they stay" checked={f.prorateFirstMonth} onChange={(v) => set('prorateFirstMonth', v)} /></div>
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
          <CardHeader title="Security" subtitle="Sessions and sign-in" />
          <div className="mt-2 divide-y divide-line/70">
            <Switch label="Require two-step verification" description="Saved as your preference. Sign-in OTP is not available yet, so it is not enforced." checked={f.security.twoFactor} onChange={(v) => set('security', { ...f.security, twoFactor: v })} />
            <div className="py-3"><Select label="Sign out after inactivity" hint="Saved as your preference; sessions currently last until sign-out or 30 days." value={String(f.security.sessionTimeoutMins)} onChange={(ev) => set('security', { ...f.security, sessionTimeoutMins: Number(ev.target.value) })} options={[15, 30, 60, 240].map((m) => ({ value: String(m), label: m < 60 ? `${m} minutes` : `${m / 60} hour${m > 60 ? 's' : ''}` }))} /></div>
          </div>
          <p className="mt-4 flex items-center gap-2 text-sm text-bark"><Laptop className="size-4 text-dust" aria-hidden />Signed in on other devices or browsers you don’t recognise?</p>
          <Button variant="secondary" size="sm" className="mt-3" loading={signOutAll.pending} onClick={() => void signOutAll.run()}>Sign out everywhere</Button>
        </Card>
      </div>
    </form>
  );
}
