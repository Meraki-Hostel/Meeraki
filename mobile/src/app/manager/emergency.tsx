import { useState } from 'react';
import { Linking, View } from 'react-native';
import { emergency } from '@/api/services';
import { Badge, Body, Button, Card, Chips, Empty, ErrorState, Field, Loading, Notice, Screen, Strong } from '@/components/ui';
import { color, space } from '@/components/theme';
import type { EmergencyAlertView } from '@/contract/interfaces';
import { useAction, useApi } from '@/hooks/api';
import { ago, dateTime, humanize } from '@/lib/format';

type S = EmergencyAlertView['status'];

export default function EmergencyAlerts() {
  const [status, setStatus] = useState<S>('open');
  const list = useApi(['emergency', status], () => emergency.list({ status }));
  return (
    <Screen onRefresh={list.refetch} refreshing={list.refreshing}>
      <Chips<S> value={status} onChange={setStatus}
        options={[{ value: 'open', label: 'Open' }, { value: 'acknowledged', label: 'Responding' }, { value: 'resolved', label: 'Resolved' }]} />
      {list.loading ? <Loading /> : list.error ? <ErrorState error={list.error} onRetry={list.refetch} /> : (list.data ?? []).length === 0 ? (
        <Empty title={status === 'open' ? 'No open alerts' : 'Nothing here'} icon="shield-checkmark-outline" />
      ) : (list.data ?? []).map((a) => <Alert_ key={a.id} a={a} />)}
    </Screen>
  );
}

function Alert_({ a }: { a: EmergencyAlertView }) {
  const ack = useAction(emergency.acknowledge);
  const resolve = useAction(emergency.resolve);
  const [closing, setClosing] = useState(false);
  const [note, setNote] = useState('');
  return (
    <Card style={a.status === 'open' && { borderColor: color.brick, borderWidth: 2 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Strong>{humanize(a.type)} · {a.studentName}</Strong>
        <Badge label={a.status} />
      </View>
      <Body>{a.message}</Body>
      <Body muted>{a.location || (a.roomNumber ? `Room ${a.roomNumber}` : a.propertyName)} · {ago(a.createdAt)}</Body>
      {!!a.acknowledgedBy && <Body muted>Responding: {a.acknowledgedBy} ({dateTime(a.acknowledgedAt)})</Body>}
      {!!a.resolutionNote && <Body muted>Resolved: {a.resolutionNote}</Body>}
      <Notice error={ack.error ?? resolve.error} />
      {a.status === 'open' && <Button title="I'm responding" icon="hand-left-outline" variant="danger" loading={ack.busy} onPress={() => { void ack.run(a.id); }} style={{ marginTop: space.sm }} />}
      {a.status === 'acknowledged' && (closing ? (
        <View style={{ marginTop: space.sm }}>
          <Field label="What happened? (optional)" value={note} onChangeText={setNote} multiline maxLength={500} />
          <Button title="Mark resolved" loading={resolve.busy} onPress={() => { void resolve.run(a.id, note.trim() || undefined); }} />
        </View>
      ) : <Button title="Resolve" variant="secondary" onPress={() => setClosing(true)} style={{ marginTop: space.sm }} />)}
      {a.status !== 'resolved' && <Button title="Call 112" icon="call" variant="ghost" onPress={() => { void Linking.openURL('tel:112'); }} />}
    </Card>
  );
}
