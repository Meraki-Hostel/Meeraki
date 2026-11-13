import { Stack } from 'expo-router';
import { color } from '@/components/theme';

export default function OwnerLayout() {
  return (
    <Stack screenOptions={{
      headerStyle: { backgroundColor: color.bg }, headerTintColor: color.ink, headerShadowVisible: false,
      contentStyle: { backgroundColor: color.bg }, headerBackButtonDisplayMode: 'minimal',
    }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="complaints/[id]" options={{ title: 'Complaint' }} />
      <Stack.Screen name="properties/[id]" options={{ title: 'Property' }} />
      <Stack.Screen name="staff" options={{ title: 'Staff' }} />
      <Stack.Screen name="events" options={{ title: 'Events' }} />
    </Stack>
  );
}
