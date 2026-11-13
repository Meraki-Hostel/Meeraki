import { useState, type FormEvent } from 'react';
import { Landmark, Plus } from 'lucide-react';
import { services } from '@/services';
import type { PayoutAccountInput } from '@/services';
import type { ID, PayoutAccount, PayoutBusinessType, PayoutKycStatus } from '@/types/domain';
import { useQuery } from '@/hooks/useQuery';
import { useMutation } from '@/hooks/useMutation';
import { useConfirm } from '@/app/providers/ConfirmProvider';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, type Tone } from '@/components/ui/Badge';
import { Checkbox, Input, Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { EmptyState, QueryBoundary } from '@/components/ui/States';

const STATUS: Record<PayoutKycStatus, { label: string; tone: Tone }> = {
  active: { label: 'Verified', tone: 'moss' },
  submitted: { label: 'Verifying', tone: 'amber' },
  under_review: { label: 'Verifying', tone: 'amber' },
  needs_clarification: { label: 'Needs a correction', tone: 'amber' },
  draft: { label: 'Not finished', tone: 'neutral' },
  rejected: { label: 'Rejected', tone: 'brick' },
  suspended: { label: 'Paused', tone: 'brick' },
};
/** Accounts the owner can fix and send again. */
const FIXABLE: PayoutKycStatus[] = ['draft', 'needs_clarification', 'rejected'];

const BUSINESS_TYPES: { value: PayoutBusinessType; label: string }[] = [
  { value: 'individual', label: 'Individual (I own the hostel myself)' },
  { value: 'proprietorship', label: 'Sole proprietorship' },
  { value: 'partnership', label: 'Partnership firm' },
  { value: 'llp', label: 'LLP' },
  { value: 'private_limited', label: 'Private limited company' },
  { value: 'public_limited', label: 'Public limited company' },
  { value: 'trust', label: 'Trust' },
  { value: 'society', label: 'Society' },
  { value: 'ngo', label: 'NGO' },
];
const PERSONAL = (t: PayoutBusinessType) => t === 'individual' || t === 'proprietorship';

interface FormState extends PayoutAccountInput { confirmAccountNumber: string }
const blank = (): FormState => ({
  label: '', businessType: 'individual', legalName: '', contactName: '', email: '', phone: '', pan: '', gstin: '',
  address: { street: '', city: '', state: '', pincode: '' },
  bank: { holderName: '', accountNumber: '', ifsc: '' }, acceptTerms: false, confirmAccountNumber: '',
});
// The server never returns the account number or PAN, so those are always typed again.
const fromAccount = (a: PayoutAccount): FormState => ({
  ...blank(), label: a.label, businessType: a.businessType, legalName: a.legalName, contactName: a.contactName,
  email: a.email, phone: a.phone, bank: { holderName: a.bankHolderName, accountNumber: '', ifsc: a.ifsc },
});

export function PayoutAccountsPage() {
  const accounts = useQuery(() => services.payouts.list(), []);
  const properties = useQuery(() => services.properties.list(), []);
  const confirm = useConfirm();
  const [editing, setEditing] = useState<{ account: PayoutAccount | null } | null>(null);

  const assign = useMutation((propertyId: ID, accountId: ID | null) => services.payouts.assign(propertyId, accountId), { success: 'Saved.' });
  const remove = useMutation((id: ID) => services.payouts.remove(id), { success: 'Account removed.' });

  const onRemove = async (a: PayoutAccount) => {
    const ok = await confirm({ title: `Remove "${a.label}"?`, message: 'It stops being an option for your hostels. This cannot be undone.', confirmLabel: 'Remove', tone: 'danger' });
    if (ok) await remove.run(a.id);
  };

  return (
    <>
      <PageHeader title="Payout accounts" subtitle="Residents pay rent online by UPI or card. It is paid out to the bank account you choose for each hostel."
        actions={<Button icon={<Plus className="size-4" />} onClick={() => setEditing({ account: null })}>Add account</Button>} />
      <QueryBoundary query={accounts}>
        {(list) => (
          <div className="space-y-5">
            {list.length === 0 ? (
              <Card className="p-5">
                <EmptyState icon={<Landmark className="size-5" />} title="No payout account yet"
                  message="Add a bank account to take rent online. The payment provider verifies it first, which usually takes 1–2 working days. Until then residents pay at the office and the manager records it."
                  action={<Button onClick={() => setEditing({ account: null })}>Add account</Button>} />
              </Card>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {list.map((a) => (
                  <Card key={a.id} className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-medium text-espresso">{a.label}</div>
                        <div className="mt-0.5 text-sm text-bark">{a.legalName}</div>
                      </div>
                      <Badge tone={STATUS[a.kycStatus].tone}>{STATUS[a.kycStatus].label}</Badge>
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                      <dt className="text-dust">Bank account</dt><dd className="tabular-nums text-espresso">•••• {a.bankLast4}</dd>
                      <dt className="text-dust">IFSC</dt><dd className="text-espresso">{a.ifsc}</dd>
                      <dt className="text-dust">Used by</dt>
                      <dd className="text-espresso">{a.propertyIds.length ? a.propertyIds.map((id) => properties.data?.find((p) => p.id === id)?.name ?? 'a hostel').join(', ') : 'No hostel yet'}</dd>
                    </dl>
                    {a.kycNote && <p className="mt-3 rounded-lg bg-amber-wash px-3 py-2 text-sm text-amber">{a.kycNote}</p>}
                    {a.kycStatus === 'under_review' || a.kycStatus === 'submitted'
                      ? <p className="mt-3 text-sm text-bark">Being verified, usually 1–2 working days. You will get a notification when it is ready.</p> : null}
                    <div className="mt-4 flex flex-wrap gap-2">
                      {FIXABLE.includes(a.kycStatus) && <Button size="sm" onClick={() => setEditing({ account: a })}>{a.kycStatus === 'draft' ? 'Finish setup' : 'Fix and re-submit'}</Button>}
                      <Button size="sm" variant="ghost" onClick={() => void onRemove(a)} loading={remove.pending}>Remove</Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            <Card className="p-5">
              <CardHeader title="Which account each hostel uses" subtitle="Use one account for all your hostels, or a different one for each." />
              <QueryBoundary query={properties}>
                {(props) => (
                  <div className="mt-4 divide-y divide-line/70">
                    {props.map((p) => {
                      const current = list.find((a) => a.propertyIds.includes(p.id));
                      return (
                        <div key={p.id} className="grid gap-2 py-3 sm:grid-cols-[1fr_minmax(0,22rem)] sm:items-center">
                          <div><div className="font-medium text-espresso">{p.name}</div><div className="text-sm text-dust">{p.locality}, {p.city}</div></div>
                          <Select hideLabel label={`Account for ${p.name}`} value={current?.id ?? ''} disabled={assign.pending}
                            onChange={(ev) => void assign.run(p.id, ev.target.value || null)}
                            options={[
                              { value: '', label: 'Online rent off (pay at the office)' },
                              ...list.map((a) => ({ value: a.id, label: `${a.label} (${STATUS[a.kycStatus].label.toLowerCase()})` })),
                            ]}
                            hint={current && current.kycStatus !== 'active' ? 'Residents can pay online once this account is verified.' : undefined} />
                        </div>
                      );
                    })}
                  </div>
                )}
              </QueryBoundary>
            </Card>
          </div>
        )}
      </QueryBoundary>
      {/* A submit that failed halfway leaves a draft on the server but fires no data event, so refresh on close. */}
      {editing && <AccountForm account={editing.account} onClose={() => { setEditing(null); accounts.reload(); }} />}
    </>
  );
}

function AccountForm({ account, onClose }: { account: PayoutAccount | null; onClose: () => void }) {
  const [f, setF] = useState<FormState>(() => (account ? fromAccount(account) : blank()));
  const [mismatch, setMismatch] = useState<string>();
  const save = useMutation(
    (input: PayoutAccountInput) => (account ? services.payouts.resubmit(account.id, input) : services.payouts.create(input)),
    { success: 'Sent for verification.', onSuccess: onClose },
  );
  const e = save.fieldErrors;
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((s) => ({ ...s, [k]: v }));
  const personal = PERSONAL(f.businessType);

  const submit = (ev: FormEvent) => {
    ev.preventDefault();
    if (f.bank.accountNumber !== f.confirmAccountNumber) { setMismatch('The account numbers do not match'); return; }
    setMismatch(undefined);
    const { confirmAccountNumber: _drop, ...input } = f;
    void _drop;
    void save.run(input);
  };

  return (
    <Modal open onClose={onClose} size="lg" title={account ? 'Update payout account' : 'Add a payout account'}
      description="Rent is paid out to this bank account. The payment provider verifies it, usually in 1–2 working days. Your full account number and PAN go straight to the provider and are not kept by StayPookie."
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" form="payout-form" loading={save.pending}>Send for verification</Button></>}>
      <form id="payout-form" onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        <Input className="sm:col-span-2" label="Name for this account" required hint='For example "HDFC – Koramangala"' value={f.label} onChange={(ev) => set('label', ev.target.value)} error={e.label} />
        <Select className="sm:col-span-2" label="Who receives the rent?" required value={f.businessType} onChange={(ev) => set('businessType', ev.target.value as PayoutBusinessType)} options={BUSINESS_TYPES} error={e.businessType} />
        <Input label={personal ? 'Your full name (as on PAN)' : 'Registered business name'} required value={f.legalName} onChange={(ev) => set('legalName', ev.target.value)} error={e.legalName} />
        <Input label="Contact person" required value={f.contactName} onChange={(ev) => set('contactName', ev.target.value)} error={e.contactName} />
        <Input label="Email" type="email" required value={f.email} onChange={(ev) => set('email', ev.target.value)} error={e.email} />
        <Input label="Mobile number" required inputMode="tel" value={f.phone} onChange={(ev) => set('phone', ev.target.value)} error={e.phone} />
        <Input label={personal ? 'Your PAN' : 'Business PAN'} required maxLength={10} autoComplete="off" value={f.pan} onChange={(ev) => set('pan', ev.target.value.toUpperCase())} error={e.pan} />
        {f.businessType !== 'individual' && (
          <Input label="GSTIN" required={!personal} maxLength={15} hint={personal ? 'Optional' : undefined} value={f.gstin} onChange={(ev) => set('gstin', ev.target.value.toUpperCase())} error={e.gstin} />
        )}
        <Input className="sm:col-span-2" label="Address" required value={f.address.street} onChange={(ev) => set('address', { ...f.address, street: ev.target.value })} error={e['address.street']} />
        <Input label="City" required value={f.address.city} onChange={(ev) => set('address', { ...f.address, city: ev.target.value })} error={e['address.city']} />
        <Input label="State" required value={f.address.state} onChange={(ev) => set('address', { ...f.address, state: ev.target.value })} error={e['address.state']} />
        <Input label="Pincode" required inputMode="numeric" maxLength={6} value={f.address.pincode} onChange={(ev) => set('address', { ...f.address, pincode: ev.target.value })} error={e['address.pincode']} />
        <div className="hidden sm:block" />
        <Input className="sm:col-span-2" label="Account holder name" required hint="Exactly as it appears on the bank account" value={f.bank.holderName} onChange={(ev) => set('bank', { ...f.bank, holderName: ev.target.value })} error={e['bank.holderName']} />
        <Input label="Bank account number" required inputMode="numeric" autoComplete="off" value={f.bank.accountNumber} onChange={(ev) => set('bank', { ...f.bank, accountNumber: ev.target.value.replace(/\D/g, '') })} error={e['bank.accountNumber']} />
        <Input label="Re-enter account number" required inputMode="numeric" autoComplete="off" value={f.confirmAccountNumber} onChange={(ev) => set('confirmAccountNumber', ev.target.value.replace(/\D/g, ''))} error={mismatch} />
        <Input label="IFSC" required maxLength={11} value={f.bank.ifsc} onChange={(ev) => set('bank', { ...f.bank, ifsc: ev.target.value.toUpperCase() })} error={e['bank.ifsc']} />
        <div className="sm:col-span-2">
          <Checkbox checked={f.acceptTerms} onChange={(ev) => set('acceptTerms', ev.target.checked)}
            label="I agree to the payment provider's terms for receiving rent payments into this account."
            description="Razorpay verifies your identity and bank account before any money is paid out." />
          {e.acceptTerms && <p className="mt-1 text-sm text-brick" role="alert">{e.acceptTerms}</p>}
        </div>
        {save.error && !Object.keys(e).length && <p className="text-sm text-brick sm:col-span-2" role="alert">{save.error}</p>}
      </form>
    </Modal>
  );
}
