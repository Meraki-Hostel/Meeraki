import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { complaints } from '@/api/services';
import { Badge, Body, Card, Chips, Empty, ErrorState, Loading, Strong } from '@/components/ui';
import { space } from '@/components/theme';
import type { ComplaintStatus } from '@/contract/domain';
import { useApi } from '@/hooks/api';
import { ago, humanize } from '@/lib/format';

/** Complaints for staff: a manager sees their property, an owner every property. */
export function ComplaintQueue({ basePath }: { basePath: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<ComplaintStatus | 'all'>('open');
  const list = useApi(['complaints', status], () => complaints.list(status === 'all' ? {} : { status }));
  return (
    <>
      <Chips<ComplaintStatus | 'all'> value={status} onChange={setStatus}
        options={[{ value: 'open', label: 'Open' }, { value: 'in_progress', label: 'In progress' }, { value: 'resolved', label: 'Resolved' }, { value: 'all', label: 'All' }]} />
      {list.loading ? <Loading /> : list.error ? <ErrorState error={list.error} onRetry={list.refetch} /> : (list.data ?? []).length === 0 ? (
        <Empty title="Nothing here" icon="checkmark-circle-outline" />
      ) : (list.data ?? []).map((c) => (
        <Card key={c.id} onPress={() => router.push(`${basePath}/${c.id}` as never)} accessibilityLabel={c.title}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.sm }}>
            <Strong>{c.title}</Strong>
            <Badge label={c.priority} tone={c.priority === 'urgent' ? 'bad' : c.priority === 'high' ? 'warn' : 'neutral'} />
          </View>
          <Body muted>{c.studentName}{c.roomNumber ? ` · Room ${c.roomNumber}` : ''} · {humanize(c.category)}</Body>
          <Body muted>{c.ticketNo} · {humanize(c.status)} · {ago(c.createdAt)}</Body>
        </Card>
      ))}
    </>
  );
}
