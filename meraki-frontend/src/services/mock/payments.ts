import type { ChargeView, CollectionSummary, IPaymentService, PaymentView } from '../interfaces';
import type { ChargeWithBalance, DemoState, Payment } from '@/types/domain';
import { ServiceError, forbidden, invalid, notFound } from '../errors';
import { assertPropertyAccess, bumpCounter, clone, ctx, db, delay, logActivity, mutate, newId, notifyStaff, notifyStudent, propertyName, requireRole, roomNumber, scopeProperty, withBalance, type Ctx } from './base';
import { currentPeriod, todayISO } from '@/lib/clock';
import { formatINR } from '@/lib/format';

export function summarize(charges: ChargeWithBalance[]): CollectionSummary {
  const expected = charges.reduce((a, c) => a + c.amount, 0);
  const collected = charges.reduce((a, c) => a + Math.min(c.paid, c.amount), 0);
  const overdueList = charges.filter((c) => c.status === 'overdue');
  const pendingList = charges.filter((c) => c.status === 'pending' || c.status === 'partial');
  return {
    expected, collected,
    overdue: overdueList.reduce((a, c) => a + c.balance, 0),
    pending: pendingList.reduce((a, c) => a + c.balance, 0),
    collectionPct: expected ? Math.round((collected / expected) * 100) : 0,
    overdueCount: overdueList.length, pendingCount: pendingList.length,
  };
}

function scopedCharges(s: DemoState, c: Ctx, propertyId?: string) {
  if (c.role === 'student') return s.charges.filter((x) => x.studentId === c.studentId);
  const pid = scopeProperty(c, propertyId);
  return s.charges.filter((x) => !pid || x.propertyId === pid);
}

function insertPayment(s: DemoState, c: Ctx, chargeId: string, amount: number, method: Payment['method'], paidOn: string, reference: string, note?: string): Payment {
  const charge = s.charges.find((x) => x.id === chargeId)!;
  const seq = bumpCounter(s, 'receipt');
  const p: Payment = {
    id: newId('pay'), chargeId, studentId: charge.studentId, propertyId: charge.propertyId, amount, method, paidOn,
    reference: reference || `DEMO${Date.now().toString().slice(-8)}`, receiptNo: `RCPT-2026-${String(seq).padStart(4, '0')}`,
    recordedBy: c.user.name, note,
  };
  s.payments.push(p);
  return p;
}

