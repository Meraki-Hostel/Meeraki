import { Stack } from 'expo-router';
import { color } from '@/components/theme';

export default function ManagerLayout() {
  return (
    <Stack screenOptions={{
      headerStyle: { backgroundColor: color.bg }, headerTintColor: color.ink, headerShadowVisible: false,
      contentStyle: { backgroundColor: color.bg }, headerBackButtonDisplayMode: 'minimal',
    }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="complaints/[id]" options={{ title: 'Complaint' }} />
      <Stack.Screen name="record-payment" options={{ title: 'Record payment', presentation: 'modal' }} />
      <Stack.Screen name="visitors/walk-in" options={{ title: 'Walk-in visitor', presentation: 'modal' }} />
      <Stack.Screen name="students/index" options={{ title: 'Residents' }} />
      <Stack.Screen name="students/[id]" options={{ title: 'Resident' }} />
      <Stack.Screen name="rooms" options={{ title: 'Rooms & beds' }} />
      <Stack.Screen name="maintenance" options={{ title: 'Maintenance' }} />
      <Stack.Screen name="inventory" options={{ title: 'Inventory' }} />
      <Stack.Screen name="announcements/index" options={{ title: 'Announcements' }} />
      <Stack.Screen name="announcements/new" options={{ title: 'New announcement', presentation: 'modal' }} />
      <Stack.Screen name="emergency" options={{ title: 'Emergency alerts' }} />
    </Stack>
  );
}
