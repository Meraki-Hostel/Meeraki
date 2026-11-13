import { announcements } from '@/api/services';
import { RoleTabs } from '@/components/RoleTabs';
import { useApi } from '@/hooks/api';

export default function StudentTabs() {
  const notices = useApi(['announcements', 'published'], () => announcements.list({ status: 'published' }));
  const unread = (notices.data ?? []).filter((a) => a.isRead === false).length;
  return (
    <RoleTabs tabs={[
      { name: 'home', title: 'Home', icon: 'home-outline' },
      { name: 'rent', title: 'Rent', icon: 'wallet-outline' },
      { name: 'requests', title: 'Requests', icon: 'chatbubbles-outline' },
      { name: 'notices', title: 'Notices', icon: 'megaphone-outline', badge: unread },
      { name: 'me', title: 'Me', icon: 'person-circle-outline' },
    ]} />
  );
}
