import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowDownRight, ArrowUpRight, MinusCircle, Package, Pencil, Plus, PlusCircle } from 'lucide-react'
import { useManagerProperty, useStore } from '../../store/AppStore'
import { inventoryStatus } from '../../store/selectors'
import type { InventoryItem } from '../../lib/types'
import { cn, formatDate, formatINR } from '../../lib/utils'
import { Button, Card, Drawer, EmptyState, Field, Input, KpiCard, Modal, PageHeader, SearchInput, Segmented, Select, StatusBadge, Table, Tabs, Td, Th, Tr, useToast } from '../../components/ui'

type Filter = 'all' | 'low' | 'out'
const CATEGORIES: InventoryItem['category'][] = ['Furniture', 'Bedding', 'Electrical', 'Cleaning', 'Kitchen', 'Hardware']

export default function InventoryPage() {
  const { data } = useStore()
  const property = useManagerProperty()
  const [params, setParams] = useSearchParams()
  const filter = (params.get('filter') as Filter) ?? 'all'
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('all')
  const [openId, setOpenId] = useState<string | null>(null)
  const [modal, setModal] = useState<{ type: 'add' | 'issue' | 'edit' | 'new'; item?: InventoryItem } | null>(null)
  const items = data.inventory.filter((it) => it.propertyId === property.id)
  const low = items.filter((it) => inventoryStatus(it.stock, it.min) !== 'ok')
  const out = items.filter((it) => it.stock <= 0)
  const rows = items
    .filter((it) => filter === 'all' || (filter === 'low' ? inventoryStatus(it.stock, it.min) !== 'ok' : it.stock <= 0))
    .filter((it) => category === 'all' || it.category === category)
    .filter((it) => !q || it.name.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a.stock / Math.max(1, a.min) - b.stock / Math.max(1, b.min))
  const value = items.reduce((a, it) => a + it.stock * it.unitCost, 0)
  const opened = openId ? items.find((x) => x.id === openId) : null

  const rowActions = (it: InventoryItem) => (
    <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
      <Button size="xs" variant="subtle" icon={PlusCircle} onClick={() => setModal({ type: 'add', item: it })}>Add stock</Button>
      <Button size="xs" variant="ghost" icon={MinusCircle} onClick={() => setModal({ type: 'issue', item: it })}>Issue</Button>
      <Button size="xs" variant="ghost" icon={Pencil} aria-label="Edit item" onClick={() => setModal({ type: 'edit', item: it })} />
    </div>
  )

  return (
    <div>
      <PageHeader title="Inventory" description={`Stock at ${property.name}`} actions={<Button variant="primary" icon={Plus} onClick={() => setModal({ type: 'new' })}>New item</Button>} />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Items tracked" value={items.length} icon={Package} />
        <KpiCard label="Low stock" value={low.length} tone="amber" sub="Below minimum" onClick={() => setParams({ filter: 'low' })} />
        <KpiCard label="Out of stock" value={out.length} tone="red" onClick={() => setParams({ filter: 'out' })} />
        <KpiCard label="Stock value" value={formatINR(value)} sub="At last purchase price" />
      </div>
      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 pb-0 sm:flex-row sm:items-end">
          <Tabs<Filter> className="flex-1 border-b-0" value={filter} onChange={(f) => setParams(f === 'all' ? {} : { filter: f }, { replace: true })} items={[{ value: 'all', label: 'All items', count: items.length }, { value: 'low', label: 'Low stock', count: low.length }, { value: 'out', label: 'Out of stock', count: out.length }]} />
          <div className="flex gap-2 pb-3">
            <SearchInput value={q} onChange={setQ} placeholder="Search items" className="sm:w-52" />
            <Select value={category} onChange={(e) => setCategory(e.target.value)} className="h-9 w-36">
              <option value="all">All categories</option>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </Select>
          </div>
        </div>
        {rows.length === 0 ? (
          <EmptyState icon={Package} title={filter === 'all' ? 'No items found' : 'Stock levels look healthy'} description={filter !== 'all' ? 'No items are below their minimum level.' : undefined} action={filter !== 'all' && <Button size="sm" onClick={() => setParams({})}>View all items</Button>} />
        ) : (
          <>
            <div className="hidden md:block">
              <Table>
                <thead><tr><Th>Item</Th><Th>Category</Th><Th className="text-right">Current stock</Th><Th className="text-right">Minimum</Th><Th>Level</Th><Th>Status</Th><Th className="text-right">Actions</Th></tr></thead>
                <tbody>
                  {rows.map((it) => {
                    const s = inventoryStatus(it.stock, it.min)
                    return (
                      <Tr key={it.id} onClick={() => setOpenId(it.id)}>
                        <Td className="font-medium text-slate-900">{it.name}</Td>
                        <Td className="text-[13px]">{it.category}</Td>
                        <Td className="text-right font-semibold text-slate-900 tabular">{it.stock} <span className="text-xs font-normal text-slate-400">{it.unit}</span></Td>
                        <Td className="text-right text-slate-500 tabular">{it.min}</Td>
                        <Td className="w-32"><StockBar stock={it.stock} min={it.min} /></Td>
                        <Td><StatusBadge status={`stock-${s}`} /></Td>
                        <Td>{rowActions(it)}</Td>
                      </Tr>
                    )
                  })}
                </tbody>
              </Table>
            </div>
            <ul className="divide-y divide-slate-100 md:hidden">
              {rows.map((it) => (
                <li key={it.id} className="px-4 py-3" onClick={() => setOpenId(it.id)}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-slate-900">{it.name}</div>
                      <div className="text-xs text-slate-500">{it.stock} {it.unit} · min {it.min}</div>
                    </div>
                    <StatusBadge status={`stock-${inventoryStatus(it.stock, it.min)}`} />
                  </div>
                  <div className="mt-2">{rowActions(it)}</div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      {opened && (
        <Drawer open onClose={() => setOpenId(null)} title={opened.name} description={`${opened.category} · ${formatINR(opened.unitCost)} per ${opened.unit === 'pcs' ? 'piece' : opened.unit.replace(/s$/, '')}`}
          footer={<><Button icon={MinusCircle} onClick={() => setModal({ type: 'issue', item: opened })}>Issue item</Button><Button variant="primary" icon={PlusCircle} onClick={() => setModal({ type: 'add', item: opened })}>Add stock</Button></>}>
          <div className="mb-6 grid grid-cols-3 divide-x divide-slate-100 rounded-xl border border-slate-200">
            <div className="p-3 text-center"><div className={cn('text-xl font-semibold tabular', opened.stock < opened.min ? 'text-amber-700' : 'text-slate-900')}>{opened.stock}</div><div className="text-xs text-slate-500">Current stock</div></div>
            <div className="p-3 text-center"><div className="text-xl font-semibold text-slate-900 tabular">{opened.min}</div><div className="text-xs text-slate-500">Minimum</div></div>
            <div className="flex flex-col items-center justify-center p-3"><StatusBadge status={`stock-${inventoryStatus(opened.stock, opened.min)}`} /></div>
          </div>
          <div className="mb-2 text-xs font-semibold tracking-wide text-slate-400 uppercase">Recent activity</div>
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {opened.log.map((l) => (
              <li key={l.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className={cn('flex size-8 items-center justify-center rounded-full', l.delta > 0 ? 'bg-emerald-50 text-emerald-600' : l.kind === 'damaged' ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-600')}>
                  {l.delta > 0 ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}
                </span>
                <div className="flex-1">
                  <div className="text-sm font-medium text-slate-900">{l.delta > 0 ? '+' : ''}{l.delta} {l.kind}</div>
                  <div className="text-xs text-slate-500">{l.note} · {formatDate(l.date)}</div>
                </div>
              </li>
            ))}
          </ul>
        </Drawer>
      )}

      {modal && <InventoryModal key={modal.type + (modal.item?.id ?? '')} {...modal} propertyId={property.id} onClose={() => setModal(null)} />}
    </div>
  )
}

function StockBar({ stock, min }: { stock: number; min: number }) {
  const target = Math.max(min * 2, 1)
  const s = inventoryStatus(stock, min)
  return (
    <div className="relative h-1.5 rounded-full bg-slate-100">
      <div className={cn('h-full rounded-full', s === 'ok' ? 'bg-emerald-500' : s === 'low' ? 'bg-amber-500' : 'bg-rose-500')} style={{ width: `${Math.min(100, (stock / target) * 100)}%` }} />
      <div className="absolute -top-0.5 h-2.5 w-px bg-slate-400" style={{ left: '50%' }} title="Minimum" />
    </div>
  )
}

function InventoryModal({ type, item, propertyId, onClose }: { type: 'add' | 'issue' | 'edit' | 'new'; item?: InventoryItem; propertyId: string; onClose: () => void }) {
  const { adjustStock, saveItem } = useStore()
  const toast = useToast()
  const [qty, setQty] = useState('')
  const [note, setNote] = useState('')
  const [kind, setKind] = useState<'issued' | 'damaged'>('issued')
  const [cost, setCost] = useState(item ? String(item.unitCost) : '')
  const [f, setF] = useState({ name: item?.name ?? '', category: item?.category ?? 'Furniture', stock: String(item?.stock ?? ''), min: String(item?.min ?? ''), unit: item?.unit ?? 'pcs', unitCost: String(item?.unitCost ?? '') })

  if (type === 'add' || type === 'issue') {
    const n = Number(qty)
    const submit = () => {
      if (!n || n <= 0) return toast.error('Enter a quantity.')
      if (type === 'issue' && n > item!.stock) return toast.error(`Only ${item!.stock} in stock.`)
      if (type === 'add') adjustStock(item!.id, n, 'purchased', note || 'Stock purchased', n * (Number(cost) || 0))
      else adjustStock(item!.id, -n, kind, note)
      const next = item!.stock + (type === 'add' ? n : -n)
      toast.success(type === 'add' ? 'Stock added' : kind === 'issued' ? 'Item issued' : 'Marked damaged', { description: `${item!.name}: ${next} in stock${next < item!.min ? ' — still below minimum' : ''}` })
      onClose()
    }
    return (
      <Modal open onClose={onClose} size="sm" title={`${type === 'add' ? 'Add stock' : 'Issue item'} · ${item!.name}`} description={`Currently ${item!.stock} ${item!.unit} (minimum ${item!.min})`}
        footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={submit}>{type === 'add' ? 'Add stock' : 'Confirm'}</Button></>}>
        <div className="space-y-4">
          {type === 'issue' && <Segmented items={[{ value: 'issued', label: 'Issued to room' }, { value: 'damaged', label: 'Damaged / lost' }]} value={kind} onChange={setKind} />}
          <Field label="Quantity"><Input autoFocus type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} placeholder="10" /></Field>
          {type === 'add' && <Field label="Unit cost" hint={n > 0 ? `Total ${formatINR(n * (Number(cost) || 0))} — added to Supplies expense` : 'Added to this month’s expenses'}><Input prefix="₹" type="number" value={cost} onChange={(e) => setCost(e.target.value)} /></Field>}
          <Field label={type === 'add' ? 'Vendor / note' : 'Issued to / note'}><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={type === 'add' ? 'e.g. Sharma Electricals' : 'e.g. Room 204'} /></Field>
        </div>
      </Modal>
    )
  }
  const save = () => {
    if (!f.name.trim()) return toast.error('Item name is required.')
    saveItem({ id: item?.id, propertyId, name: f.name.trim(), category: f.category as InventoryItem['category'], stock: Number(f.stock) || 0, min: Number(f.min) || 0, unit: f.unit || 'pcs', unitCost: Number(f.unitCost) || 0 })
    toast.success(item ? 'Item updated' : 'Item added')
    onClose()
  }
  return (
    <Modal open onClose={onClose} title={item ? `Edit ${item.name}` : 'New inventory item'} footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>Save</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Item name" className="sm:col-span-2"><Input autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Ceiling fans" /></Field>
        <Field label="Category"><Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as InventoryItem['category'] })}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</Select></Field>
        <Field label="Unit"><Input value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} /></Field>
        <Field label={item ? 'Current stock' : 'Opening stock'}><Input type="number" value={f.stock} onChange={(e) => setF({ ...f, stock: e.target.value })} /></Field>
        <Field label="Minimum stock" hint="Alert when stock falls below this"><Input type="number" value={f.min} onChange={(e) => setF({ ...f, min: e.target.value })} /></Field>
        <Field label="Unit cost"><Input prefix="₹" type="number" value={f.unitCost} onChange={(e) => setF({ ...f, unitCost: e.target.value })} /></Field>
      </div>
    </Modal>
  )
}
