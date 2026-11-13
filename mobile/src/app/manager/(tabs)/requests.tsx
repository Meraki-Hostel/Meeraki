import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { leave, visitors } from '@/api/services';
import { Decision } from '@/components/Decision';
import { Badge, Body, Button, Card, Chips, Empty, ErrorState, Loading, Notice, Screen, Strong } from '@/components/ui';
import { space } from '@/components/theme';
import type { LeaveStatus, VisitorStatus } from '@/contract/domain';
import { ComplaintQueue } from '@/features/ComplaintQueue';
import { useAction, useApi } from '@/hooks/api';
import { date, humanize } from '@/lib/format';

type Tab = 'complaints' | 'leave' | 'visitors';

export default function ManagerRequests() {
  const params = useLocalSearchParams<{ tab?: Tab }>();
  const [tab, setTab] = useState<Tab>(params.tab ?? 'complaints');
  return (
    <Screen padded={false}>
      <View style={{ padding: space.lg, paddingBottom: 0 }}>
        <Chips<Tab> value={tab} onChange={setTab}
          options={[{ value: 'complaints', label: 'Complaints' }, { value: 'leave', label: 'Leave' }, { value: 'visitors', label: 'Visitors' }]} />
      </View>
      <View style={{ paddingHorizontal: space.lg }}>
        {tab === 'complaints' && <ComplaintQueue basePath="/manager/complaints" />}
        {tab === 'leave' && <LeaveQueue />}
        {tab === 'visitors' && <VisitorQueue />}
      </View>
    </Screen>
  );
}

function LeaveQueue() {
  const [status, setStatus] = useState<LeaveStatus>('pending');
  const list = useApi(['leave', status], () => leave.list({ status }));
  const decide = useAction(leave.decide);
  return (
    <>
      <Chips<LeaveStatus> value={status} onChange={setStatus}
        options={[{ value: 'pending', label: 'Pending' }, { value: 'approved', label: 'Approved' }, { value: 'rejected', label: 'Rejected' }]} />
      <Notice error={decide.error} />
      {list.loading ? <Loading /> : list.error ? <ErrorState error={list.error} onRetry={list.refetch} /> : (list.data ?? []).length === 0 ? (
        <Empty title={status === 'pending' ? 'No leave to approve' : 'Nothing here'} icon="checkmark-circle-outline" />
      ) : (list.data ?? []).map((l) => (
        <Card key={l.id}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Strong>{l.studentName}{l.roomNumber ? ` · ${l.roomNumber}` : ''}</Strong>
            <Badge label={l.status} />
          </View>
          <Body>{date(l.from)} – {date(l.to)} · {l.destination}</Body>
          <Body muted>{l.reason} · 📞 {l.contactPhone}</Body>
          {!!l.decisionReason && <Body muted>Reason: {l.decisionReason}</Body>}
          {l.status === 'pending' && <Decision busy={decide.busy} onDecide={(d, r) => { void decide.run(l.id, d, r); }} />}
        </Card>
      ))}
    </>
  );
}

function VisitorQueue() {
  const router = useRouter();
  const [status, setStatus] = useState<VisitorStatus>('pending');
  const list = useApi(['visitors', status], () => visitors.list({ status }));
  const decide = useAction(visitors.decide);
  const checkIn = useAction(visitors.checkIn);
  const checkOut = useAction(visitors.checkOut);
  return (
    <>
      <Button title="Log a walk-in visitor" icon="person-add-outline" variant="secondary" onPress={() => router.push('/manager/visitors/walk-in')} style={{ marginBottom: space.md }} />
      <Chips<VisitorStatus> value={status} onChange={setStatus}
        options={[{ value: 'pending', label: 'Pending' }, { value: 'approved', label: 'Expected' }, { value: 'checked_in', label: 'Inside' }, { value: 'checked_out', label: 'Left' }]} />
      <Notice error={decide.error ?? checkIn.error ?? checkOut.error} />
      {list.loading ? <Loading /> : list.error ? <ErrorState error={list.error} onRetry={list.refetch} /> : (list.data ?? []).length === 0 ? (
        <Empty title="Nothing here" icon="people-outline" />
      ) : (list.data ?? []).map((v) => (
        <Card key={v.id}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Strong>{v.visitorName}</Strong>
            <Badge label={v.status} />
          </View>
          <Body>{humanize(v.relation)} of {v.studentName}{v.roomNumber ? ` (Room ${v.roomNumber})` : ''}</Body>
          <Body muted>{date(v.visitDate)} {v.visitTime} · 📞 {v.visitorPhone}{v.purpose ? ` · ${v.purpose}` : ''}</Body>
          {v.status === 'pending' && <Decision busy={decide.busy} onDecide={(d, r) => { void decide.run(v.id, d, r); }} />}
          {v.status === 'approved' && <Button title="Check in" icon="log-in-outline" loading={checkIn.busy} onPress={() => { void checkIn.run(v.id); }} style={{ marginTop: space.sm }} />}
          {v.status === 'checked_in' && <Button title="Check out" icon="log-out-outline" variant="secondary" loading={checkOut.busy} onPress={() => { void checkOut.run(v.id); }} style={{ marginTop: space.sm }} />}
        </Card>
      ))}
    </>
  );
}
