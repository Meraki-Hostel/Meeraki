import { useRouter } from 'expo-router';
import { useState } from 'react';
import { auth } from '@/api/services';
import { Body, Button, Field, Notice, Screen } from '@/components/ui';
import { useAction } from '@/hooks/api';

export default function ChangePassword() {
  const router = useRouter();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const change = useAction(auth.changePassword);

  async function submit() {
    if (next !== confirm) { change.setFieldErrors({ confirm: "The passwords don't match" }); return; }
    if (await change.run(current, next)) router.back();
  }

  return (
    <Screen>
      <Body muted>Changing your password signs you out on every other device. This phone stays signed in.</Body>
      <Notice error={change.error} />
      <Field label="Current password" secureTextEntry value={current} onChangeText={setCurrent} error={change.fieldErrors.currentPassword} autoComplete="current-password" />
      <Field label="New password" secureTextEntry value={next} onChangeText={setNext} error={change.fieldErrors.newPassword ?? change.fieldErrors.password} autoComplete="new-password" hint="At least 8 characters" />
      <Field label="Confirm new password" secureTextEntry value={confirm} onChangeText={setConfirm} error={change.fieldErrors.confirm} autoComplete="new-password" />
      <Button title="Change password" onPress={() => { void submit(); }} loading={change.busy} />
    </Screen>
  );
}
