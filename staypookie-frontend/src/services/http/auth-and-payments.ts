import { http, tokens } from './client';
import type {
  IAuthService, IPaymentService, SessionInfo, PasswordLoginInput,
  ChargeView, PaymentView, CollectionSummary, RecordPaymentInput, ChargeFilters, PaymentFilters,
  ChargeInput, ChargeAdjustment, OnlinePaymentResult, Refund, RefundInput,
} from '../interfaces';
import type { ID, Invitation, Payment, PendingOnlinePayment, Receipt, RentCharge, User, UserPreferences } from '@/types/domain';

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
  async changePassword(currentPassword, newPassword) {
    // Every other session ends; the API hands this device a fresh one.
    storeAndStrip(await http.post<LoginResponse>('/auth/change-password', { currentPassword, newPassword }));
  },
  async logoutAll() {
    try { await http.post('/auth/logout-all'); } finally { tokens.clear(); }
  },
  updateProfile: (patch: { name?: string; phone?: string; preferences?: Partial<UserPreferences> }) =>
    http.patch<User>('/auth/profile', patch),
};

export const httpPaymentService: IPaymentService = {
  listCharges: (filters: ChargeFilters = {}) => http.get<ChargeView[]>('/charges', filters),
  listPayments: (filters: PaymentFilters = {}) => http.get<PaymentView[]>('/payments', filters),
  summary: (filters = {}) => http.get<CollectionSummary>('/payments/summary', filters),
  recordPayment: (input: RecordPaymentInput) => http.post<Payment>('/payments/record', input),
  getReceipt: (paymentId: ID) => http.get<Receipt>(`/payments/${paymentId}/receipt`),
    sendReminders: (chargeIds: ID[]) => http.post<number>('/payments/reminders', { chargeIds }),
  // PAYMENT_MODE=disabled → throws NOT_CONFIGURED. simulated (dev only) → a Payment with
  // status 'simulated'. razorpay → PendingOnlinePayment: the app opens Razorpay Checkout,
  // then verifyOnlinePayment lets the API confirm the payment with Razorpay.
  payNow: (chargeId: ID, method: 'upi' | 'card' | 'netbanking') =>
    http.post<Payment | PendingOnlinePayment>('/payments/pay-now', { chargeId, method }),
  verifyOnlinePayment: (input) => http.post<OnlinePaymentResult>('/payments/verify', input),
  receiptPdf: (paymentId: ID) => http.blob(`/payments/${paymentId}/receipt.pdf`),
  generateCharges: (input = {}) => http.post<{ created: number }>('/charges/generate', input),
  createCharge: (input: ChargeInput) => http.post<RentCharge>('/charges', input),
  adjustCharge: (id: ID, input: ChargeAdjustment) => http.patch<RentCharge>(`/charges/${id}`, input),
  refund: (paymentId: ID, input: RefundInput) => http.post<Refund>(`/payments/${paymentId}/refund`, input),
  listRefunds: (filters = {}) => http.get<Refund[]>('/refunds', filters),
};
