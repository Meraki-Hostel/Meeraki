import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { complaints, leave, visitors } from '@/api/services';
import { Badge, Body, Button, Card, Chips, Empty, ErrorState, Loading, Notice, Screen, Strong } from '@/components/ui';
import { space } from '@/components/theme';
import { useAction, useApi } from '@/hooks/api';
import { ago, date, humanize, todayISO } from '@/lib/format';

type Tab = 'complaints' | 'leave' | 'visitors';

export default function StudentRequests() {
  const params = useLocalSearchParams<{ tab?: Tab }>();
  const [tab, setTab] = useState<Tab>(params.tab ?? 'complaints');
  return (
    <Screen padded={false}>
      <View style={{ padding: space.lg, paddingBottom: 0 }}>
        <Chips<Tab> value={tab} onChange={setTab}
          options={[{ value: 'complaints', label: 'Complaints' }, { value: 'leave', label: 'Leave' }, { value: 'visitors', label: 'Visitors' }]} />
      </View>
      <View style={{ paddingHorizontal: space.lg }}>
        {tab === 'complaints' && <Complaints />}
        {tab === 'leave' && <Leave />}
        {tab === 'visitors' && <Visitors />}
      </View>
    </Screen>
  );
}

function Complaints() {
  const router = useRouter();
  const list = useApi(['complaints'], () => complaints.list());
  return (
    <>
      <Button title="New complaint" icon="add" onPress={() => router.push('/student/complaints/new')} style={{ marginBottom: space.md }} />
      {list.loading ? <Loading /> : list.error ? <ErrorState error={list.error} onRetry={list.refetch} /> : (list.data ?? []).length === 0 ? (
        <Empty title="No complaints" body="Something broken or not working? Raise a complaint and the warden is notified." />
      ) : (list.data ?? []).map((c) => (
        <Card key={c.id} onPress={() => router.push(`/student/complaints/${c.id}`)} accessibilityLabel={c.title}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Strong>{c.title}</Strong>
            <Badge label={c.status} />
          </View>
          <Body muted>{c.ticketNo} · {humanize(c.category)} · {ago(c.createdAt)}</Body>
        </Card>
      ))}
    </>
  );
}

function Leave() {
  const router = useRouter();
  const list = useApi(['leave'], () => leave.list());
  const cancel = useAction(leave.cancel);
  return (
    <>
      <Button title="Apply for leave" icon="add" onPress={() => router.push('/student/leave/new')} style={{ marginBottom: space.md }} />
      <Notice error={cancel.error} />
      {list.loading ? <Loading /> : list.error ? <ErrorState error={list.error} onRetry={list.refetch} /> : (list.data ?? []).length === 0 ? (
        <Empty title="No leave requests" body="Going home or travelling? Apply here so the warden knows." />
      ) : (list.data ?? []).map((l) => (
        <Card key={l.id}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Strong>{date(l.from)} – {date(l.to)}</Strong>
            <Badge label={l.status} />
          </View>
          <Body muted>{l.destination} · {l.reason}</Body>
          {!!l.decisionReason && <Body muted>Warden: {l.decisionReason}</Body>}
          {(l.status === 'pending' || (l.status === 'approved' && l.from > todayISO())) && (
            <Button title="Cancel request" variant="secondary" style={{ marginTop: space.sm }} loading={cancel.busy}
              onPress={() => Alert.alert('Cancel this leave request?', undefined, [
                { text: 'Keep', style: 'cancel' }, { text: 'Cancel request', style: 'destructive', onPress: () => { void cancel.run(l.id); } },
              ])} />
          )}
        </Card>
      ))}
    </>
  );
}

function Visitors() {
  const router = useRouter();
  const list = useApi(['visitors'], () => visitors.list());
  const cancel = useAction(visitors.cancel);
  return (
    <>
      <Button title="Register a visitor" icon="add" onPress={() => router.push('/student/visitors/new')} style={{ marginBottom: space.md }} />
      <Notice error={cancel.error} />
      {list.loading ? <Loading /> : list.error ? <ErrorState error={list.error} onRetry={list.refetch} /> : (list.data ?? []).length === 0 ? (
        <Empty title="No visitors" body="Expecting someone? Register them so security lets them in." />
      ) : (list.data ?? []).map((v) => (
        <Card key={v.id}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Strong>{v.visitorName}</Strong>
            <Badge label={v.status} />
          </View>
          <Body muted>{humanize(v.relation)} · {date(v.visitDate)} {v.visitTime}</Body>
          {!!v.decisionReason && <Body muted>Warden: {v.decisionReason}</Body>}
          {(v.status === 'pending' || v.status === 'approved') && (
            <Button title="Cancel visit" variant="secondary" style={{ marginTop: space.sm }} loading={cancel.busy}
              onPress={() => Alert.alert('Cancel this visit?', undefined, [
                { text: 'Keep', style: 'cancel' }, { text: 'Cancel visit', style: 'destructive', onPress: () => { void cancel.run(v.id); } },
              ])} />
          )}
        </Card>
      ))}
    </>
  );
}
