import { useState } from 'react';
import { Check, Minus, Sparkles } from 'lucide-react';
import { services } from '@/services';
import type { SubscriptionPlan } from '@/types/domain';
import { useQuery } from '@/hooks/useQuery';
import { useMutation } from '@/hooks/useMutation';
import { useConfirm } from '@/app/providers/ConfirmProvider';
import { useToast } from '@/app/providers/ToastProvider';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader, ProgressBar } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input, Textarea } from '@/components/ui/Field';
import { PageSkeleton } from '@/components/ui/States';
import { formatINR } from '@/lib/format';
import { cn } from '@/lib/cn';

const MATRIX: Array<[string, Record<string, boolean | string>]> = [
  ['Properties', { starter: '2', growth: '6', portfolio: '25' }],
  ['Beds', { starter: '120', growth: '400', portfolio: '2,500' }],
  ['Rooms, beds & student records', { starter: true, growth: true, portfolio: true }],
  ['Rent ledger & receipts', { starter: true, growth: true, portfolio: true }],
  ['Leave & visitor management', { starter: false, growth: true, portfolio: true }],
  ['Maintenance & inventory', { starter: false, growth: true, portfolio: true }],
  ['Owner analytics & exports', { starter: false, growth: true, portfolio: true }],
  ['Online rent collection', { starter: false, growth: false, portfolio: true }],
  ['Custom roles & approvals', { starter: false, growth: false, portfolio: true }],
];

export function PlansPage() {
  const q = useQuery(() => services.settings.planUsage(), []);
  const confirm = useConfirm();
  const toast = useToast();
  const [contact, setContact] = useState(false);
  const [msg, setMsg] = useState('');
  const change = useMutation(services.settings.changePlan, { success: (u) => `You’re now on ${u.plan.name}. Demo only — no billing happened.` });
  if (!q.data) return <PageSkeleton />;
  const u = q.data;
  const choose = async (p: SubscriptionPlan) => {
    const up = p.pricePerMonth > u.plan.pricePerMonth;
    if (await confirm({ title: `${up ? 'Upgrade' : 'Switch'} to ${p.name}?`, message: <>New price {formatINR(p.pricePerMonth)}/month. This is a demo: the plan changes immediately and nothing is charged.</>, confirmLabel: up ? 'Upgrade plan' : 'Switch plan', tone: up ? 'primary' : 'danger' })) void change.run(p.id);
  };
  const usage: Array<[string, number, number]> = [['Properties', u.properties, u.plan.propertyLimit], ['Beds', u.beds, u.plan.bedLimit], ['Active staff', u.staff, u.plan.staffLimit]];

  return (
    <>
      <PageHeader title="Plans & usage" subtitle="Your subscription, how much of it you use, and what other plans include." />
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-1">
          <p className="text-[13px] text-dust">Current plan</p>
          <div className="mt-1 flex items-center gap-2"><h2 className="text-3xl font-semibold">{u.plan.name}</h2><Badge tone="clay">Active</Badge></div>
          <p className="mt-1 text-sm text-bark"><span className="font-display text-xl font-semibold">{formatINR(u.plan.pricePerMonth)}</span> per month, billed monthly</p>
          <p className="mt-1 text-xs text-dust">Next invoice: 1 Nov 2026 (demo)</p>
          <Button variant="secondary" className="mt-5 w-full" onClick={() => setContact(true)}>Talk to sales</Button>
        </Card>
        <Card className="p-5 lg:col-span-2">
          <CardHeader title="Usage" subtitle="Against your plan limits" />
          <ul className="mt-4 space-y-4">
            {usage.map(([l, n, max]) => {
              const pct = Math.round((n / max) * 100);
              return (
                <li key={l}>
                  <div className="mb-1.5 flex justify-between text-sm"><span>{l}</span><span className="tabular-nums text-bark">{n} of {max}{pct >= 80 && <span className="ml-2 text-amber">· {pct >= 100 ? 'limit reached' : 'nearing limit'}</span>}</span></div>
                  <ProgressBar value={pct} label={`${l} usage`} tone={pct >= 100 ? 'brick' : pct >= 80 ? 'amber' : 'slate'} />
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      <h2 className="mb-3 mt-8 text-xl font-semibold">Compare plans</h2>
      <div className="grid gap-4 md:grid-cols-3">
        {u.plans.map((p) => {
          const current = p.id === u.plan.id;
          const tooSmall = u.properties > p.propertyLimit || u.beds > p.bedLimit;
          return (
            <Card key={p.id} className={cn('flex flex-col p-5', current && 'border-clay-400 ring-2 ring-clay-100')}>
              <div className="flex items-center justify-between"><h3 className="text-xl font-semibold">{p.name}</h3>{p.tier === 'portfolio' && <Sparkles className="size-5 text-clay-600" aria-hidden />}</div>
              <p className="mt-1"><span className="font-display text-2xl font-semibold">{formatINR(p.pricePerMonth)}</span><span className="text-sm text-dust"> /month</span></p>
              <ul className="mt-4 flex-1 space-y-2 text-sm">{p.features.map((f) => <li key={f} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-moss" aria-hidden />{f}</li>)}</ul>
              <Button className="mt-5" variant={current ? 'secondary' : 'primary'} disabled={current || tooSmall} loading={change.pending} onClick={() => void choose(p)}
                title={current ? 'This is your current plan' : tooSmall ? `Your portfolio exceeds ${p.name} limits` : undefined}>
                {current ? 'Current plan' : tooSmall ? 'Portfolio too large' : p.pricePerMonth > u.plan.pricePerMonth ? `Upgrade to ${p.name}` : `Switch to ${p.name}`}
              </Button>
            </Card>
          );
        })}
      </div>

      <Card className="mt-5 p-2 sm:p-4">
        <div className="scroll-thin relative overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <caption className="sr-only">Feature comparison</caption>
            <thead><tr><th scope="col" className="px-3 py-2 text-left text-xs font-semibold text-bark">Feature</th>{u.plans.map((p) => <th key={p.id} scope="col" className="px-3 py-2 text-center text-xs font-semibold text-bark">{p.name}</th>)}</tr></thead>
            <tbody>
              {MATRIX.map(([label, vals]) => (
                <tr key={label} className="border-t border-line/70">
                  <th scope="row" className="px-3 py-2.5 text-left font-normal">{label}</th>
                  {u.plans.map((p) => { const v = vals[p.tier]; return <td key={p.id} className="px-3 py-2.5 text-center">{typeof v === 'string' ? v : v ? <><Check className="mx-auto size-4 text-moss" aria-hidden /><span className="sr-only">Included</span></> : <><Minus className="mx-auto size-4 text-mute" aria-hidden /><span className="sr-only">Not included</span></>}</td>; })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={contact} onClose={() => setContact(false)} title="Talk to sales" description="Tell us about your portfolio. Demo mode doesn’t send this anywhere."
        footer={<><Button variant="secondary" onClick={() => setContact(false)}>Cancel</Button><Button onClick={() => { setContact(false); setMsg(''); toast.success('Thanks — a StayPookie specialist would call you within one working day.', 'Request noted (demo)'); }}>Request a call</Button></>}>
        <div className="space-y-4">
          <Input label="Best time to call" placeholder="e.g. Weekdays after 4 pm" />
          <Textarea label="What do you need?" value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="e.g. Adding 3 properties in Kanpur next quarter" />
        </div>
      </Modal>
    </>
  );
}
