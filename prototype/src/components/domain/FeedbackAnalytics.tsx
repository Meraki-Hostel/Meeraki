import { useState } from 'react'
import { MessageCircle, Star } from 'lucide-react'
import { useStore } from '../../store/AppStore'
import { avgRating, idx } from '../../store/selectors'
import { FEEDBACK_CATEGORIES } from '../../lib/types'
import { FEEDBACK_LABELS } from '../../lib/meta'
import { cn, timeAgo } from '../../lib/utils'
import { Card, CardHeader, EmptyState, KpiCard, Segmented } from '../ui'
import { Bars, SERIES } from '../charts/Charts'

export function FeedbackAnalytics({ propertyId, compact }: { propertyId: string | 'all'; compact?: boolean }) {
  const { data } = useStore()
  const [month, setMonth] = useState<'2026-09' | '2026-08'>('2026-09')
  const prevMonth = month === '2026-09' ? '2026-08' : '2026-07'
  const inScope = data.feedback.filter((f) => propertyId === 'all' || f.propertyId === propertyId)
  const cur = inScope.filter((f) => f.month === month)
  const prev = inScope.filter((f) => f.month === prevMonth)
  const avg = (list: typeof cur, c?: (typeof FEEDBACK_CATEGORIES)[number]) => (list.length ? list.reduce((a, f) => a + (c ? f.ratings[c] : avgRating(f.ratings)), 0) / list.length : 0)
  const overall = avg(cur)
  const overallPrev = avg(prev)
  const residents = data.students.filter((s) => (propertyId === 'all' || s.propertyId === propertyId) && s.status === 'active' && s.bedId).length
  const chartData = FEEDBACK_CATEGORIES.map((c) => ({ category: FEEDBACK_LABELS[c]!, aug: +avg(inScope.filter((f) => f.month === '2026-08'), c).toFixed(2), sep: +avg(inScope.filter((f) => f.month === '2026-09'), c).toFixed(2) }))
  const comments = cur.filter((f) => f.comment).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6)
  const i = idx(data)
  const worst = [...FEEDBACK_CATEGORIES].sort((a, b) => avg(cur, a) - avg(cur, b))[0]!

  if (!inScope.length) return <Card><EmptyState icon={Star} title="No feedback yet" description="Monthly feedback from students will appear here." /></Card>

  return (
    <div className="space-y-5">
      {!compact && (
        <div className="flex justify-end">
          <Segmented items={[{ value: '2026-09', label: 'September' }, { value: '2026-08', label: 'August' }]} value={month} onChange={setMonth} />
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Overall satisfaction" value={<span>{overall.toFixed(1)}<span className="text-base font-medium text-slate-400"> / 5</span></span>} icon={Star} tone="amber" trend={overallPrev ? { value: `${Math.abs(overall - overallPrev).toFixed(2)}`, up: overall >= overallPrev } : undefined} sub={overallPrev ? 'vs last month' : undefined} />
        <KpiCard label="Responses" value={cur.length} sub={`${Math.round((cur.length / Math.max(1, residents)) * 100)}% of residents`} />
        <KpiCard label="Best rated" value={FEEDBACK_LABELS[[...FEEDBACK_CATEGORIES].sort((a, b) => avg(cur, b) - avg(cur, a))[0]!]} sub={`${avg(cur, [...FEEDBACK_CATEGORIES].sort((a, b) => avg(cur, b) - avg(cur, a))[0]!).toFixed(1)} / 5`} tone="green" />
        <KpiCard label="Needs attention" value={FEEDBACK_LABELS[worst]} sub={`${avg(cur, worst).toFixed(1)} / 5`} tone="red" />
      </div>
      <div className={cn('grid gap-5', !compact && 'xl:grid-cols-5')}>
        <Card className={cn(!compact && 'xl:col-span-3')}>
          <CardHeader title="Rating by category" subtitle="Average score out of 5 · August vs September" />
          <div className="px-3 pb-4 sm:px-5">
            <Bars data={chartData} xKey="category" series={[{ key: 'aug', label: 'August', color: SERIES[0]! }, { key: 'sep', label: 'September', color: SERIES[1]! }]} format={(v) => v.toFixed(1)} max={5} height={250} />
          </div>
        </Card>
        {!compact && (
          <Card className="xl:col-span-2">
            <CardHeader title="What students said" subtitle={`${comments.length} recent comments`} icon={<MessageCircle size={16} className="text-slate-400" />} />
            <ul className="divide-y divide-slate-100 border-t border-slate-100">
              {comments.map((f) => (
                <li key={f.id} className="px-5 py-3">
                  <p className="text-[13.5px] text-slate-700">“{f.comment}”</p>
                  <p className="mt-1 text-xs text-slate-400">{i.student.get(f.studentId)?.name.split(' ')[0]} · {avgRating(f.ratings).toFixed(1)}★ · {timeAgo(f.createdAt)}</p>
                </li>
              ))}
              {!comments.length && <li className="px-5 py-8 text-center text-[13px] text-slate-500">No written comments this month.</li>}
            </ul>
          </Card>
        )}
      </div>
    </div>
  )
}
