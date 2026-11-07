import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, BarChart3, BedDouble, Building2, CalendarPlus, Download, IndianRupee, MapPin, Plus, TrendingDown, TrendingUp, UserPlus, Users, Wallet } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { services } from '@/services';
import { useQuery } from '@/hooks/useQuery';
import { useCurrentUser } from '@/app/providers/SessionProvider';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader, KpiCard, ProgressBar, QuickAction } from '@/components/ui/Card';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Select } from '@/components/ui/Field';
import { SegmentedControl } from '@/components/ui/Tabs';
import { CHART, ChartFrame, Legend } from '@/components/ui/Chart';
import { PageSkeleton, ErrorState, Skeleton } from '@/components/ui/States';
import { ActivityFeed } from '@/components/domain/ActivityFeed';
import { PropertyImage } from '@/components/brand/PropertyImage';
import { exportCSV } from '@/lib/export';
import { currentPeriod, greeting, recentPeriods } from '@/lib/clock';
import { isAvailable } from '@/lib/features';
import { formatINR, formatNumber, formatPeriod } from '@/lib/format';
import { Link } from 'react-router-dom';


function OccTick({ x = 0, y = 0, payload, data }: { x?: number; y?: number; payload?: { value: string; index: number }; data: Array<{ name: string; pct: number }> }) {
  const d = data.find((r) => r.name === payload?.value);
  return (
    <g transform={`translate(${x},${y})`}>
      <text dy={12} textAnchor="middle" fill={CHART.text} fontSize={12}>{payload?.value}</text>
      <text dy={27} textAnchor="middle" fill="#3b2622" fontSize={11} fontWeight={600}>{d?.pct}%</text>
    </g>
  );
}

