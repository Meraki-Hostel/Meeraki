import type { ReactNode } from 'react'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from 'recharts'
import { cn } from '../../lib/utils'

/**
 * Validated categorical palette (fixed order — colour follows the entity, never its rank).
 * Slots 1–3 are safe for any chart form; lines/bars use adjacent-pair ordering.
 */
export const SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948']
const GRID = '#e8e7e2'
const AXIS = '#898781'

export interface Series {
  key: string
  label: string
  color: string
}

function ChartTooltip({ active, payload, label, format, labelFormat }: Partial<TooltipContentProps<number, string>> & { format: (v: number) => string; labelFormat?: (l: string) => string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="min-w-36 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-pop">
      <div className="mb-1.5 text-xs font-medium text-slate-500">{labelFormat ? labelFormat(String(label)) : label}</div>
      <div className="space-y-1">
        {payload.map((p) => (
          <div key={String(p.dataKey)} className="flex items-center justify-between gap-4 text-[13px]">
            <span className="flex items-center gap-1.5 text-slate-600">
              <span className="size-2 rounded-full" style={{ background: p.color }} />
              {p.name}
            </span>
            <span className="font-semibold text-slate-900 tabular">{format(Number(p.value))}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function Legend({ series, className }: { series: Series[]; className?: string }) {
  if (series.length < 2) return null
  return (
    <div className={cn('flex flex-wrap items-center gap-x-4 gap-y-1.5', className)}>
      {series.map((s) => (
        <span key={s.key} className="flex items-center gap-1.5 text-xs text-slate-600">
          <span className="h-2 w-2.5 rounded-sm" style={{ background: s.color }} />
          {s.label}
        </span>
      ))}
    </div>
  )
}

export function LineTrend({ data, xKey, series, format, height = 240, yDomain, labelFormat }: {
  data: Record<string, number | string>[]
  xKey: string
  series: Series[]
  format: (v: number) => string
  height?: number
  yDomain?: [number | 'auto' | 'dataMin', number | 'auto' | 'dataMax']
  labelFormat?: (l: string) => string
}) {
  return (
    <div>
      <Legend series={series} className="mb-3" />
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: AXIS }} tickLine={false} axisLine={{ stroke: '#c3c2b7' }} minTickGap={16} tickFormatter={labelFormat} />
            <YAxis tick={{ fontSize: 11, fill: AXIS }} tickLine={false} axisLine={false} width={52} tickFormatter={(v) => format(Number(v))} domain={yDomain} />
            <Tooltip content={(p) => <ChartTooltip {...(p as TooltipContentProps<number, string>)} format={format} labelFormat={labelFormat} />} cursor={{ stroke: '#c3c2b7', strokeDasharray: '3 3' }} />
            {series.map((s) => (
              <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2} dot={false} activeDot={{ r: 4.5, strokeWidth: 2, stroke: '#fff' }} isAnimationActive={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export function Bars({ data, xKey, series, format, height = 240, stacked, horizontal, labelWidth = 110, max }: {
  data: Record<string, number | string>[]
  xKey: string
  series: Series[]
  format: (v: number) => string
  height?: number
  stacked?: boolean
  horizontal?: boolean
  labelWidth?: number
  max?: number
}) {
  const domain: [number, number | 'auto'] = [0, max ?? 'auto']
  const radius: [number, number, number, number] = horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]
  return (
    <div>
      <Legend series={series} className="mb-3" />
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout={horizontal ? 'vertical' : 'horizontal'} margin={{ top: 6, right: 12, left: 0, bottom: 0 }} barGap={2} barCategoryGap={horizontal ? 8 : '24%'}>
            <CartesianGrid stroke={GRID} vertical={!!horizontal} horizontal={!horizontal} />
            {horizontal ? (
              <>
                <XAxis type="number" domain={domain} tick={{ fontSize: 11, fill: AXIS }} tickLine={false} axisLine={false} tickFormatter={(v) => format(Number(v))} />
                <YAxis type="category" dataKey={xKey} tick={{ fontSize: 12, fill: '#52514e' }} tickLine={false} axisLine={{ stroke: '#c3c2b7' }} width={labelWidth} />
              </>
            ) : (
              <>
                <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: AXIS }} tickLine={false} axisLine={{ stroke: '#c3c2b7' }} interval={0} />
                <YAxis domain={domain} tick={{ fontSize: 11, fill: AXIS }} tickLine={false} axisLine={false} width={52} tickFormatter={(v) => format(Number(v))} />
              </>
            )}
            <Tooltip content={(p) => <ChartTooltip {...(p as TooltipContentProps<number, string>)} format={format} />} cursor={{ fill: 'rgba(15,23,42,0.04)' }} />
            {series.map((s, i) => (
              <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} stackId={stacked ? 'a' : undefined} radius={stacked && i < series.length - 1 ? 0 : radius} maxBarSize={horizontal ? 18 : 36} stroke="#fff" strokeWidth={stacked ? 1 : 0} isAnimationActive={false} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

/** Simple labelled horizontal meter rows — used for ratings / categories where a chart would be overkill. */
export function MeterList({ rows, max, format, color = SERIES[0] }: { rows: { label: ReactNode; value: number; hint?: string }[]; max: number; format: (v: number) => string; color?: string }) {
  return (
    <div className="space-y-3">
      {rows.map((r, i) => (
        <div key={i}>
          <div className="mb-1 flex items-center justify-between text-[13px]">
            <span className="text-slate-600">{r.label}</span>
            <span className="font-semibold text-slate-900 tabular">
              {format(r.value)}
              {r.hint && <span className="ml-1.5 text-xs font-normal text-slate-400">{r.hint}</span>}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full" style={{ width: `${Math.max(2, (r.value / max) * 100)}%`, background: color }} />
          </div>
        </div>
      ))}
    </div>
  )
}
