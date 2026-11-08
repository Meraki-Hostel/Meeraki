import type { PendingOnlinePayment } from '@/types/domain';

/**
 * Razorpay Checkout. The API decides the amount and opens the order; this only
 * shows Razorpay's own payment window and hands its signed answer back to the
 * API, which verifies it with Razorpay before anything counts as paid.
 */
const SCRIPT = 'https://checkout.razorpay.com/v1/checkout.js';

interface CheckoutSuccess { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }
interface RazorpayInstance { open(): void; on(event: string, cb: (r: { error?: { description?: string } }) => void): void }
declare global { interface Window { Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance } }

let loading: Promise<void> | null = null;
function loadScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SCRIPT;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => { loading = null; reject(new Error("Couldn't load the payment window. Check your connection and try again.")); };
    document.body.appendChild(s);
  });
  return loading;
}

export class CheckoutDismissed extends Error {
  constructor(lastError?: string) { super(lastError ? `${lastError} No money was taken.` : 'Payment window closed before paying.'); }
}

export async function openCheckout(order: PendingOnlinePayment, opts: { description: string; name?: string; email?: string; phone?: string; method?: string }): Promise<CheckoutSuccess> {
  await loadScript();
  return new Promise((resolve, reject) => {
    // A failed attempt keeps the window open so the student can retry; remember why
    // in case they then close it.
    let lastError: string | undefined;
    const rzp = new window.Razorpay!({
      key: order.keyId,
      order_id: order.order.id,
      amount: order.order.amount,
      currency: order.order.currency,
      name: 'Meraki',
      description: opts.description,
      prefill: { name: opts.name, email: opts.email, contact: opts.phone, method: opts.method === 'netbanking' ? 'netbanking' : opts.method },
      theme: { color: '#9a4a2c' },
      handler: (r: CheckoutSuccess) => resolve(r),
      modal: { ondismiss: () => reject(new CheckoutDismissed(lastError)) },
    });
    rzp.on('payment.failed', (r) => { lastError = r.error?.description || 'The payment failed.'; });
    rzp.open();
  });
}
