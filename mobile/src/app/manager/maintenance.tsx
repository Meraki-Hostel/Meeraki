import { useState } from 'react';
import { View } from 'react-native';
import { maintenance } from '@/api/services';
import { Badge, Body, Card, Chips, Empty, ErrorState, Field, Button, Loading, Notice, Screen, Strong } from '@/components/ui';
import { space } from '@/components/theme';
import type { MaintenanceStatus } from '@/contract/domain';
import type { MaintenanceView } from '@/contract/interfaces';
import { useAction, useApi } from '@/hooks/api';
import { ago, humanize, inr } from '@/lib/format';

const NEXT: Record<MaintenanceStatus, MaintenanceStatus[]> = {
  open: ['in_progress', 'on_hold'],
  assigned: ['in_progress', 'on_hold'],
  in_progress: ['completed', 'on_hold'],
  on_hold: ['in_progress'],
  completed: [],
};

export default function Maintenance() {
  const [status, setStatus] = useState<MaintenanceStatus | 'active'>('active');
  const list = useApi(['maintenance', status], async () => {
    const rows = await maintenance.list(status === 'active' ? {} : { status });
    return status === 'active' ? rows.filter((t) => t.status !== 'completed') : rows;
  });
  return (
    <Screen onRefresh={list.refetch} refreshing={list.refreshing}>
      <Chips<MaintenanceStatus | 'active'> value={status} onChange={setStatus}
        options={[{ value: 'active', label: 'Active' }, { value: 'open', label: 'Open' }, { value: 'in_progress', label: 'In progress' }, { value: 'on_hold', label: 'On hold' }, { value: 'completed', label: 'Done' }]} />
      {list.loading ? <Loading /> : list.error ? <ErrorState error={list.error} onRetry={list.refetch} /> : (list.data ?? []).length === 0 ? (
        <Empty title="No tickets" icon="hammer-outline" />
      ) : (list.data ?? []).map((t) => <Ticket key={t.id} t={t} />)}
      <Body muted>New tickets with vendors and cost estimates are raised on the web app.</Body>
    </Screen>
  );
}

function Ticket({ t }: { t: MaintenanceView }) {
  const update = useAction(maintenance.update);
  const [cost, setCost] = useState('');
  const [finishing, setFinishing] = useState(false);
  return (
    <Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.sm }}>
        <Strong>{t.title}</Strong>
        <Badge label={t.status} />
      </View>
      <Body muted>{t.ticketNo} · {humanize(t.category)} · {t.location} · {ago(t.createdAt)}</Body>
      <Body muted>{t.assigneeName ? `Assigned: ${t.assigneeName}` : t.vendor ? `Vendor: ${t.vendor}` : 'Unassigned'} · est. {inr(t.estimatedCost)}</Body>
      <Notice error={update.error} />
      {finishing ? (
        <View style={{ marginTop: space.sm }}>
          <Field label="Actual cost (₹)" value={cost} onChangeText={setCost} keyboardType="numeric" error={update.fieldErrors.actualCost} />
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Button title="Back" variant="secondary" onPress={() => setFinishing(false)} style={{ flex: 1 }} />
            <Button title="Mark done" loading={update.busy} style={{ flex: 1 }}
              onPress={() => {
                // The API needs the actual cost to close a ticket (0 is fine for in-house work).
                if (cost.trim() === '' || !(Number(cost) >= 0)) { update.setFieldErrors({ actualCost: 'Enter the actual cost (0 if none)' }); return; }
                void update.run(t.id, { status: 'completed', actualCost: Number(cost) });
              }} />
          </View>
        </View>
      ) : NEXT[t.status].length > 0 && (
        <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.sm }}>
          {NEXT[t.status].map((s) => (
            <Button key={s} title={s === 'completed' ? 'Done' : humanize(s)} variant={s === 'completed' ? 'primary' : 'secondary'} loading={update.busy}
              onPress={() => (s === 'completed' ? setFinishing(true) : void update.run(t.id, { status: s }))} style={{ flex: 1 }} />
          ))}
        </View>
      )}
    </Card>
  );
}
