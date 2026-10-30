import { useState } from 'react'
import { Check, Gem, Minus } from 'lucide-react'
import { useStore } from '../../store/AppStore'
import { propertyStats } from '../../store/selectors'
import type { PlanTier } from '../../lib/types'
import { cn, formatINR } from '../../lib/utils'
import { Badge, Button, Card, CardHeader, Modal, PageHeader, useToast } from '../../components/ui'

const TIERS: { tier: PlanTier; price: number; blurb: string }[] = [
  { tier: 'Starter', price: 15, blurb: 'Rooms, students, rent & complaints' },
  { tier: 'Professional', price: 25, blurb: 'Adds inventory, staff, maintenance & analytics' },
  { tier: 'Enterprise', price: 35, blurb: 'Adds multi-property roll-ups, API & priority support' },
]
const FEATURES: [string, PlanTier][] = [
  ['Student app (rent, complaints, leave, visitors)', 'Starter'],
  ['Rooms & bed allocation', 'Starter'],
  ['Payments & receipts', 'Starter'],
  ['Announcements & events', 'Starter'],
  ['Staff attendance', 'Professional'],
  ['Inventory & maintenance', 'Professional'],
  ['Feedback analytics', 'Professional'],
  ['Portfolio analytics & comparison', 'Enterprise'],
  ['Custom roles & API access', 'Enterprise'],
]
const RANK: Record<PlanTier, number> = { Starter: 0, Professional: 1, Enterprise: 2 }

export function PlanBadge({ plan }: { plan: PlanTier }) {
  return <Badge tone={plan === 'Starter' ? 'slate' : plan === 'Professional' ? 'brand' : 'violet'}>{plan}</Badge>
}

export default function OwnerPlans() {
  const { data } = useStore()
  const [changing, setChanging] = useState<string | null>(null)
  const monthly = data.properties.reduce((a, p) => a + propertyStats(data, p.id).totalBeds * TIERS.find((t) => t.tier === p.plan)!.price, 0)

  return (
    <div>
      <PageHeader title="Plans" description="Subscription per property · billed per bed per month" />
      <p className="-mt-3 mb-5 rounded-lg bg-amber-50 px-3 py-2 text-[13px] text-amber-800">Prototype: plans and prices are illustrative. No billing happens.</p>
      <div className="mb-5 grid gap-4 md:grid-cols-3">
        {TIERS.map((t) => (
          <Card key={t.tier} className={cn('p-5', t.tier === 'Professional' && 'border-brand-300 ring-3 ring-brand-500/10')}>
            <div className="flex items-center justify-between"><h3 className="font-semibold text-slate-900">{t.tier}</h3>{t.tier === 'Professional' && <Badge tone="brand">Most popular</Badge>}</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">₹{t.price}<span className="text-sm font-normal text-slate-500"> / bed / month</span></div>
            <p className="mt-1 text-[13px] text-slate-500">{t.blurb}</p>
            <div className="mt-3 text-xs text-slate-500">{data.properties.filter((p) => p.plan === t.tier).length} of your properties</div>
          </Card>
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader title="Property plans" subtitle={`Estimated ${formatINR(monthly)} / month`} icon={<Gem size={16} className="text-slate-400" />} />
          <ul className="divide-y divide-slate-100 border-t border-slate-100">
            {data.properties.map((p) => {
              const beds = propertyStats(data, p.id).totalBeds
              const price = TIERS.find((t) => t.tier === p.plan)!.price
              return (
                <li key={p.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-slate-900">{p.name}</div>
                    <div className="text-xs text-slate-500">{beds} beds · {formatINR(beds * price)} / month</div>
                  </div>
                  <PlanBadge plan={p.plan} />
                  <Button size="sm" onClick={() => setChanging(p.id)}>Change</Button>
                </li>
              )
            })}
          </ul>
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader title="What’s included" />
          <div className="overflow-x-auto px-5 pb-4">
            <table className="w-full text-[13px]">
              <thead><tr className="text-left text-xs text-slate-500"><th className="py-2 font-medium">Feature</th>{TIERS.map((t) => <th key={t.tier} className="px-1 py-2 text-center font-medium">{t.tier.slice(0, 3)}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100">
                {FEATURES.map(([f, min]) => (
                  <tr key={f}><td className="py-2 pr-2 text-slate-700">{f}</td>{TIERS.map((t) => <td key={t.tier} className="text-center">{RANK[t.tier] >= RANK[min] ? <Check size={15} className="inline text-emerald-600" /> : <Minus size={15} className="inline text-slate-300" />}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
      {changing && <ChangePlan propertyId={changing} onClose={() => setChanging(null)} />}
    </div>
  )
}

function ChangePlan({ propertyId, onClose }: { propertyId: string; onClose: () => void }) {
  const { data, setPlan } = useStore()
  const toast = useToast()
  const p = data.properties.find((x) => x.id === propertyId)!
  const [tier, setTier] = useState<PlanTier>(p.plan)
  const beds = propertyStats(data, p.id).totalBeds
  return (
    <Modal open onClose={onClose} size="sm" title={`Change plan · ${p.name}`} footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" disabled={tier === p.plan} onClick={() => { setPlan(p.id, tier); toast.success(`${p.name} moved to ${tier}`, { description: 'No charge in prototype' }); onClose() }}>Confirm</Button></>}>
      <div className="space-y-2">
        {TIERS.map((t) => (
          <button key={t.tier} onClick={() => setTier(t.tier)} className={cn('flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left', tier === t.tier ? 'border-brand-500 bg-brand-50/50 ring-3 ring-brand-500/15' : 'border-slate-200 hover:border-slate-300')}>
            <span><span className="block text-sm font-semibold text-slate-900">{t.tier}{t.tier === p.plan && <span className="ml-2 text-xs font-normal text-slate-500">current</span>}</span><span className="text-xs text-slate-500">{t.blurb}</span></span>
            <span className="text-sm font-semibold text-slate-900 tabular">{formatINR(beds * t.price)}</span>
          </button>
        ))}
      </div>
    </Modal>
  )
}
