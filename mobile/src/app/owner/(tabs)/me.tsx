import { MeScreen } from '@/features/MeScreen';

export default function OwnerMe() {
  return (
    <MeScreen
      links={[
        { title: 'Staff', icon: 'people-outline', href: '/owner/staff' },
        { title: 'Events', icon: 'calendar-outline', href: '/owner/events' },
      ]}
      webNote="Properties, payout accounts, plans and settings"
    />
  );
}
