import { http, tokens } from './client';
import type {
  IAuthService, IPaymentService, SessionInfo, PasswordLoginInput,
  ChargeView, PaymentView, CollectionSummary, RecordPaymentInput, ChargeFilters, PaymentFilters,
} from '../interfaces';
import type { ID, Invitation, Payment, PendingOnlinePayment, Receipt, User, UserPreferences } from '@/types/domain';

type LoginResponse = SessionInfo & { accessToken: string; refreshToken: string };
function storeAndStrip(r: LoginResponse): SessionInfo {
  tokens.set({ accessToken: r.accessToken, refreshToken: r.refreshToken });
  return { session: r.session, user: r.user };
}

export const httpAuthService: IAuthService = {
  async getSession() {
    if (!tokens.access && !tokens.refresh) return null;
    try { return await http.get<SessionInfo>('/auth/session'); }
    catch { return null; }
  },
  async loginWithPassword(input: PasswordLoginInput) {
    return storeAndStrip(await http.post<LoginResponse>('/auth/login', input, false));
  },
  async logout() {
    try { await http.post('/auth/logout', { refreshToken: tokens.refresh }); } finally { tokens.clear(); }
  },
  requestPasswordReset: (identifier) => http.post<{ maskedDestination: string }>('/auth/forgot-password', { identifier }, false),
  resetPassword: async (token, password) => { await http.post('/auth/reset-password', { token, password }, false); },
  getInvitation: (token) => http.get<Invitation>(`/auth/invitations/${token}`, undefined, false),
  acceptInvitation: async (token, password) => { await http.post('/auth/invitations/accept', { token, password }, false); },
  updateProfile: (patch: { name?: string; phone?: string; preferences?: Partial<UserPreferences> }) =>
    http.patch<User>('/auth/profile', patch),
};

export const httpPaymentService: IPaymentService = {
  listCharges: (filters: ChargeFilters = {}) => http.get<ChargeView[]>('/charges', filters),
  listPayments: (filters: PaymentFilters = {}) => http.get<PaymentView[]>('/payments', filters),
  summary: (filters = {}) => http.get<CollectionSummary>('/payments/summary', filters),
  recordPayment: (input: RecordPaymentInput) => http.post<Payment>('/payments/record', input),
  getReceipt: (paymentId: ID) => http.get<Receipt>(`/payments/${paymentId}/receipt`),
  sendReminders: async (chargeIds: ID[]) => {
    const r = await http.post<number>('/payments/reminders', { chargeIds });
    return r as unknown as number;
  },
  // PAYMENT_MODE=disabled → throws NOT_CONFIGURED. simulated (dev only) → a Payment with
  // status 'simulated'. razorpay → PendingOnlinePayment: nothing is paid until the signed
  // webhook confirms; Razorpay Checkout is not wired into this app yet.
  payNow: (chargeId: ID, method: 'upi' | 'card' | 'netbanking') =>
    http.post<Payment | PendingOnlinePayment>('/payments/pay-now', { chargeId, method }),
};
