import { ApiError } from '@/api/errors';
import { payments } from '@/api/services';
import type { Payment, PendingOnlinePayment, User } from '@/contract/domain';
import type { OnlinePaymentResult } from '@/contract/interfaces';

// Server-authoritative online rent payment (BACKEND_HANDOFF.md, Payments).
// The app never decides that a payment went through: the API confirms it with
// Razorpay (/payments/verify) and the webhook confirms it again.

interface CheckoutSuccess { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }
interface CheckoutModule { open(options: Record<string, unknown>): Promise<CheckoutSuccess> }

function checkout(): CheckoutModule | null {
  try {
    // Native module: present in dev/store builds, absent in Expo Go.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-razorpay') as { default?: CheckoutModule } & CheckoutModule;
    return mod.default ?? mod;
  } catch {
    return null;
  }
}

export type PayOutcome =
  | { kind: 'paid'; payment?: Payment }
  | { kind: 'processing' }
  | { kind: 'cancelled' }
  | { kind: 'failed'; message: string };

const isPending = (r: Payment | PendingOnlinePayment): r is PendingOnlinePayment => (r as PendingOnlinePayment).pending === true;

export async function payCharge(chargeId: string, method: 'upi' | 'card' | 'netbanking', user: User, description: string): Promise<PayOutcome> {
  const started = await payments.payNow(chargeId, method); // NOT_CONFIGURED when online payment is off
  // Simulated mode (development only): the API records it straight away.
  if (!isPending(started)) return { kind: 'paid', payment: started };

  const rzp = checkout();
  if (!rzp) throw new ApiError('NOT_CONFIGURED', 'Online payment needs the installed StayPookie app (it does not work in Expo Go).');

  let result: CheckoutSuccess;
  try {
    result = await rzp.open({
      key: started.keyId,
      order_id: started.order.id,
      amount: started.order.amount,
      currency: started.order.currency,
      name: 'StayPookie',
      description,
      prefill: { name: user.name, email: user.email, contact: user.phone, method },
      theme: { color: '#8c5850' },
    });
  } catch (e) {
    // Closing Checkout is a cancel, not a failure (PAYMENT_CANCELLED = 2; 0 is a network error).
    const err = e as { code?: number; description?: string; error?: { description?: string } };
    if (err?.code === 2) return { kind: 'cancelled' };
    return { kind: 'failed', message: err?.error?.description ?? err?.description ?? 'The payment did not go through.' };
  }

  let verified: OnlinePaymentResult;
  try {
    verified = await payments.verifyOnlinePayment({
      orderId: result.razorpay_order_id, paymentId: result.razorpay_payment_id, signature: result.razorpay_signature,
    });
  } catch {
    // The webhook still confirms it; tell the user it is being confirmed.
    return { kind: 'processing' };
  }
  if (verified.status === 'paid') return { kind: 'paid', payment: verified.payment };
  if (verified.status === 'processing') return { kind: 'processing' };
  return { kind: 'failed', message: 'The payment did not go through. No money was taken, or it will be refunded by your bank.' };
}