export function OwnerDashboard() {
  const user = useCurrentUser();
  const navigate = useNavigate();
  const PERIODS = recentPeriods(3);
  const [period, setPeriod] = useState(currentPeriod());
  const [occMode, setOccMode] = useState<'pct' | 'beds'>('pct');
  const overview = useQuery(() => services.analytics.ownerOverview(period), [period]);
  const props = useQuery(() => services.analytics.propertyComparison(), []);
  const activity = useQuery(() => services.activity.list({ limit: 6 }), []);

  if (overview.error) return <ErrorState message={overview.error} onRetry={overview.reload} />;
  if (!overview.data || !props.data) return <PageSkeleton />;
  const o = overview.data;
  const first = user.name.replace(/^Mr\.\s*/, '').split(' ')[0];
  const salutation = user.name.startsWith('Mr.') ? `Mr. ${user.name.split(' ').slice(-1)[0]}` : first;
  const occData = props.data.filter((p) => p.stats.beds > 0).map((p) => ({
    name: p.name.replace(/ (Residence|Hostel|PG|Girls Hostel)$/, '').replace(' Girls', ''), id: p.id,
    occupied: occMode === 'pct' ? p.stats.occupancyPct : p.stats.occupiedBeds,
    vacant: occMode === 'pct' ? 100 - p.stats.occupancyPct : p.stats.beds - p.stats.occupiedBeds,
    pct: p.stats.occupancyPct,
  }));
  const c = o.collection;
  const donut = [{ name: 'Collected', value: c.collected, color: CHART.ink }, { name: 'Pending', value: c.pending, color: CHART.soft }, { name: 'Overdue', value: c.overdue, color: CHART.brick }];

  const doExport = () => exportCSV(`portfolio-summary-${period}`, props.data!, [
    { header: 'Property', value: (p) => p.name }, { header: 'Locality', value: (p) => p.locality }, { header: 'Status', value: (p) => p.status },
    { header: 'Rooms', value: (p) => p.stats.rooms }, { header: 'Beds', value: (p) => p.stats.beds }, { header: 'Occupied beds', value: (p) => p.stats.occupiedBeds },
    { header: 'Occupancy %', value: (p) => p.stats.occupancyPct }, { header: 'Expected rent (current month)', value: (p) => p.stats.expectedRent }, { header: 'Collected', value: (p) => p.stats.collectedRent },
    // Complaint counts only once that module has a backend; never a made-up zero.
    ...(isAvailable('complaints') ? [{ header: 'Open complaints', value: (p: (typeof props.data)[number]) => p.stats.openComplaints ?? '' }] : []),
    { header: 'Manager', value: (p) => p.stats.managerName },
  ]);

  return (
    <>
      <PageHeader docTitle="Owner dashboard" title={`${greeting()}, ${salutation}`} subtitle="Here’s the overall status of your hostels."
        actions={<>
          <Select label="Reporting month" hideLabel value={period} onChange={(e) => setPeriod(e.target.value)} options={PERIODS.map((p) => ({ value: p, label: formatPeriod(p) }))} className="w-44" />
          <Button variant="secondary" icon={<Download className="size-4" />} onClick={doExport}>Export data</Button>
        </>} />

      <section aria-label="Key figures" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total properties" value={o.properties} hint={`${o.activeProperties} active`} icon={<Building2 className="size-5" />} to="/owner/properties" />
        <KpiCard label="Rooms · beds" value={`${o.rooms} · ${o.beds}`} hint={`${o.beds - o.occupiedBeds} beds free right now`} icon={<BedDouble className="size-5" />} to="/owner/properties" />
        <KpiCard label="Total students" value={formatNumber(o.students)} hint="Occupancy across all beds" icon={<Users className="size-5" />} progress={o.occupancyPct} />
        <KpiCard label="Monthly rent expected" value={formatINR(o.expectedRent)} hint={formatPeriod(period)} icon={<IndianRupee className="size-5" />} tone="amber" to="/owner/finance" />
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-5">
        <Card className="p-5 lg:col-span-3">
          <CardHeader title="Occupancy overview" subtitle="Bed occupancy by property, live" action={<SegmentedControl size="sm" label="Show occupancy as" value={occMode} onChange={setOccMode} options={[{ value: 'pct', label: '%' }, { value: 'beds', label: 'Beds' }]} />} />
          <Legend className="mt-3" items={[{ label: 'Occupied', color: CHART.ink }, { label: 'Vacant', color: CHART.soft }]} />
          <ChartFrame summary={`Occupancy: ${occData.map((d) => `${d.name} ${d.pct}%`).join(', ')}`} height={270}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={occData} margin={{ top: 16, right: 4, left: -18, bottom: 0 }} barSize={44}>
                <CartesianGrid vertical={false} stroke={CHART.grid} strokeDasharray="3 3" />
                <XAxis dataKey="name" tickLine={false} axisLine={false} interval={0} height={40} tick={<OccTick data={occData} />} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: CHART.text, fontSize: 11 }} tickFormatter={(v) => (occMode === 'pct' ? `${v}%` : String(v))} domain={occMode === 'pct' ? [0, 100] : [0, 'auto']} />
                <Tooltip cursor={{ fill: 'rgba(231,236,245,.5)' }} contentStyle={{ borderRadius: 12, border: `1px solid ${CHART.grid}`, fontSize: 12 }} formatter={(v: number, n: string) => [occMode === 'pct' ? `${v}%` : `${v} beds`, n === 'occupied' ? 'Occupied' : 'Vacant']} />
                <Bar dataKey="occupied" stackId="a" fill={CHART.ink} radius={[0, 0, 4, 4]} onClick={(d) => navigate(`/owner/properties/${(d as unknown as { id: string }).id}`)} className="cursor-pointer" />
                <Bar dataKey="vacant" stackId="a" fill={CHART.soft} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartFrame>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <CardHeader title={`Rent collection`} subtitle={formatPeriod(period)} />
          <div className="mt-2 flex flex-col items-center gap-5 sm:flex-row lg:flex-col xl:flex-row">
            <div className="relative size-44 shrink-0">
              <ChartFrame summary={`${c.collectionPct}% collected: ${formatINR(c.collected)} of ${formatINR(c.expected)}. Pending ${formatINR(c.pending)}, overdue ${formatINR(c.overdue)}.`} height={176}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie isAnimationActive={false} data={donut} dataKey="value" innerRadius={58} outerRadius={84} startAngle={90} endAngle={-270} stroke="none" paddingAngle={c.pending || c.overdue ? 1.5 : 0}>
                      {donut.map((d) => <Cell key={d.name} fill={d.color} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </ChartFrame>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center" aria-hidden>
                <span className="font-display text-3xl font-semibold">{c.collectionPct}%</span>
                <span className="text-xs text-dust">collected</span>
              </div>
            </div>
            <dl className="w-full space-y-2.5 text-sm">
              {donut.map((d) => (
                <div key={d.name} className="flex items-center justify-between gap-3">
                  <dt className="flex items-center gap-2 text-bark"><span className="size-2.5 rounded-full" style={{ background: d.color }} aria-hidden />{d.name === 'Overdue' ? 'Overdue (past due date)' : d.name}</dt>
                  <dd className={`font-semibold tabular-nums ${d.name === 'Overdue' ? 'text-brick' : ''}`}>{formatINR(d.value)}</dd>
                </div>
              ))}
              <div className="flex items-center justify-between border-t border-line pt-2.5"><dt className="text-bark">Total expected</dt><dd className="font-display text-lg font-semibold tabular-nums">{formatINR(c.expected)}</dd></div>
            </dl>
          </div>
          <Link to="/owner/finance" className="mt-4 flex items-center gap-3 rounded-2xl bg-slate-wash/70 px-4 py-3 text-sm hover:bg-slate-wash">
            {c.overdueCount ? <TrendingDown className="size-5 text-brick" aria-hidden /> : <TrendingUp className="size-5 text-slate-ink" aria-hidden />}
            <span className="flex-1">
              <span className="block font-medium text-espresso">{c.overdueCount ? `${formatINR(c.overdue)} overdue across ${c.overdueCount} residents` : 'No overdue rent this month'}</span>
              <span className="block text-xs text-dust">{c.pendingCount} not yet due · last month closed at {o.lastMonthCollectionPct}% collected</span>
            </span>
            <ArrowRight className="size-4 text-slate-ink" aria-hidden />
          </Link>
        </Card>
      </div>

      <Card className="mt-5 p-5">
        <CardHeader title="Properties overview" subtitle="All your hostel properties at a glance" action={<ButtonLink to="/owner/properties" variant="ghost" size="sm">View all <ArrowRight className="size-4" aria-hidden /></ButtonLink>} />
        <ul className="scroll-thin mt-4 flex snap-x gap-3 overflow-x-auto pb-1">
          {props.data.map((p) => (
            <li key={p.id} className="w-[250px] shrink-0 snap-start">
              <Link to={`/owner/properties/${p.id}`} className="flex gap-3 rounded-2xl border border-line bg-white/60 p-2.5 transition-colors hover:border-line-strong">
                <PropertyImage variant={p.imageVariant} name={p.name} className="h-[76px] w-[76px] shrink-0 rounded-xl" />
                <div className="min-w-0 flex-1 py-0.5">
                  <p className="truncate text-sm font-semibold underline-offset-2 hover:underline">{p.name}</p>
                  <p className="flex items-center gap-1 truncate text-xs text-dust"><MapPin className="size-3" aria-hidden />{p.locality}</p>
                  <p className="mt-2 text-xs text-bark"><strong className="tabular-nums">{p.stats.occupiedBeds}</strong>/{p.stats.beds} beds</p>
                  <div className="mt-1 flex items-center gap-2"><ProgressBar value={p.stats.occupancyPct} label={`${p.name} occupancy`} /><span className="text-[11px] tabular-nums text-dust">{p.stats.occupancyPct}%</span></div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </Card>

      <div className="mt-5 grid gap-5 lg:grid-cols-5">
        <Card className="p-5 lg:col-span-2">
          <CardHeader title="Quick actions" subtitle="Common tasks across your portfolio" />
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
            <QuickAction icon={<Plus className="size-5" />} label="Add property" to="/owner/properties/new" />
            {isAvailable('staff') && <QuickAction icon={<UserPlus className="size-5" />} label="Invite staff" to="/owner/staff" />}
            <QuickAction icon={<Wallet className="size-5" />} label="Rent ledger" to="/owner/finance" />
            {isAvailable('analytics') && <QuickAction icon={<BarChart3 className="size-5" />} label="Generate report" to="/owner/analytics" />}
            {isAvailable('events') && <QuickAction icon={<CalendarPlus className="size-5" />} label="Plan an event" to="/owner/events" />}
            <QuickAction icon={<Building2 className="size-5" />} label="All properties" to="/owner/properties" />
            <QuickAction icon={<Download className="size-5" />} label="Export summary" onClick={doExport} />
          </div>
        </Card>
        <Card className="p-5 lg:col-span-3">
          <CardHeader title="Recent activity" subtitle="Latest actions across properties" />
          <div className="mt-4">{activity.data ? <ActivityFeed items={activity.data} showProperty compact /> : <Skeleton className="h-48" />}</div>
        </Card>
      </div>
    </>
  );
}
