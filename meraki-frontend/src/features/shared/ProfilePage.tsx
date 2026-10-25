import { useEffect, useState, type FormEvent } from 'react';
import { services } from '@/services';
import { useCurrentUser } from '@/app/providers/SessionProvider';
import { useMutation } from '@/hooks/useMutation';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader, DescriptionList } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Input, Switch } from '@/components/ui/Field';
import { formatDateTime, formatPhone } from '@/lib/format';
import { useSession } from '@/app/providers/SessionProvider';

export function ProfilePage() {
  const user = useCurrentUser();
  const { info } = useSession();
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone);
  useEffect(() => { setName(user.name); setPhone(user.phone); }, [user.name, user.phone]);
  const save = useMutation(services.auth.updateProfile, { success: 'Profile saved.' });
  const pref = useMutation(services.auth.updateProfile, { success: 'Preference saved.' });

  const submit = (e: FormEvent) => { e.preventDefault(); void save.run({ name, phone }); };
  const roleLabel = user.role === 'owner' ? 'Owner' : user.role === 'manager' ? 'Manager' : 'Student';

  return (
    <>
      <PageHeader title="My account" subtitle="Your demo persona, contact details and preferences." />
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-1">
          <div className="flex flex-col items-center text-center">
            <Avatar name={user.name} size="xl" />
            <h2 className="mt-3 text-xl font-semibold">{user.name}</h2>
            <p className="text-sm text-dust">{user.title}</p>
            <div className="mt-3"><Badge tone="clay">{roleLabel}</Badge></div>
          </div>
          <div className="mt-6 border-t border-line pt-5">
            <DescriptionList cols={1} items={[
              { label: 'Email', value: user.email },
              { label: 'Phone', value: formatPhone(user.phone) },
              { label: 'Signed in', value: info ? `${formatDateTime(info.session.startedAt)} · ${info.session.method === 'demo' ? 'Demo persona' : 'Password (demo)'}` : '—' },
            ]} />
          </div>
          {user.role === 'student' && <ButtonLink to="/student/profile" variant="secondary" className="mt-5 w-full">Edit resident details</ButtonLink>}
        </Card>
        <div className="space-y-5 lg:col-span-2">
          <Card className="p-5">
            <CardHeader title="Contact details" subtitle="Shown to staff and on receipts." />
            <form onSubmit={submit} noValidate className="mt-4 grid gap-4 sm:grid-cols-2">
              <Input label="Display name" value={name} onChange={(e) => setName(e.target.value)} error={save.fieldErrors.name} required />
              <Input label="Mobile number" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} error={save.fieldErrors.phone} hint="10-digit Indian mobile" required />
              <Input label="Email" value={user.email} disabled hint="Email changes go through your hostel admin." className="sm:col-span-2" />
              <div className="flex justify-end gap-2 sm:col-span-2">
                <Button variant="ghost" onClick={() => { setName(user.name); setPhone(user.phone); save.clearErrors(); }}>Discard</Button>
                <Button type="submit" loading={save.pending}>Save changes</Button>
              </div>
            </form>
          </Card>
          <Card className="p-5">
            <CardHeader title="Preferences" subtitle="Saved for this demo persona." />
            <div className="mt-2 divide-y divide-line/70">
              <Switch label="Email digest" description="A daily summary of activity at 8 am." checked={user.preferences.emailDigest} onChange={(v) => void pref.run({ preferences: { emailDigest: v } })} />
              <Switch label="SMS alerts" description="Urgent alerts by SMS (not sent in demo mode)." checked={user.preferences.smsAlerts} onChange={(v) => void pref.run({ preferences: { smsAlerts: v } })} />
              <Switch label="Compact tables" description="Show more rows per page in lists." checked={user.preferences.compactTables} onChange={(v) => void pref.run({ preferences: { compactTables: v } })} />
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
