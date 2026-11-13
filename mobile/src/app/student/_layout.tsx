import { Stack } from 'expo-router';
import { color } from '@/components/theme';

export default function StudentLayout() {
  return (
    <Stack screenOptions={{
      headerStyle: { backgroundColor: color.bg }, headerTintColor: color.ink, headerShadowVisible: false,
      contentStyle: { backgroundColor: color.bg }, headerBackButtonDisplayMode: 'minimal',
    }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="complaints/new" options={{ title: 'New complaint', presentation: 'modal' }} />
      <Stack.Screen name="complaints/[id]" options={{ title: 'Complaint' }} />
      <Stack.Screen name="leave/new" options={{ title: 'Apply for leave', presentation: 'modal' }} />
      <Stack.Screen name="visitors/new" options={{ title: 'Register a visitor', presentation: 'modal' }} />
      <Stack.Screen name="profile" options={{ title: 'My profile' }} />
      <Stack.Screen name="documents" options={{ title: 'Documents' }} />
      <Stack.Screen name="feedback" options={{ title: 'Feedback' }} />
      <Stack.Screen name="emergency" options={{ title: 'Emergency' }} />
    </Stack>
  );
}
