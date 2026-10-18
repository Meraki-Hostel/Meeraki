import { useMemo, useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, Download, History, Plus, TriangleAlert } from 'lucide-react';
import { services } from '@/services';
import type { InventoryView } from '@/services/interfaces';
import type { InventoryCategory, InventoryTxnType } from '@/types/domain';
import { useQuery } from '@/hooks/useQuery';
import { useMutation } from '@/hooks/useMutation';
import { useDebounced } from '@/hooks/misc';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, KpiCard } from '@/components/ui/Card';
import { Button, IconButton } from '@/components/ui/Button';
import { Checkbox, Input, Select, Textarea } from '@/components/ui/Field';
import { Modal, Drawer } from '@/components/ui/Modal';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { FilterBar, FilterSelect, SearchInput } from '@/components/ui/FilterBar';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/States';
import { exportCSV } from '@/lib/export';
import { formatDateTime, formatINR, formatINRCompact, sentenceCase } from '@/lib/format';
import { cn } from '@/lib/cn';

const CATS: InventoryCategory[] = ['linen', 'furniture', 'kitchen', 'cleaning', 'electrical', 'stationery', 'safety'];

function StockModal({ item, type, onClose }: { item: InventoryView | null; type: InventoryTxnType; onClose: () => void }) {
  const [qty, setQty] = useState('');
  const [note, setNote] = useState('');
  const m = useMutation(services.inventory.adjust, { success: (i) => `Stock updated. ${i.name}: ${i.quantity} ${i.unit}.`, onSuccess: () => { setQty(''); setNote(''); onClose(); } });
  const after = item ? item.quantity + (type === 'in' ? 1 : -1) * (Number(qty) || 0) : 0;
  return (
    <Modal open={!!item} onClose={onClose} size="sm" title={type === 'in' ? 'Stock in' : 'Stock out'} description={item ? `${item.name} · ${item.quantity} ${item.unit} in stock` : undefined}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={m.pending} onClick={() => item && void m.run({ itemId: item.id, type, quantity: Number(qty), note })}>{type === 'in' ? 'Add stock' : 'Remove stock'}</Button></>}>
      <div className="space-y-4">
        <Input label={`Quantity (${item?.unit ?? ''})`} type="number" min={1} step={1} inputMode="numeric" required value={qty} onChange={(e) => setQty(e.target.value)} error={m.fieldErrors.quantity} />
        <Textarea label="Note" rows={2} required value={note} onChange={(e) => setNote(e.target.value)} error={m.fieldErrors.note} placeholder={type === 'in' ? 'e.g. Purchased from Aminabad market' : 'e.g. Issued to Room 204'} />
        {item && Number(qty) > 0 && (
          <p className={cn('rounded-xl px-3 py-2 text-sm', after < 0 ? 'bg-brick-wash text-brick' : after <= item.reorderLevel ? 'bg-amber-wash text-amber' : 'bg-moss-wash text-moss')}>
            After this: {after} {item.unit}{after < 0 ? ' — not allowed' : after <= item.reorderLevel ? ` — at or below reorder level (${item.reorderLevel})` : ''}
          </p>
        )}
      </div>
    </Modal>
  );
}

function AddItemModal({ open, onClose, scope }: { open: boolean; onClose: () => void; scope: 'owner' | 'manager' }) {
  const props = useQuery(() => (scope === 'owner' && open ? services.properties.list() : Promise.resolve([])), [scope, open]);
  const blank = { propertyId: '', name: '', sku: '', category: 'linen' as InventoryCategory, unit: 'pcs', quantity: '0', reorderLevel: '5', unitCost: '0' };
  const [f, setF] = useState(blank);
  const m = useMutation(services.inventory.create, { success: 'Item added to inventory.', onSuccess: () => { setF(blank); onClose(); } });
  const e = m.fieldErrors;
  return (
    <Modal open={open} onClose={onClose} title="Add inventory item" size="lg"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={m.pending} onClick={() => void m.run({ ...f, propertyId: f.propertyId || undefined, quantity: Number(f.quantity), reorderLevel: Number(f.reorderLevel), unitCost: Number(f.unitCost) })}>Add item</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        {scope === 'owner' && <Select className="sm:col-span-2" label="Property" required value={f.propertyId} onChange={(ev) => setF({ ...f, propertyId: ev.target.value })} placeholder="Choose property" error={e.propertyId} options={(props.data ?? []).map((p) => ({ value: p.id, label: p.name }))} />}
        <Input label="Item name" required value={f.name} onChange={(ev) => setF({ ...f, name: ev.target.value })} error={e.name} placeholder="e.g. Mosquito net" />
        <Input label="SKU" value={f.sku} onChange={(ev) => setF({ ...f, sku: ev.target.value })} error={e.sku} hint="Optional; generated if left blank" />
        <Select label="Category" value={f.category} onChange={(ev) => setF({ ...f, category: ev.target.value as InventoryCategory })} options={CATS.map((c) => ({ value: c, label: sentenceCase(c) }))} />
        <Input label="Unit" required value={f.unit} onChange={(ev) => setF({ ...f, unit: ev.target.value })} error={e.unit} placeholder="pcs, sets, kg…" />
        <Input label="Opening stock" type="number" min={0} required value={f.quantity} onChange={(ev) => setF({ ...f, quantity: ev.target.value })} error={e.quantity} />
        <Input label="Reorder level" type="number" min={0} required value={f.reorderLevel} onChange={(ev) => setF({ ...f, reorderLevel: ev.target.value })} error={e.reorderLevel} hint="Low-stock alert at or below this" />
        <Input label="Unit cost (₹)" type="number" min={0} value={f.unitCost} onChange={(ev) => setF({ ...f, unitCost: ev.target.value })} error={e.unitCost} />
      </div>
    </Modal>
  );
}

