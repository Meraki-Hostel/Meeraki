import { useState } from 'react';
import { View } from 'react-native';
import { inventory } from '@/api/services';
import { Badge, Body, Button, Card, Chips, Empty, ErrorState, Field, Loading, Notice, Screen, Strong } from '@/components/ui';
import { space } from '@/components/theme';
import type { InventoryView } from '@/contract/interfaces';
import { useAction, useApi } from '@/hooks/api';
import { humanize } from '@/lib/format';

export default function Inventory() {
  const [low, setLow] = useState<'low' | 'all'>('low');
  const list = useApi(['inventory', low], () => inventory.list({ lowStockOnly: low === 'low' }));
  return (
    <Screen onRefresh={list.refetch} refreshing={list.refreshing}>
      <Chips<'low' | 'all'> value={low} onChange={setLow} options={[{ value: 'low', label: 'Low stock' }, { value: 'all', label: 'All items' }]} />
      {list.loading ? <Loading /> : list.error ? <ErrorState error={list.error} onRetry={list.refetch} /> : (list.data ?? []).length === 0 ? (
        <Empty title={low === 'low' ? 'Nothing is low on stock' : 'No items'} icon="cube-outline" />
      ) : (list.data ?? []).map((i) => <Item key={i.id} i={i} />)}
    </Screen>
  );
}

function Item({ i }: { i: InventoryView }) {
  const adjust = useAction(inventory.adjust);
  const [mode, setMode] = useState<'in' | 'out' | null>(null);
  const [qty, setQty] = useState('');
  const [note, setNote] = useState('');

  async function save() {
    const n = Number(qty);
    if (!(n > 0)) { adjust.setFieldErrors({ quantity: 'Enter a quantity' }); return; }
    if (mode === 'out' && n > i.quantity) { adjust.setFieldErrors({ quantity: `Only ${i.quantity} ${i.unit} in stock` }); return; }
    if (await adjust.run({ itemId: i.id, type: mode ?? 'in', quantity: n, note: note.trim() })) { setMode(null); setQty(''); setNote(''); }
  }

  return (
    <Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Strong>{i.name}</Strong>
        {i.lowStock && <Badge label="Low" tone="bad" />}
      </View>
      <Body>{i.quantity} {i.unit} <Body muted>(reorder at {i.reorderLevel})</Body></Body>
      <Body muted>{i.sku} · {humanize(i.category)}</Body>
      <Notice error={adjust.error} />
      {mode ? (
        <View style={{ marginTop: space.sm }}>
          <Field label={mode === 'in' ? `Received (${i.unit})` : `Used / issued (${i.unit})`} value={qty} onChangeText={setQty} keyboardType="numeric" error={adjust.fieldErrors.quantity} autoFocus />
          <Field label="Note" value={note} onChangeText={setNote} error={adjust.fieldErrors.note} placeholder={mode === 'in' ? 'e.g. From vendor' : 'e.g. Room 204'} />
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Button title="Back" variant="secondary" onPress={() => setMode(null)} style={{ flex: 1 }} />
            <Button title="Save" onPress={() => { void save(); }} loading={adjust.busy} style={{ flex: 1 }} />
          </View>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.sm }}>
          <Button title="Stock in" icon="add" variant="secondary" onPress={() => setMode('in')} style={{ flex: 1 }} />
          <Button title="Stock out" icon="remove" variant="secondary" onPress={() => setMode('out')} style={{ flex: 1 }} />
        </View>
      )}
    </Card>
  );
}
