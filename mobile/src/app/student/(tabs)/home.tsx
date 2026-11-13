import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { announcements, students } from '@/api/services';
import { useUser } from '@/auth/session';
import { Badge, Body, Button, Card, ErrorState, Loading, Row, Screen, Section, Stat, StatGrid, Strong } from '@/components/ui';
import { color, space } from '@/components/theme';
import { useApi } from '@/hooks/api';
import { date, inr } from '@/lib/format';

export default function StudentHome() {
  const router = useRouter();
  const user = useUser();
  const me = useApi(['students', 'me'], students.me);
  const notices = useApi(['announcements', 'published'], () => announcements.list({ status: 'published' }));

  if (me.loading) return <Loading />;
  if (me.error || !me.data) return <Screen><ErrorState error={me.error} onRetry={me.refetch} /></Screen>;

  const { student, charges } = me.data;
  const due = charges.filter((c) => c.balance > 0);
  const totalDue = due.reduce((sum, c) => sum + c.balance, 0);
  const overdue = due.some((c) => c.status === 'overdue');
  const nextDue = [...due].sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
  const latest = (notices.data ?? []).slice(0, 3);

  return (
    <Screen onRefresh={() => { me.refetch(); notices.refetch(); }} refreshing={me.refreshing}>
      <Body muted>Hello,</Body>
      <Strong>{user.name.split(' ')[0]}</Strong>

      <Card style={{ marginTop: space.md }}>
        <Body muted>{student.propertyName}</Body>
        <Strong>{student.roomNumber ? `Room ${student.roomNumber}${student.bedLabel ? ` · Bed ${student.bedLabel}` : ''}` : 'No bed assigned yet'}</Strong>
        <View style={{ marginTop: space.sm }}><Badge label={student.status} /></View>
      </Card>

      <StatGrid>
        <Stat label={overdue ? 'Overdue' : 'Due'} value={inr(totalDue)} tone={overdue ? 'bad' : totalDue ? 'warn' : 'good'} />
        <Stat label="Next due date" value={nextDue ? date(nextDue.dueDate) : 'Nothing due'} />
      </StatGrid>
      {totalDue > 0 && <Button title={`Pay ${inr(totalDue)}`} icon="card-outline" onPress={() => router.push('/student/rent')} style={{ marginTop: space.md }} />}

      {/* Emergency is one tap from home, never buried in a menu. */}
      <Button title="Emergency" icon="warning-outline" variant="danger" onPress={() => router.push('/student/emergency')} style={{ marginTop: space.md }} />

      <Section title="Quick actions">
        <Card>
          <Row title="Raise a complaint" icon="construct-outline" onPress={() => router.push('/student/complaints/new')} />
          <Row title="Apply for leave" icon="airplane-outline" onPress={() => router.push('/student/leave/new')} />
          <Row title="Register a visitor" icon="people-outline" onPress={() => router.push('/student/visitors/new')} />
        </Card>
      </Section>

      <Section title="Latest notices">
        {notices.error ? <ErrorState error={notices.error} onRetry={notices.refetch} /> : latest.length === 0 ? (
          <Body muted>No notices right now.</Body>
        ) : (
          <Card>
            {latest.map((a) => (
              <Row key={a.id} title={a.title} subtitle={a.body} onPress={() => router.push('/student/notices')}
                right={a.isRead === false ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color.primary }} /> : undefined} />
            ))}
          </Card>
        )}
      </Section>
    </Screen>
  );
}
