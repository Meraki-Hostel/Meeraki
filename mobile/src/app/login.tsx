import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { toApiError } from '@/api/errors';
import { useSession } from '@/auth/session';
import { Body, Button, Chips, Field, Notice, Title } from '@/components/ui';
import { color, space } from '@/components/theme';
import type { Role } from '@/contract/domain';

const WEB_URL = (process.env.EXPO_PUBLIC_WEB_URL ?? '').replace(/\/+$/, '');

export default function Login() {
  const { signIn } = useSession();
  const [role, setRole] = useState<Role>('student');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function submit() {
    const fe: Record<string, string> = {};
    if (!identifier.trim()) fe.identifier = 'Enter your email or phone number';
    if (!password) fe.password = 'Enter your password';
    setFieldErrors(fe);
    setError(null);
    if (Object.keys(fe).length) return;
    setBusy(true);
    try {
      await signIn({ role, identifier: identifier.trim(), password });
    } catch (e) {
      const err = toApiError(e);
      setFieldErrors(err.fieldErrors);
      setError(Object.keys(err.fieldErrors).length ? null : err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: space.xl, flexGrow: 1, justifyContent: 'center' }} keyboardShouldPersistTaps="handled">
          <Text style={{ fontSize: 30, fontWeight: '800', color: color.primary, marginBottom: space.sm }}>StayPookie</Text>
          <Title>Sign in</Title>
          <Body muted>Use the email or phone number your hostel registered.</Body>
          <View style={{ height: space.lg }} />
          <Chips<Role>
            label="I am a"
            value={role}
            onChange={setRole}
            options={[{ value: 'student', label: 'Resident' }, { value: 'manager', label: 'Manager / Warden' }, { value: 'owner', label: 'Owner' }]}
          />
          <Notice error={error} />
          <Field
            label="Email or phone" value={identifier} onChangeText={setIdentifier} error={fieldErrors.identifier}
            autoCapitalize="none" autoCorrect={false} keyboardType="email-address" textContentType="username" autoComplete="username"
          />
          <Field
            label="Password" value={password} onChangeText={setPassword} error={fieldErrors.password}
            secureTextEntry textContentType="password" autoComplete="password" onSubmitEditing={submit} returnKeyType="go"
          />
          <Button title="Sign in" onPress={submit} loading={busy} />
          {WEB_URL ? (
            <Button
              title="Forgot password?" variant="ghost" style={{ marginTop: space.sm }}
              onPress={() => { void WebBrowser.openBrowserAsync(`${WEB_URL}/forgot-password`); }}
            />
          ) : null}
          {WEB_URL ? (
            <Button
              title="Privacy policy" variant="ghost"
              onPress={() => { void WebBrowser.openBrowserAsync(`${WEB_URL}/privacy`); }}
            />
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
