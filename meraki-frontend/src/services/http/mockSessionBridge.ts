import type { IAuthService, SessionInfo } from '../interfaces';
import type { Role } from '@/types/domain';
import { repository } from '../repository';

/**
 * Modules the backend doesn't implement yet (complaints, leave, …) still run on
 * the mock, which reads the acting user from its own local session. When auth
 * goes over HTTP, mirror the real session into the mock as the demo user with
 * the same role, so those modules keep working. Their data is still demo data
 * and is not linked to the real backend records.
 *
 * Remove this once every module is served by the API.
 */
function mirror(info: SessionInfo | null) {
  const current = repository.read().session;
  if (!info) {
    if (current) repository.update((s) => { s.session = null; });
    return;
  }
  const role: Role = info.user.role;
  if (current?.role === role) return; // already mirrored; avoid a change-feed loop
  const demoUser = repository.read().users.find((u) => u.role === role);
  if (!demoUser) return;
  repository.update((s) => { s.session = { ...info.session, userId: demoUser.id, role }; });
}

export function withMockSessionMirror(auth: IAuthService): IAuthService {
  return {
    ...auth,
    async getSession() { const r = await auth.getSession(); mirror(r); return r; },
    async loginWithPassword(input) { const r = await auth.loginWithPassword(input); mirror(r); return r; },
    async loginAsPersona(userId) { const r = await auth.loginAsPersona(userId); mirror(r); return r; },
    async logout() { try { await auth.logout(); } finally { mirror(null); } },
  };
}
