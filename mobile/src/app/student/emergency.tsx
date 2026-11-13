import { useState } from 'react';
import { Alert, Linking, View } from 'react-native';
import { emergency, students } from '@/api/services';
import { Badge, Body, Button, Card, Chips, Field, Notice, Screen, Section, Strong } from '@/components/ui';
import { space } from '@/components/theme';
import type { EmergencyType } from '@/contract/interfaces';
import { useAction, useApi } from '@/hooks/api';
import { ago } from '@/lib/format';
import { EMERGENCY_TYPES } from '@/lib/labels';

export default function StudentEmergency() {
  const me = useApi(['students', 'me'], students.me);
  const alerts = useApi(['emergency'], () => emergency.list());
  const raise = useAction(emergency.raise);
  const [type, setType] = useState<EmergencyType>('medical');
  const [message, setMessage] = useState('');
  const [location, setLocation] = useState('');

  const room = me.data?.student.roomNumber ? `Room ${me.data.student.roomNumber}` : '';

  function confirm() {
    if (!message.trim()) { raise.setFieldErrors({ message: 'Say what is happening' }); return; }
    Alert.alert('Send emergency alert?', 'The warden and hostel staff are alerted right away.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Send alert', style: 'destructive', onPress: () => { void raise.run({ type, message: message.trim(), location: location.trim() || room || undefined }); } },
    ]);
  }

  const open = (alerts.data ?? []).filter((a) => a.status !== 'resolved');

  return (
    <Screen onRefresh={alerts.refetch} refreshing={alerts.refreshing}>
      <Card>
        <Strong>In danger right now?</Strong>
        <Body>Call the national emergency number first. Then alert your hostel.</Body>
        <Button title="Call 112" icon="call" variant="danger" onPress={() => { void Linking.openURL('tel:112'); }} style={{ marginTop: space.sm }} />
      </Card>

      {raise.done && <Notice message="Alert sent. Staff have been notified." tone="good" />}
      <Notice error={raise.error} />
      <Chips<EmergencyType> label="What kind?" value={type} onChange={setType} options={EMERGENCY_TYPES} />
      <Field label="What is happening?" value={message} onChangeText={setMessage} error={raise.fieldErrors.message} multiline maxLength={500} />
      <Field label="Where?" value={location} onChangeText={setLocation} error={raise.fieldErrors.location} placeholder={room || 'e.g. 2nd floor corridor'} maxLength={120} />
      <Button title="Alert hostel staff" icon="warning" variant="danger" onPress={confirm} loading={raise.busy} />

      {open.length > 0 && (
        <Section title="Your open alerts">
          {open.map((a) => (
            <Card key={a.id}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Strong>{a.type}</Strong>
                <Badge label={a.status} />
              </View>
              <Body>{a.message}</Body>
              <Body muted>{ago(a.createdAt)}{a.acknowledgedBy ? ` · seen by ${a.acknowledgedBy}` : ''}</Body>
            </Card>
          ))}
        </Section>
      )}
    </Screen>
  );
}
