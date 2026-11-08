import { useState } from 'react';
import { Download } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { services } from '@/services';
import type { PropertyWithStats } from '@/services/interfaces';
import { useQuery } from '@/hooks/useQuery';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader, ProgressBar } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FilterBar, FilterSelect } from '@/components/ui/FilterBar';
import { SegmentedControl } from '@/components/ui/Tabs';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { CHART, ChartFrame, Legend } from '@/components/ui/Chart';
import { PageSkeleton } from '@/components/ui/States';
import { exportCSV } from '@/lib/export';
import { formatINR, formatINRCompact } from '@/lib/format';

const tip = { borderRadius: 12, border: `1px solid ${CHART.grid}`, fontSize: 12 };

export function AnalyticsPage() {
  const [months, setMonths] = useState<'3' | '6' | '7'>('6');
  const [property, setProperty] = useState('');
  const trend = useQuery(() => services.analytics.trends({ months: Number(months), propertyId: property || undefined }), [months, property]);
  const comp = useQuery(() => services.analytics.propertyComparison(), []);
  const t = trend.data ?? [];
  const totals = t.reduce((a, x) => ({ e: a.e + x.expected, c: a.c + x.collected, ar: a.ar + x.arrears, cm: a.cm + x.complaints }), { e: 0, c: 0, ar: 0, cm: 0 });
  const avgOcc = t.length ? Math.round(t.reduce((a, x) => a + x.occupancyPct, 0) / t.length) : 0;

  const cols: Column<PropertyWithStats>[] = [
    { key: 'name', header: 'Property', cell: (p) => <span className="font-medium">{p.name}</span>, sortValue: (p) => p.name },
    { key: 'occ', header: 'Occupancy', cell: (p) => <div className="flex min-w-[110px] items-center gap-2"><ProgressBar value={p.stats.occupancyPct} label="Occupancy" /><span className="text-xs tabular-nums">{p.stats.occupancyPct}%</span></div>, sortValue: (p) => p.stats.occupancyPct },
    { key: 'exp', header: 'Expected', align: 'right', cell: (p) => formatINR(p.stats.expectedRent), sortValue: (p) => p.stats.expectedRent },
    { key: 'col', header: 'Collected', align: 'right', cell: (p) => formatINR(p.stats.collectedRent), sortValue: (p) => p.stats.collectedRent },
    { key: 'rate', header: 'Rate', align: 'right', cell: (p) => (p.stats.expectedRent ? `${Math.round((p.stats.collectedRent / p.stats.expectedRent) * 100)}%` : '—'), sortValue: (p) => (p.stats.expectedRent ? p.stats.collectedRent / p.stats.expectedRent : 0) },
    { key: 'arr', header: 'Arrears', align: 'right', cell: (p) => <span className="text-brick">{formatINR(p.stats.expectedRent - p.stats.collectedRent)}</span>, sortValue: (p) => p.stats.expectedRent - p.stats.collectedRent },
    { key: 'cmp', header: 'Open issues', align: 'right', cell: (p) => p.stats.openComplaints ?? '—', sortValue: (p) => p.stats.openComplaints ?? -1, hideBelow: 'md' },
  ];

  const doExport = () => exportCSV(`analytics-${months}m${property ? `-${property}` : ''}`, t, [
    { header: 'Month', value: (x) => x.period }, { header: 'Avg occupancy %', value: (x) => x.occupancyPct }, { header: 'Expected', value: (x) => x.expected },
    { header: 'Collected', value: (x) => x.collected }, { header: 'Arrears', value: (x) => x.arrears }, { header: 'Complaints', value: (x) => x.complaints },
  ]);

  return (
    <>
      <PageHeader title="Analytics" subtitle="Trends in occupancy, collections and arrears. Months before August come from archived monthly snapshots."
        actions={<Button variant="secondary" icon={<Download className="size-4" />} onClick={doExport} disabled={!t.length}>Export CSV</Button>} />
      <FilterBar className="mb-5">
        <SegmentedControl label="Date range" value={months} onChange={setMonths} options={[{ value: '3', label: '3 months' }, { value: '6', label: '6 months' }, { value: '7', label: 'Since April' }]} />
        <FilterSelect label="Properties" value={property} onChange={setProperty} options={(comp.data ?? []).map((p) => ({ value: p.id, label: p.name }))} />
      </FilterBar>
      {!trend.data ? <PageSkeleton /> : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[['Average occupancy', `${avgOcc}%`], ['Rent collected', formatINRCompact(totals.c)], ['Collection rate', totals.e ? `${Math.round((totals.c / totals.e) * 100)}%` : '—'], ['Arrears in period', formatINRCompact(totals.ar)]].map(([l, v]) => (
              <Card key={l} className="p-5"><p className="text-[13px] text-bark">{l}</p><p className="mt-1 font-display text-[28px] font-semibold tabular-nums">{v}</p></Card>
            ))}
          </div>
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <Card className="p-5">
              <CardHeader title="Occupancy trend" subtitle="Average across selected properties" />
              <ChartFrame summary={`Occupancy by month: ${t.map((x) => `${x.label} ${x.occupancyPct}%`).join(', ')}`}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={t} margin={{ top: 16, right: 12, left: -16, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke={CHART.grid} strokeDasharray="3 3" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: CHART.text, fontSize: 12 }} />
                    <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tickLine={false} axisLine={false} tick={{ fill: CHART.text, fontSize: 11 }} />
                    <Tooltip contentStyle={tip} formatter={(v: number) => [`${v}%`, 'Occupancy']} />
                    <Line type="monotone" dataKey="occupancyPct" stroke={CHART.ink} strokeWidth={2.5} dot={{ r: 4, fill: CHART.ink }} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartFrame>
            </Card>
            <Card className="p-5">
              <CardHeader title="Collection vs expected" subtitle="Monthly rent, ₹" />
              <Legend className="mt-2" items={[{ label: 'Expected', color: CHART.soft }, { label: 'Collected', color: CHART.ink }, { label: 'Arrears', color: CHART.brick }]} />
              <ChartFrame summary={`Collections by month: ${t.map((x) => `${x.label} ${formatINR(x.collected)} of ${formatINR(x.expected)}`).join('; ')}`}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={t} margin={{ top: 16, right: 4, left: 4, bottom: 0 }} barGap={2}>
                    <CartesianGrid vertical={false} stroke={CHART.grid} strokeDasharray="3 3" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: CHART.text, fontSize: 12 }} />
                    <YAxis tickFormatter={(v: number) => formatINRCompact(v)} tickLine={false} axisLine={false} tick={{ fill: CHART.text, fontSize: 11 }} width={64} />
                    <Tooltip contentStyle={tip} formatter={(v: number, n: string) => [formatINR(v), n.charAt(0).toUpperCase() + n.slice(1)]} />
                    <Bar dataKey="expected" fill={CHART.soft} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="collected" fill={CHART.ink} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="arrears" fill={CHART.brick} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartFrame>
            </Card>
          </div>
          <Card className="mt-5 p-5">
            <CardHeader title="Property comparison" subtitle="Current month, live figures" />
            <div className="mt-4"><DataTable caption="Property comparison" columns={cols} rows={comp.data} loading={comp.loading} rowKey={(p) => p.id} initialSort={{ key: 'occ', dir: 'desc' }} /></div>
          </Card>
        </>
      )}
    </>
  );
}
