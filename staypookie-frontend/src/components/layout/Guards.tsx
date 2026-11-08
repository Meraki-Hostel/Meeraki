import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { roleHome, useSession } from '@/app/providers/SessionProvider';
import type { Role } from '@/types/domain';
import { BrandMark } from '@/components/brand/BrandLogo';

export function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center bg-ivory" role="status" aria-label="Loading StayPookie">
      <div className="flex flex-col items-center gap-3">
        <BrandMark className="h-10 animate-pulse" />
        <p className="text-sm text-dust">Opening StayPookie…</p>
      </div>
    </div>
  );
}

/** Frontend-only guard — demonstration, not security. Backend must enforce authorization. */
export function RequireAuth({ roles, children }: { roles?: Role[]; children?: ReactNode }) {
  const { ready, user } = useSession();
  const location = useLocation();
  if (!ready) return <Splash />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/unauthorized" replace state={{ attempted: location.pathname }} />;
  return children ? <>{children}</> : <Outlet />;
}

export function RedirectIfAuthed({ children }: { children: ReactNode }) {
  const { ready, user } = useSession();
  if (!ready) return <Splash />;
  if (user) return <Navigate to={roleHome(user.role)} replace />;
  return <>{children}</>;
}

export function RootRedirect() {
  const { ready, user } = useSession();
  if (!ready) return <Splash />;
  return <Navigate to={user ? roleHome(user.role) : '/login'} replace />;
}
