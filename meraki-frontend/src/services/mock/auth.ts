import type { IAuthService, PersonaSummary, SessionInfo } from '../interfaces';
import { ServiceError, invalid, notFound } from '../errors';
import { clone, ctx, db, delay, mutate, propertyName } from './base';
import { isEmail, isIndianPhone, normalizePhone } from '@/lib/validation';
import { nowISO } from '@/lib/clock';

/** Demo-only shared password. NOT real authentication — documented in README. */
export const DEMO_PASSWORD = 'meraki@123';

function sessionInfo(): SessionInfo | null {
  const s = db();
  if (!s.session) return null;
  const user = s.users.find((u) => u.id === s.session!.userId);
  return user ? { session: clone(s.session), user: clone(user) } : null;
}

function startSession(userId: string, method: 'demo' | 'password'): SessionInfo {
  const user = db().users.find((u) => u.id === userId);
  if (!user) throw notFound('Demo account');
  mutate((s) => { s.session = { userId, role: user.role, startedAt: nowISO(), method }; });
  return sessionInfo()!;
}

export const mockAuthService: IAuthService = {
  async getSession() {
    await delay(60);
    return sessionInfo();
  },
  async listPersonas() {
    await delay(40);
    const s = db();
    return s.users.map<PersonaSummary>((u) => ({
      user: clone(u),
      subtitle: u.role === 'owner' ? `${u.title} · ${s.properties.length} properties`
        : u.role === 'manager' ? `Manager · ${propertyName(s, u.propertyId)}`
        : `Student · ${propertyName(s, u.propertyId)}`,
    }));
  },
  async loginWithPassword({ role, identifier, password }) {
    await delay(420);
    const id = identifier.trim();
    const errors: Record<string, string> = {};
    if (!id) errors.identifier = 'Enter your email or phone number';
    else if (!isEmail(id) && !isIndianPhone(id)) errors.identifier = 'Enter a valid email or 10-digit mobile number';
    if (!password) errors.password = 'Enter your password';
    if (Object.keys(errors).length) throw invalid(errors);
    const user = db().users.find((u) => (isEmail(id) ? u.email.toLowerCase() === id.toLowerCase() : normalizePhone(u.phone) === normalizePhone(id)));
    if (!user || password !== DEMO_PASSWORD) throw new ServiceError('UNAUTHENTICATED', 'Email/phone or password is incorrect.');
    if (user.role !== role) {
      const label = user.role === 'manager' ? 'Manager' : user.role === 'owner' ? 'Owner' : 'Student';
      throw new ServiceError('FORBIDDEN', `This account is registered as ${label}. Switch to the ${label} tab to continue.`);
    }
    return startSession(user.id, 'password');
  },
  async loginAsPersona(userId) {
    await delay(220);
    return startSession(userId, 'demo');
  },
  async logout() {
    await delay(80);
    mutate((s) => { s.session = null; });
  },
  async requestPasswordReset(identifier) {
    await delay(500);
    const id = identifier.trim();
    if (!id || (!isEmail(id) && !isIndianPhone(id))) throw invalid({ identifier: 'Enter a valid email or 10-digit mobile number' });
    // Same response whether or not the account exists (avoids account enumeration).
    const masked = isEmail(id) ? id.replace(/^(.).*(@.*)$/, '$1•••$2') : `+91 •••••• ${normalizePhone(id).slice(-4)}`;
    return { maskedDestination: masked };
  },
  async resetPassword(token, password) {
    await delay(450);
    if (!token || token === 'expired') throw new ServiceError('EXPIRED', 'This reset link has expired. Request a new one.');
    if (password.length < 8) throw invalid({ password: 'Password must be at least 8 characters' });
  },
  async getInvitation(token) {
    await delay(250);
    const inv = db().invitations.find((i) => i.token === token);
    if (!inv) throw notFound('Invitation');
    if (inv.status === 'expired') throw new ServiceError('EXPIRED', 'This invitation has expired. Ask your hostel admin to send a new one.');
    if (inv.status === 'accepted') throw new ServiceError('CONFLICT', 'This invitation has already been accepted. Sign in instead.');
    return clone(inv);
  },
  async acceptInvitation(token, password) {
    await delay(450);
    if (password.length < 8) throw invalid({ password: 'Password must be at least 8 characters' });
    const inv = db().invitations.find((i) => i.token === token);
    if (!inv || inv.status !== 'pending') throw new ServiceError('EXPIRED', 'This invitation is no longer valid.');
    mutate((s) => {
      const i = s.invitations.find((x) => x.token === token)!;
      i.status = 'accepted';
      const staff = s.staff.find((x) => x.email === i.email);
      if (staff && staff.status === 'invited') staff.status = 'active';
    });
  },
  async updateProfile(patch) {
    await delay();
    const c = ctx();
    const errors: Record<string, string> = {};
    if (patch.name !== undefined && patch.name.trim().length < 2) errors.name = 'Name must be at least 2 characters';
    if (patch.phone !== undefined && !isIndianPhone(patch.phone)) errors.phone = 'Enter a 10-digit Indian mobile number';
    if (Object.keys(errors).length) throw invalid(errors);
    mutate((s) => {
      const u = s.users.find((x) => x.id === c.user.id)!;
      if (patch.name !== undefined) u.name = patch.name.trim();
      if (patch.phone !== undefined) u.phone = normalizePhone(patch.phone);
      if (patch.preferences) u.preferences = { ...u.preferences, ...patch.preferences };
    });
    return clone(db().users.find((x) => x.id === c.user.id)!);
  },
};
