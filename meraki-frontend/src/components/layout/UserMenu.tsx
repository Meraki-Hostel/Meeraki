import { useNavigate } from 'react-router-dom';
import { Bell, ChevronDown, LifeBuoy, LogOut, RotateCcw, UserRound, Users } from 'lucide-react';
import { services } from '@/services';
import { useQuery } from '@/hooks/useQuery';
import { roleHome, useSession } from '@/app/providers/SessionProvider';
import { useConfirm } from '@/app/providers/ConfirmProvider';
import { useToast } from '@/app/providers/ToastProvider';
import { Avatar } from '@/components/ui/Avatar';
import { Dropdown, type MenuEntry } from '@/components/ui/Dropdown';
import { errorMessage } from '@/services/errors';

export function UserMenu() {
  const { user, loginAsPersona, logout } = useSession();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const toast = useToast();
  const personas = useQuery(() => services.auth.listPersonas(), []);
  if (!user) return null;

  const switchTo = async (id: string) => {
    try {
      const s = await loginAsPersona(id);
      navigate(roleHome(s.user.role));
      toast.info(`Now viewing as ${s.user.name}.`, 'Persona switched');
    } catch (e) { toast.error(errorMessage(e)); }
  };
  const reset = async () => {
    const ok = await confirm({ title: 'Reset demo data?', message: 'All changes made in this browser — new students, payments, complaints, settings — will be replaced with the original demo data. You will stay signed in.', confirmLabel: 'Reset demo data', tone: 'danger' });
    if (!ok) return;
    await services.settings.resetDemoData();
    toast.success('Demo data restored to its original state.');
  };

  const items: MenuEntry[] = [
    { label: 'My profile', icon: <UserRound className="size-4" />, onSelect: () => navigate('/profile') },
    { label: 'Notifications', icon: <Bell className="size-4" />, onSelect: () => navigate('/notifications') },
    { label: 'Help & support', icon: <LifeBuoy className="size-4" />, onSelect: () => navigate('/help') },
    'separator',
    { heading: 'Switch demo persona' },
    ...(personas.data ?? []).filter((p) => p.user.id !== user.id).map<MenuEntry>((p) => ({
      label: `${p.user.name} — ${p.user.role === 'owner' ? 'Owner' : p.user.role === 'manager' ? 'Manager' : 'Student'}`,
      icon: <Users className="size-4" />, hint: p.subtitle, onSelect: () => void switchTo(p.user.id),
    })),
    'separator',
    { label: 'Reset demo data', icon: <RotateCcw className="size-4" />, onSelect: () => void reset() },
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
