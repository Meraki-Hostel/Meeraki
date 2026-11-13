import { useState } from 'react';
import { View } from 'react-native';
import { Button, Field } from './ui';
import { space } from './theme';

/**
 * Approve / reject with an optional reason, inline in a card (Alert.prompt is
 * iOS-only, so the reason field opens in place).
 */
export function Decision({ onDecide, busy, approveLabel = 'Approve', rejectLabel = 'Reject' }: {
  onDecide: (decision: 'approved' | 'rejected', reason?: string) => void;
  busy?: boolean; approveLabel?: string; rejectLabel?: string;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  if (rejecting) {
    return (
      <View style={{ marginTop: space.sm }}>
        <Field label="Reason (shown to the resident)" value={reason} onChangeText={setReason} maxLength={500} autoFocus />
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Button title="Back" variant="secondary" onPress={() => { setRejecting(false); setReason(''); }} style={{ flex: 1 }} />
          <Button title={rejectLabel} variant="danger" loading={busy} onPress={() => onDecide('rejected', reason.trim() || undefined)} style={{ flex: 1 }} />
        </View>
      </View>
    );
  }
  return (
    <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.sm }}>
      <Button title={rejectLabel} variant="secondary" icon="close" onPress={() => setRejecting(true)} disabled={busy} style={{ flex: 1 }} />
      <Button title={approveLabel} icon="checkmark" loading={busy} onPress={() => onDecide('approved')} style={{ flex: 1 }} />
    </View>
  );
}