export const mockPaymentService: IPaymentService = {
  async listCharges(filters = {}) {
    await delay();
    const c = ctx();
    const s = db();
    return scopedCharges(s, c, filters.propertyId)
      .filter((x) => !filters.studentId || x.studentId === filters.studentId)
      .filter((x) => !filters.period || x.period === filters.period)
      .map((x) => withBalance(s, x))
      .filter((x) => !filters.status || x.status === filters.status)
      .map<ChargeView>((x) => {
        const st = s.students.find((y) => y.id === x.studentId);
        return { ...x, studentName: st?.name ?? 'Unknown', studentCode: st?.studentCode ?? '', roomNumber: roomNumber(s, st?.roomId), propertyName: propertyName(s, x.propertyId) };
      })
      .sort((a, b) => b.period.localeCompare(a.period) || a.dueDate.localeCompare(b.dueDate));
  },
  async listPayments(filters = {}) {
    await delay();
    const c = ctx();
    const s = db();
    const pid = c.role === 'student' ? undefined : scopeProperty(c, filters.propertyId);
    return s.payments
      .filter((p) => (c.role === 'student' ? p.studentId === c.studentId : !pid || p.propertyId === pid))
      .filter((p) => !filters.studentId || p.studentId === filters.studentId)
      .filter((p) => !filters.method || p.method === filters.method)
      .filter((p) => !filters.from || p.paidOn >= filters.from)
      .filter((p) => !filters.to || p.paidOn <= filters.to)
      .map<PaymentView>((p) => {
        const st = s.students.find((y) => y.id === p.studentId);
        return { ...clone(p), studentName: st?.name ?? 'Unknown', studentCode: st?.studentCode ?? '', propertyName: propertyName(s, p.propertyId), period: s.charges.find((x) => x.id === p.chargeId)?.period ?? '' };
      })
      .sort((a, b) => b.paidOn.localeCompare(a.paidOn) || b.receiptNo.localeCompare(a.receiptNo));
  },
  async summary(filters = {}) {
    await delay(80);
    const c = ctx();
    const s = db();
    const period = filters.period ?? currentPeriod();
    return summarize(scopedCharges(s, c, filters.propertyId).filter((x) => period === 'all' || x.period === period).map((x) => withBalance(s, x)));
  },
  async recordPayment(input) {
    await delay(320);
    const c = ctx();
    requireRole(c, 'owner', 'manager');
    const s0 = db();
    const charge = s0.charges.find((x) => x.id === input.chargeId);
    if (!charge) throw invalid({ chargeId: 'Choose a due to pay against' });
    assertPropertyAccess(c, charge.propertyId);
    const { balance } = withBalance(s0, charge);
    const e: Record<string, string> = {};
    if (!(input.amount > 0)) e.amount = 'Amount must be greater than zero';
    else if (input.amount > balance) e.amount = `Amount cannot exceed the balance of ${formatINR(balance)}`;
    if (!input.paidOn) e.paidOn = 'Payment date is required';
    else if (input.paidOn > todayISO()) e.paidOn = 'Payment date cannot be in the future';
    if (input.method !== 'cash' && !input.reference.trim()) e.reference = 'Reference / UTR is required for non-cash payments';
    if (Object.keys(e).length) throw invalid(e);
    let created!: Payment;
    mutate((s) => {
      created = insertPayment(s, c, input.chargeId, input.amount, input.method, input.paidOn, input.reference.trim(), input.note?.trim() || undefined);
      const st = s.students.find((x) => x.id === charge.studentId)!;
      logActivity(s, c, 'payment', `Recorded ${formatINR(input.amount)} ${input.method.replace('_', ' ')} payment from ${st.name}`, charge.propertyId, `/manager/students/${st.id}`);
      notifyStudent(s, st.id, 'Payment received', `${formatINR(input.amount)} received. Receipt ${created.receiptNo}.`, 'payment', '/student/rent');
    });
    return clone(created);
  },
  async getReceipt(paymentId) {
    await delay(80);
    const c = ctx();
    const s = db();
    const p = s.payments.find((x) => x.id === paymentId);
    if (!p) throw notFound('Receipt');
    if (c.role === 'student' && p.studentId !== c.studentId) throw forbidden();
    if (c.role !== 'student') assertPropertyAccess(c, p.propertyId);
    const charge = s.charges.find((x) => x.id === p.chargeId)!;
    const st = s.students.find((x) => x.id === p.studentId)!;
    const prop = s.properties.find((x) => x.id === p.propertyId)!;
    const bed = s.beds.find((b) => b.id === st.bedId);
    return {
      receiptNo: p.receiptNo, payment: clone(p), charge: clone(charge),
      student: { id: st.id, name: st.name, studentCode: st.studentCode, phone: st.phone },
      property: { id: prop.id, name: prop.name, address: prop.address },
      roomLabel: st.roomId ? `Room ${roomNumber(s, st.roomId)}${bed ? `, Bed ${bed.label}` : ''}` : 'Not allotted',
    };
  },
  async sendReminders(chargeIds) {
    await delay(300);
    const c = ctx();
    requireRole(c, 'owner', 'manager');
    if (!chargeIds.length) throw invalid({ chargeIds: 'Select at least one due' });
    let count = 0;
    mutate((s) => {
      for (const id of chargeIds) {
        const ch = s.charges.find((x) => x.id === id);
        if (!ch || (c.role === 'manager' && ch.propertyId !== c.propertyId)) continue;
        const wb = withBalance(s, ch);
        if (wb.balance <= 0) continue;
        notifyStudent(s, ch.studentId, 'Rent reminder', `${formatINR(wb.balance)} is due for ${ch.period}. Due date: ${ch.dueDate}.`, 'payment', '/student/rent');
        count++;
      }
      if (count) logActivity(s, c, 'payment', `Sent rent reminders to ${count} resident${count > 1 ? 's' : ''} (demo — no SMS sent)`, c.propertyId, '/manager/payments');
    });
    return count;
  },
  async payNow(chargeId, method) {
    await delay(900);
    const c = ctx();
    requireRole(c, 'student');
    const s0 = db();
    const charge = s0.charges.find((x) => x.id === chargeId);
    if (!charge) throw notFound('Due');
    if (charge.studentId !== c.studentId) throw forbidden();
    const { balance } = withBalance(s0, charge);
    if (balance <= 0) throw new ServiceError('CONFLICT', 'This due is already paid.');
    let created!: Payment;
    mutate((s) => {
      created = insertPayment(s, c, chargeId, balance, method === 'netbanking' ? 'bank_transfer' : method, todayISO(), `SIM${Date.now().toString().slice(-9)}`, 'Simulated online payment (demo)');
      logActivity(s, c, 'payment', `${c.user.name} paid ${formatINR(balance)} online (simulated)`, charge.propertyId, `/manager/students/${charge.studentId}`);
      notifyStaff(s, charge.propertyId, 'Online payment received', `${c.user.name} paid ${formatINR(balance)} (simulated).`, 'payment', '/manager/payments', '/owner/finance');
      notifyStudent(s, charge.studentId, 'Payment successful', `${formatINR(balance)} paid. Receipt ${created.receiptNo}.`, 'payment', '/student/rent');
    });
    return clone(created);
  },
};
