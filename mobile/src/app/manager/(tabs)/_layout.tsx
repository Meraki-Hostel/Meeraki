import { analytics } from '@/api/services';
import { RoleTabs } from '@/components/RoleTabs';
import { useApi } from '@/hooks/api';

export default function ManagerTabs() {
  const o = useApi(['analytics', 'manager'], analytics.managerOverview);
  const pending = (o.data?.pendingLeaves ?? 0) + (o.data?.openComplaints ?? 0);
  return (
    <RoleTabs tabs={[
      { name: 'today', title: 'Today', icon: 'today-outline' },
      { name: 'requests', title: 'Requests', icon: 'chatbubbles-outline', badge: pending },
      { name: 'payments', title: 'Payments', icon: 'wallet-outline', badge: o.data?.collection.overdueCount },
      { name: 'operations', title: 'Operations', icon: 'construct-outline' },
      { name: 'me', title: 'Me', icon: 'person-circle-outline' },
    ]} />
  );
}
