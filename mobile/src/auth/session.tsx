import { useQueryClient } from '@tanstack/react-query';
import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { refreshSession, setSessionEndedHandler } from '@/api/client';
import { ApiError } from '@/api/errors';
import { auth } from '@/api/services';
import { tokens } from '@/api/tokens';
import type { Role, User } from '@/contract/domain';
import { registerForPush, unregisterPush } from '@/push/register';

type Status = 'loading' | 'signedOut' | 'signedIn';
interface SessionContext {
  status: Status;
  user: User | null;
  /** Set when the stored session could not be checked because the phone is offline. */
  offline: boolean;
  signIn(input: { role: Role; identifier: string; password: string }): Promise<void>;
  signOut(options?: { everywhere?: boolean }): Promise<void>;
  setUser(u: User): void;
  retry(): void;
}

const Ctx = createContext<SessionContext | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [offline, setOffline] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const endLocally = useCallback(async () => {
    await tokens.clear();
    qc.clear();
    setUser(null);
    setStatus('signedOut');
  }, [qc]);

  // Cold start: a stored refresh token → fresh access token → who am I.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!(await tokens.refreshToken())) { if (!cancelled) setStatus('signedOut'); return; }
        if (!(await refreshSession())) { if (!cancelled) setStatus('signedOut'); return; }
        const info = await auth.session();
        if (cancelled) return;
        setUser(info.user);
        setOffline(false);
        setStatus('signedIn');
        void registerForPush();
      } catch (e) {
        if (cancelled) return;
        if (e instanceof ApiError && e.code === 'UNAVAILABLE') { setOffline(true); setStatus('loading'); return; }
        await endLocally();
      }
    })();
    return () => { cancelled = true; };
  }, [attempt, endLocally]);

  // Any request whose session can no longer be refreshed sends the user to sign-in.
  useEffect(() => { setSessionEndedHandler(() => { void endLocally(); }); }, [endLocally]);

  const value = useMemo<SessionContext>(() => ({
    status, user, offline,
    async signIn(input) {
      const info = await auth.login(input);
      qc.clear();
      setUser(info.user);
      setStatus('signedIn');
      void registerForPush();
    },
    async signOut({ everywhere = false } = {}) {
      await unregisterPush(); // while the token is still valid
      try { await (everywhere ? auth.logoutAll() : auth.logout()); } catch { /* signing out locally anyway */ }
      await endLocally();
    },
    setUser,
    retry: () => { setOffline(false); setAttempt((n) => n + 1); },
  }), [status, user, offline, qc, endLocally]);

  return <Ctx value={value}>{children}</Ctx>;
}

export function useSession(): SessionContext {
  const v = use(Ctx);
  if (!v) throw new Error('useSession outside SessionProvider');
  return v;
}

/** The signed-in user; only for screens behind the role guards. */
export function useUser(): User {
  const { user } = useSession();
  if (!user) throw new Error('useUser without a signed-in user');
  return user;
}
