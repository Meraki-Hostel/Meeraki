import { useEffect, useMemo, useState } from 'react';
import { Download, Mail, Pencil, Phone, UserPlus } from 'lucide-react';
import { services } from '@/services';
import type { StaffInput, StaffView } from '@/services/interfaces';
import type { Shift, StaffRole, StaffStatus } from '@/types/domain';
import { useQuery } from '@/hooks/useQuery';
import { useMutation } from '@/hooks/useMutation';
import { useDebounced } from '@/hooks/misc';
import { useConfirm } from '@/app/providers/ConfirmProvider';
import { useCurrentUser } from '@/app/providers/SessionProvider';
import { useToast } from '@/app/providers/ToastProvider';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, DescriptionList } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Checkbox, Input, Select } from '@/components/ui/Field';
import { Drawer, Modal } from '@/components/ui/Modal';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { FilterBar, FilterSelect, SearchInput } from '@/components/ui/FilterBar';
import { StatusBadge, statusOptions } from '@/components/ui/StatusBadge';
import { Avatar } from '@/components/ui/Avatar';
import { exportCSV } from '@/lib/export';
import { formatDate, formatPhone, sentenceCase } from '@/lib/format';

const ROLES: StaffRole[] = ['manager', 'warden', 'accountant', 'housekeeping', 'security', 'cook', 'maintenance'];
const SHIFTS: Shift[] = ['general', 'morning', 'evening', 'night'];
const SHIFT_HOURS: Record<Shift, string> = { general: '9 am – 6 pm', morning: '6 am – 2 pm', evening: '2 pm – 10 pm', night: '10 pm – 6 am' };
// Staff who can sign in to the app (they get access to their whole property). Only the owner invites them.
const LOGIN_ROLES: StaffRole[] = ['manager', 'warden', 'accountant'];
type CreatedStaff = Awaited<ReturnType<typeof services.staff.create>> & { invite?: { inviteLink: string; emailSent: boolean } };

