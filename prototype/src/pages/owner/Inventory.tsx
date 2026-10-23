import { useState } from 'react'
import { Package } from 'lucide-react'
import { useStore } from '../../store/AppStore'
import { inventoryStatus } from '../../store/selectors'
import { formatINR } from '../../lib/utils'
import { Card, EmptyState, KpiCard, PageHeader, Select, StatusBadge, Table, Tabs, Td, Th, Tr } from '../../components/ui'

export default function OwnerInventory() {
  const { data } = useStore()
  const [pid, setPid] = useState('all')
  const [tab, setTab] = useState<'low' | 'all'>('low')
  const items = data.inventory.filter((it) => pid === 'all' || it.propertyId === pid)
  const low = items.filter((it) => inventoryStatus(it.stock, it.min) !== 'ok')
  const rows = (tab === 'low' ? low : items).slice().sort((a, b) => a.stock / Math.max(1, a.min) - b.stock / Math.max(1, b.min))
  const value = items.reduce((a, it) => a + it.stock * it.unitCost, 0)
  const reorder = low.reduce((a, it) => a + Math.max(0, it.min * 2 - it.stock) * it.unitCost, 0)
  const pName = (id: string) => data.properties.find((p) => p.id === id)?.name

  return (
    <div>
      <PageHeader title="Inventory" description="Stock levels across properties — managers update stock" actions={
        <Select value={pid} onChange={(e) => setPid(e.target.value)} className="h-9 w-52">
          <option value="all">All properties</option>
          {data.properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
      } />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Items tracked" value={items.length} icon={Package} />
        <KpiCard label="Low / out of stock" value={low.length} tone="amber" />
        <KpiCard label="Stock value" value={formatINR(value)} />
        <KpiCard label="Est. reorder cost" value={formatINR(reorder)} sub="To reach 2× minimum" tone="brand" />
      </div>
      <Card>
        <div className="px-4 pt-2"><Tabs value={tab} onChange={setTab} items={[{ value: 'low', label: 'Needs reorder', count: low.length }, { value: 'all', label: 'All items', count: items.length }]} /></div>
        {rows.length === 0 ? <EmptyState icon={Package} title="Stock levels look healthy" /> : (
          <Table>
            <thead><tr><Th>Item</Th>{pid === 'all' && <Th>Property</Th>}<Th className="text-right">Stock</Th><Th className="text-right">Minimum</Th><Th>Status</Th></tr></thead>
            <tbody>
              {rows.map((it) => (
                <Tr key={it.id}>
                  <Td className="font-medium text-slate-900">{it.name}</Td>
                  {pid === 'all' && <Td className="text-[13px]">{pName(it.propertyId)}</Td>}
                  <Td className="text-right tabular">{it.stock} {it.unit}</Td>
                  <Td className="text-right text-slate-500 tabular">{it.min}</Td>
                  <Td><StatusBadge status={`stock-${inventoryStatus(it.stock, it.min)}`} /></Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  )
}
