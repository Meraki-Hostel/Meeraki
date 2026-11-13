import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { IconName } from './ui';
import { color } from './theme';

export interface TabDef { name: string; title: string; icon: IconName; badge?: number }

/** Bottom tabs for one role. Each tab has its own header. */
export function RoleTabs({ tabs }: { tabs: TabDef[] }) {
  return (
    <Tabs screenOptions={{
      tabBarActiveTintColor: color.primary,
      tabBarInactiveTintColor: color.dust,
      tabBarStyle: { backgroundColor: color.card, borderTopColor: color.line },
      headerStyle: { backgroundColor: color.bg },
      headerTintColor: color.ink,
      headerShadowVisible: false,
      sceneStyle: { backgroundColor: color.bg },
    }}>
      {tabs.map((t) => (
        <Tabs.Screen key={t.name} name={t.name} options={{
          title: t.title,
          tabBarBadge: t.badge ? t.badge : undefined,
          tabBarIcon: ({ color: c, size }) => <Ionicons name={t.icon} size={size} color={String(c)} />,
        }} />
      ))}
    </Tabs>
  );
}
