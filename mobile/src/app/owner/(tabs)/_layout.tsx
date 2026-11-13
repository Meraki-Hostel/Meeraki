import { RoleTabs } from '@/components/RoleTabs';

export default function OwnerTabs() {
  return (
    <RoleTabs tabs={[
      { name: 'dashboard', title: 'Dashboard', icon: 'stats-chart-outline' },
      { name: 'finance', title: 'Finance', icon: 'wallet-outline' },
      { name: 'complaints', title: 'Complaints', icon: 'chatbubbles-outline' },
      { name: 'properties', title: 'Properties', icon: 'business-outline' },
      { name: 'me', title: 'Me', icon: 'person-circle-outline' },
    ]} />
  );
}
