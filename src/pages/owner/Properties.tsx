import { useNavigate } from 'react-router-dom'
import { BedDouble, MapPin, Star, UserRound } from 'lucide-react'
import { useStore } from '../../store/AppStore'
import { propertyStats } from '../../store/selectors'
import { compactINR, pct } from '../../lib/utils'
import { Card, PageHeader, ProgressBar } from '../../components/ui'
import { SERIES } from '../../components/charts/Charts'
import { PlanBadge } from './Plans'

export default function OwnerProperties() {
  const { data } = useStore()
  const navigate = useNavigate()
  const all = propertyStats(data, 'all')
  return (
    <div>
      <PageHeader title="Properties" description={`${data.properties.length} properties · ${all.totalBeds.toLocaleString('en-IN')} beds · ${pct(all.occupancy)} occupied`} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.properties.map((p, n) => {
          const s = propertyStats(data, p.id)
          return (
            <Card key={p.id} className="cursor-pointer overflow-hidden transition-all hover:-translate-y-px hover:border-slate-300 hover:shadow-md" onClick={() => navigate(`/owner/properties/${p.id}`)}>
              <div className="h-1.5" style={{ background: SERIES[n] }} />
              <div className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-slate-900">{p.name}</h3>
                    <p className="mt-0.5 flex items-center gap-1 text-[13px] text-slate-500"><MapPin size={13} />{p.area}, {p.city}</p>
                  </div>
                  <PlanBadge plan={p.plan} />
                </div>
                <div className="mt-5 flex items-end justify-between">
                  <div>
                    <div className="text-3xl font-semibold tracking-tight text-slate-900 tabular">{pct(s.occupancy)}</div>
                    <div className="text-xs text-slate-500">occupancy</div>
                  </div>
                  <div className="text-right text-[13px] text-slate-600"><BedDouble size={14} className="mr-1 inline text-slate-400" />{s.occupied}/{s.totalBeds} beds</div>
                </div>
                <ProgressBar value={s.occupancy} tone={s.occupancy < 0.84 ? 'amber' : 'brand'} className="mt-2" />
                <dl className="mt-5 grid grid-cols-3 gap-2 border-t border-slate-100 pt-4 text-center">
                  <div><dt className="text-[11px] text-slate-500">Revenue</dt><dd className="text-sm font-semibold text-slate-900 tabular">{compactINR(s.collectedThisMonth)}</dd></div>
                  <div><dt className="text-[11px] text-slate-500">Pending</dt><dd className="text-sm font-semibold text-rose-600 tabular">{compactINR(s.outstanding)}</dd></div>
                  <div><dt className="text-[11px] text-slate-500">Rating</dt><dd className="text-sm font-semibold text-slate-900 tabular"><Star size={12} className="mr-0.5 inline fill-amber-400 text-amber-400" />{s.satisfaction.toFixed(1)}</dd></div>
                </dl>
                <div className="mt-4 flex items-center gap-1.5 text-xs text-slate-500"><UserRound size={13} />Managed by {p.managerName} · {s.openComplaints} open complaints</div>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