function StaffForm({ open, onClose, scope, editing }: { open: boolean; onClose: () => void; scope: 'owner' | 'manager'; editing: StaffView | null }) {
  const props = useQuery(() => (scope === 'owner' && open ? services.properties.list() : Promise.resolve([])), [scope, open]);
  const toast = useToast();
  const blank = { name: '', role: (scope === 'owner' ? 'manager' : 'housekeeping') as StaffRole, propertyId: '', phone: '', email: '', shift: 'general' as Shift, sendInvite: scope === 'owner' };
  const [f, setF] = useState(blank);
  useEffect(() => {
    if (!open) return;
    setF(editing ? { name: editing.name, role: editing.role, propertyId: editing.propertyId ?? '', phone: editing.phone, email: editing.email, shift: editing.shift, sendInvite: false } : blank);
  }, [open, editing?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const canInvite = !editing && scope === 'owner' && LOGIN_ROLES.includes(f.role);
  const inviting = canInvite && f.sendInvite;
  const save = useMutation((input: StaffInput) => (editing ? services.staff.update(editing.id, input) : services.staff.create(input)), {
    success: editing ? 'Staff details saved.' : inviting ? `Invitation sent to ${f.email}.` : 'Staff member added.',
    onSuccess: (s) => {
      const invite = (s as CreatedStaff).invite;
      // Without email set up, hand the link to the owner to share another way.
      if (invite && !invite.emailSent) {
        void navigator.clipboard?.writeText(invite.inviteLink).then(
          () => toast.info('Email isn’t set up, so the invitation link was copied. Send it to them (e.g. on WhatsApp).', 'Invitation link copied'),
          () => toast.info(`Send this sign-in link: ${invite.inviteLink}`, 'Invitation link'));
      }
      onClose();
    },
  });
  const roles = scope === 'manager' ? ROLES.filter((r) => r !== 'manager') : ROLES;
  const e = save.fieldErrors;
  return (
    <Modal open={open} onClose={onClose} title={editing ? `Edit ${editing.name}` : scope === 'owner' ? 'Invite or add staff' : 'Add staff'} size="lg"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={save.pending} onClick={() => void save.run({ ...f, sendInvite: inviting, propertyId: scope === 'owner' ? f.propertyId || undefined : undefined })}>{editing ? 'Save changes' : inviting ? 'Send invitation' : 'Add staff'}</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Full name" required value={f.name} onChange={(ev) => setF({ ...f, name: ev.target.value })} error={e.name} />
        <Select label="Role" value={f.role} onChange={(ev) => setF({ ...f, role: ev.target.value as StaffRole })} options={roles.map((r) => ({ value: r, label: sentenceCase(r) }))} error={e.role} disabled={!!editing && editing.role === 'manager' && scope === 'manager'} />
        <Input label="Mobile number" required inputMode="tel" value={f.phone} onChange={(ev) => setF({ ...f, phone: ev.target.value })} error={e.phone} placeholder="98390 11201" />
        <Input label="Email" type="email" required value={f.email} onChange={(ev) => setF({ ...f, email: ev.target.value })} error={e.email} />
        {scope === 'owner' && <Select label="Assigned property" value={f.propertyId} onChange={(ev) => setF({ ...f, propertyId: ev.target.value })} placeholder="All properties (head office)" options={(props.data ?? []).map((p) => ({ value: p.id, label: p.name }))} />}
        <Select label="Shift" value={f.shift} onChange={(ev) => setF({ ...f, shift: ev.target.value as Shift })} options={SHIFTS.map((s) => ({ value: s, label: `${sentenceCase(s)} (${SHIFT_HOURS[s]})` }))} />
        {canInvite && (
          <div className="sm:col-span-2">
            <Checkbox label="Invite them to sign in to the app" description={`Emails ${f.email || 'them'} a link to choose a password. They get access to ${f.propertyId ? 'this property' : 'the property you assign'}.`} checked={f.sendInvite} onChange={(ev) => setF({ ...f, sendInvite: ev.target.checked })} />
            {(e.sendInvite || e.propertyId) && <p className="mt-1 text-xs font-medium text-brick" role="alert">{e.sendInvite ?? e.propertyId}</p>}
          </div>
        )}
      </div>
    </Modal>
  );
}

export function StaffBoard({ scope }: { scope: 'owner' | 'manager' }) {
  const me = useCurrentUser();
  const confirm = useConfirm();
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [property, setProperty] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<StaffView | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const ds = useDebounced(search);
  const list = useQuery(() => services.staff.list({ role: (role || undefined) as StaffRole | undefined, status: (status || undefined) as StaffStatus | undefined, propertyId: property || undefined }), [role, status, property]);
  const props = useQuery(() => (scope === 'owner' ? services.properties.list() : Promise.resolve([])), [scope]);
  const rows = useMemo(() => (list.data ?? []).filter((s) => !ds || `${s.name} ${s.email} ${s.phone}`.toLowerCase().includes(ds.toLowerCase())), [list.data, ds]);
  const detail = (list.data ?? []).find((s) => s.id === detailId) ?? null;
  const setSt = useMutation((id: string, st: StaffStatus) => services.staff.setStatus(id, st), { success: (s) => `${s.name} is now ${sentenceCase(s.status).toLowerCase()}.` });
  const canEdit = (s: StaffView) => scope === 'owner' || (s.role !== 'manager' && s.id !== me.staffId);

  const changeStatus = async (s: StaffView, st: StaffStatus) => {
    if (st === 'inactive' && !(await confirm({ title: `Deactivate ${s.name}?`, message: 'They will no longer appear as an assignee for complaints or maintenance. You can reactivate them later.', confirmLabel: 'Deactivate', tone: 'danger' }))) return;
    void setSt.run(s.id, st);
  };

  const columns: Column<StaffView>[] = [
    { key: 'name', header: 'Name', cell: (s) => <div className="flex items-center gap-3"><Avatar name={s.name} size="sm" /><div><p className="font-medium">{s.name}</p><p className="text-xs text-dust">{s.email}</p></div></div>, sortValue: (s) => s.name },
    { key: 'role', header: 'Role', cell: (s) => sentenceCase(s.role), sortValue: (s) => s.role },
    ...(scope === 'owner' ? [{ key: 'property', header: 'Property', cell: (s: StaffView) => s.propertyName, sortValue: (s: StaffView) => s.propertyName ?? '' }] : []),
    { key: 'shift', header: 'Shift', cell: (s) => <span title={SHIFT_HOURS[s.shift]}>{sentenceCase(s.shift)}</span>, hideBelow: 'md' },
    { key: 'phone', header: 'Phone', cell: (s) => formatPhone(s.phone), hideBelow: 'lg' },
    { key: 'status', header: 'Status', cell: (s) => <StatusBadge kind="staff" value={s.status} />, sortValue: (s) => s.status },
  ];

  return (
    <>
      <PageHeader title="Staff" subtitle={scope === 'owner' ? 'Managers and staff across your properties. Invite, assign and update status.' : 'Your property team — roles, shifts and contact details.'}
        actions={<>
          <Button variant="secondary" icon={<Download className="size-4" />} disabled={!rows.length} onClick={() => exportCSV('staff', rows, [{ header: 'Name', value: (s) => s.name }, { header: 'Role', value: (s) => s.role }, { header: 'Property', value: (s) => s.propertyName }, { header: 'Shift', value: (s) => s.shift }, { header: 'Phone', value: (s) => s.phone }, { header: 'Email', value: (s) => s.email }, { header: 'Status', value: (s) => s.status }])}>Export CSV</Button>
          <Button icon={<UserPlus className="size-4" />} onClick={() => { setEditing(null); setFormOpen(true); }}>{scope === 'owner' ? 'Invite staff' : 'Add staff'}</Button>
        </>} />
      <Card className="p-4 sm:p-5">
        <FilterBar className="mb-4">
          <SearchInput value={search} onChange={setSearch} placeholder="Name, email or phone" label="Search staff" />
          {scope === 'owner' && <FilterSelect label="Properties" value={property} onChange={setProperty} options={(props.data ?? []).map((p) => ({ value: p.id, label: p.name }))} />}
          <FilterSelect label="Roles" value={role} onChange={setRole} options={ROLES.map((r) => ({ value: r, label: sentenceCase(r) }))} />
          <FilterSelect label="Statuses" value={status} onChange={setStatus} options={statusOptions('staff')} />
        </FilterBar>
        <DataTable caption="Staff directory" columns={columns} rows={list.data ? rows : undefined} loading={list.loading} error={list.error} onRetry={list.reload} rowKey={(s) => s.id} onRowClick={(s) => setDetailId(s.id)} rowLabel={(s) => `View ${s.name}`} />
      </Card>

      <Drawer open={!!detail} onClose={() => setDetailId(null)} title={detail?.name ?? ''} description={detail && <span className="flex items-center gap-2">{sentenceCase(detail.role)} <StatusBadge kind="staff" value={detail.status} /></span>} width="max-w-md"
        footer={detail && canEdit(detail) ? <Button variant="secondary" icon={<Pencil className="size-4" />} onClick={() => { setEditing(detail); setFormOpen(true); }}>Edit details</Button> : undefined}>
        {detail && (
          <div className="space-y-6">
            <DescriptionList cols={1} items={[
              { label: 'Property', value: detail.propertyName },
              { label: 'Shift', value: `${sentenceCase(detail.shift)} · ${SHIFT_HOURS[detail.shift]}` },
              { label: 'Joined', value: formatDate(detail.joinedOn) },
              { label: 'Phone', value: <a className="inline-flex items-center gap-1 text-clay-700 hover:underline" href={`tel:+91${detail.phone}`}><Phone className="size-3.5" aria-hidden />{formatPhone(detail.phone)}</a> },
              { label: 'Email', value: <a className="inline-flex items-center gap-1 break-all text-clay-700 hover:underline" href={`mailto:${detail.email}`}><Mail className="size-3.5" aria-hidden />{detail.email}</a> },
            ]} />
            {canEdit(detail) ? (
              <div>
                <h3 className="mb-2 text-base font-semibold">Change status</h3>
                <div className="flex flex-wrap gap-2">
                  {(['active', 'on_leave', 'inactive'] as StaffStatus[]).filter((s) => s !== detail.status).map((s) => (
                    <Button key={s} size="sm" variant={s === 'inactive' ? 'danger' : 'secondary'} onClick={() => void changeStatus(detail, s)} loading={setSt.pending}>
                      {s === 'active' ? 'Mark active' : s === 'on_leave' ? 'Mark on leave' : 'Deactivate'}
                    </Button>
                  ))}
                </div>
              </div>
            ) : <p className="rounded-xl bg-sand/60 px-3 py-2 text-sm text-dust">Manager records are maintained by the owner.</p>}
          </div>
        )}
      </Drawer>
      <StaffForm open={formOpen} onClose={() => setFormOpen(false)} scope={scope} editing={editing} />
    </>
  );
}
