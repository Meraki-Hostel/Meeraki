import { useRouter } from 'expo-router';
import { useState } from 'react';
import { students } from '@/api/services';
import { Badge, Card, Chips, Empty, ErrorState, Field, Loading, Row, Screen } from '@/components/ui';
import type { StudentStatus } from '@/contract/domain';
import { useApi } from '@/hooks/api';
import { inr } from '@/lib/format';

export default function Residents() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StudentStatus>('active');
  const list = useApi(['students', status, search], () => students.list({ status, search: search.trim() || undefined }));
  return (
    <Screen onRefresh={list.refetch} refreshing={list.refreshing}>
      <Field label="Search" value={search} onChangeText={setSearch} placeholder="Name, code, phone or room" autoCorrect={false} />
      <Chips<StudentStatus> value={status} onChange={setStatus}
        options={[{ value: 'active', label: 'Active' }, { value: 'notice', label: 'On notice' }, { value: 'pending', label: 'Pending' }, { value: 'moved_out', label: 'Moved out' }]} />
      {list.loading ? <Loading /> : list.error ? <ErrorState error={list.error} onRetry={list.refetch} /> : (list.data ?? []).length === 0 ? (
        <Empty title="No residents match" icon="people-outline" />
      ) : (
        <Card>
          {(list.data ?? []).map((s) => (
            <Row key={s.id} title={s.name} subtitle={`${s.studentCode}${s.roomNumber ? ` · Room ${s.roomNumber}${s.bedLabel ? `-${s.bedLabel}` : ''}` : ' · no bed'} · ${s.phone}`}
              right={s.balance > 0 ? <Badge label={inr(s.balance)} tone="bad" /> : undefined}
              onPress={() => router.push(`/manager/students/${s.id}`)} />
          ))}
        </Card>
      )}
    </Screen>
  );
}
