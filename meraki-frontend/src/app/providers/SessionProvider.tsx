import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { services, subscribeToData } from '@/services';
import type { SessionInfo } from '@/services';
import type { PasswordLoginInput } from '@/services/interfaces';
import type { Role, User } from '@/types/domain';

interface SessionApi {
  ready: boolean;
  user: User | null;
  role: Role | null;
  info: SessionInfo | null;
  loginWithPassword: (i: PasswordLoginInput) => Promise<SessionInfo>;
  loginAsPersona: (userId: string) => Promise<SessionInfo>;
  logout: () => Promise<void>;
}

const Ctx = createContext<SessionApi | null>(null);
export const roleHome = (role: Role) => (role === 'owner' ? '/owner/dashboard' : role === 'manager' ? '/manager/dashboard' : '/student/home');

export function SessionProvider({ children }: { children: ReactNode }) {
  const [info, setInfo] = useState<SessionInfo | null>(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    const s = await services.auth.getSession();
    setInfo(s);
    setReady(true);
  }, []);

  useEffect(() => {
    void refresh();
    return subscribeToData(() => { void refresh(); });
  }, [refresh]);

  const api = useMemo<SessionApi>(() => ({
    ready, info, user: info?.user ?? null, role: info?.user.role ?? null,
    loginWithPassword: async (i) => { const s = await services.auth.loginWithPassword(i); setInfo(s); return s; },
    loginAsPersona: async (id) => { const s = await services.auth.loginAsPersona(id); setInfo(s); return s; },
    logout: async () => { await services.auth.logout(); setInfo(null); },
  }), [ready, info]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useSession(): SessionApi {
  const c = useContext(Ctx);
  if (!c) throw new Error('useSession must be used within SessionProvider');
  return c;
}
/** For pages inside guarded routes, where a user always exists. */
export function useCurrentUser(): User {
  const { user } = useSession();
  if (!user) throw new Error('No active session');
  return user;
}
