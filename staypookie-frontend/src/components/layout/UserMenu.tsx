import { useNavigate } from 'react-router-dom';
import { Bell, ChevronDown, LifeBuoy, LogOut, UserRound } from 'lucide-react';
import { useSession } from '@/app/providers/SessionProvider';
import { Avatar } from '@/components/ui/Avatar';
import { Dropdown, type MenuEntry } from '@/components/ui/Dropdown';

export function UserMenu() {
  const { user, logout } = useSession();
  const navigate = useNavigate();
  if (!user) return null;

  const items: MenuEntry[] = [
    { label: 'My profile', icon: <UserRound className="size-4" />, onSelect: () => navigate('/profile') },
    { label: 'Notifications', icon: <Bell className="size-4" />, onSelect: () => navigate('/notifications') },
    { label: 'Help & support', icon: <LifeBuoy className="size-4" />, onSelect: () => navigate('/help') },
    'separator',
    { label: 'Log out', icon: <LogOut className="size-4" />, danger: true, onSelect: () => { void logout().then(() => navigate('/login')); } },
  ];

  return (
    <Dropdown label="Account menu" items={items}
      trigger={({ open, toggle, id }) => (
        <button type="button" onClick={toggle} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined}
          className="flex items-center gap-2.5 rounded-2xl py-1 pl-1 pr-2 hover:bg-sand/70">
          <Avatar name={user.name} />
          <span className="hidden text-left leading-tight md:block">
            <span className="block text-sm font-semibold text-espresso">{user.name}</span>
            <span className="block max-w-44 truncate text-xs text-dust">{user.role === 'owner' ? user.title : user.role === 'manager' ? 'Manager' : 'Student'}</span>
          </span>
          <ChevronDown className="size-4 text-dust" aria-hidden />
        </button>
      )} />
  );
}