function HistoryDrawer({ item, onClose }: { item: InventoryView | null; onClose: () => void }) {
  const q = useQuery(() => (item ? services.inventory.transactions({ itemId: item.id }) : Promise.resolve([])), [item?.id]);
  return (
    <Drawer open={!!item} onClose={onClose} title={item?.name ?? ''} description={item && `${item.sku} · ${item.propertyName}`} width="max-w-md">
      {item && (
        <>
          <div className="mb-5 grid grid-cols-3 gap-2 text-center">
            {[['In stock', `${item.quantity}`], ['Reorder at', `${item.reorderLevel}`], ['Value', formatINR(item.quantity * item.unitCost)]].map(([l, v]) => (
              <div key={l} className="rounded-xl bg-sand/60 px-2 py-3"><p className="text-xs text-dust">{l}</p><p className="font-semibold tabular-nums">{v}</p></div>
            ))}
          </div>
          <h3 className="mb-2 text-base font-semibold">Stock movements</h3>
          {(q.data ?? []).length === 0 ? <p className="text-sm text-dust">No movements recorded yet.</p> : (
            <ul className="divide-y divide-line/70">
              {(q.data ?? []).map((t) => (
                <li key={t.id} className="flex items-start gap-3 py-2.5 text-sm">
                  <span className={cn('mt-0.5 grid size-7 shrink-0 place-items-center rounded-full', t.type === 'in' ? 'bg-moss-wash text-moss' : 'bg-clay-50 text-clay-700')} aria-hidden>
                    {t.type === 'in' ? <ArrowDownToLine className="size-3.5" /> : <ArrowUpFromLine className="size-3.5" />}
                  </span>
                  <div className="flex-1"><p><span className="font-medium">{t.type === 'in' ? '+' : '−'}{t.quantity} {t.unit}</span> · {t.note}</p><p className="text-xs text-dust">{t.by} · {formatDateTime(t.at)}</p></div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Drawer>
  );
}

export function InventoryBoard({ scope }: { scope: 'owner' | 'manager' }) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [property, setProperty] = useState('');
  const [lowOnly, setLowOnly] = useState(false);
  const [adjust, setAdjust] = useState<{ item: InventoryView; type: InventoryTxnType } | null>(null);
  const [history, setHistory] = useState<InventoryView | null>(null);
  const [adding, setAdding] = useState(false);
  const ds = useDebounced(search);
  const list = useQuery(() => services.inventory.list({ category: (category || undefined) as InventoryCategory | undefined, propertyId: property || undefined, lowStockOnly: lowOnly }), [category, property, lowOnly]);
  const props = useQuery(() => (scope === 'owner' ? services.properties.list() : Promise.resolve([])), [scope]);
  const rows = useMemo(() => (list.data ?? []).filter((i) => !ds || `${i.name} ${i.sku}`.toLowerCase().includes(ds.toLowerCase())), [list.data, ds]);
  const total = list.data ?? [];
  const low = total.filter((i) => i.lowStock).length;
  const value = total.reduce((a, i) => a + i.quantity * i.unitCost, 0);

  const columns: Column<InventoryView>[] = [
    { key: 'name', header: 'Item', cell: (i) => <div className="min-w-[160px]"><p className="font-medium">{i.name}</p><p className="text-xs text-dust">{i.sku}</p></div>, sortValue: (i) => i.name },
    ...(scope === 'owner' ? [{ key: 'property', header: 'Property', cell: (i: InventoryView) => i.propertyName, sortValue: (i: InventoryView) => i.propertyName }] : []),
    { key: 'category', header: 'Category', cell: (i) => sentenceCase(i.category), sortValue: (i) => i.category, hideBelow: 'md' },
    { key: 'qty', header: 'In stock', align: 'right', cell: (i) => <span className={cn('font-semibold', i.lowStock && 'text-brick')}>{i.quantity} <span className="font-normal text-dust">{i.unit}</span></span>, sortValue: (i) => i.quantity },
    { key: 'reorder', header: 'Reorder at', align: 'right', cell: (i) => i.reorderLevel, hideBelow: 'sm' },
    { key: 'state', header: 'Level', cell: (i) => i.lowStock ? <Badge tone="brick">Low stock</Badge> : <Badge tone="moss">OK</Badge>, sortValue: (i) => Number(i.lowStock) },
    { key: 'actions', header: 'Actions', align: 'right', cell: (i) => (
      <div className="flex justify-end gap-1">
        <IconButton size="sm" label={`Stock in ${i.name}`} onClick={(e) => { e.stopPropagation(); setAdjust({ item: i, type: 'in' }); }}><ArrowDownToLine className="size-4" /></IconButton>
        <IconButton size="sm" label={i.quantity === 0 ? `${i.name} is out of stock` : `Stock out ${i.name}`} disabled={i.quantity === 0} onClick={(e) => { e.stopPropagation(); setAdjust({ item: i, type: 'out' }); }}><ArrowUpFromLine className="size-4" /></IconButton>
        <IconButton size="sm" label={`History for ${i.name}`} onClick={(e) => { e.stopPropagation(); setHistory(i); }}><History className="size-4" /></IconButton>
      </div>
    ) },
  ];

  return (
    <>
      <PageHeader title="Inventory" subtitle={scope === 'owner' ? 'Stock levels across every property. Low-stock items surface first.' : 'Track stock in and out. Items at or below reorder level are flagged automatically.'}
        actions={<>
          <Button variant="secondary" icon={<Download className="size-4" />} disabled={!rows.length} onClick={() => exportCSV('inventory', rows, [{ header: 'Item', value: (i) => i.name }, { header: 'SKU', value: (i) => i.sku }, { header: 'Property', value: (i) => i.propertyName }, { header: 'Category', value: (i) => i.category }, { header: 'Quantity', value: (i) => i.quantity }, { header: 'Unit', value: (i) => i.unit }, { header: 'Reorder level', value: (i) => i.reorderLevel }, { header: 'Low stock', value: (i) => (i.lowStock ? 'Yes' : 'No') }])}>Export CSV</Button>
          <Button icon={<Plus className="size-4" />} onClick={() => setAdding(true)}>Add item</Button>
        </>} />
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <KpiCard label="Items tracked" value={total.length} icon={<History className="size-5" />} />
        <KpiCard label="Low-stock items" value={low} icon={<TriangleAlert className="size-5" />} tone={low ? 'brick' : 'moss'} hint={low ? 'Reorder soon' : 'All levels healthy'} />
        <KpiCard label="Stock value" value={formatINRCompact(value)} icon={<ArrowDownToLine className="size-5" />} tone="clay" hint="At unit cost" />
      </div>
      <Card className="p-4 sm:p-5">
        <FilterBar className="mb-4">
          <SearchInput value={search} onChange={setSearch} placeholder="Item or SKU" label="Search inventory" />
          {scope === 'owner' && <FilterSelect label="Properties" value={property} onChange={setProperty} options={(props.data ?? []).map((p) => ({ value: p.id, label: p.name }))} />}
          <FilterSelect label="Categories" value={category} onChange={setCategory} options={CATS.map((c) => ({ value: c, label: sentenceCase(c) }))} />
          <Checkbox label="Low stock only" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} />
        </FilterBar>
        <DataTable caption="Inventory items" columns={columns} rows={list.data ? rows : undefined} loading={list.loading} error={list.error} onRetry={list.reload} rowKey={(i) => i.id} onRowClick={setHistory} rowLabel={(i) => `View ${i.name}`} pageSize={12}
          empty={<EmptyState title="No items found" message="Adjust filters or add an item." action={<Button size="sm" onClick={() => setAdding(true)}>Add item</Button>} />} />
      </Card>
      <StockModal item={adjust?.item ?? null} type={adjust?.type ?? 'in'} onClose={() => setAdjust(null)} />
      <HistoryDrawer item={history} onClose={() => setHistory(null)} />
      <AddItemModal open={adding} onClose={() => setAdding(false)} scope={scope} />
    </>
  );
}
