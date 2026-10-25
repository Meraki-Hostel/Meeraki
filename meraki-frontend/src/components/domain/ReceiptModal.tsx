import { Download, Printer } from 'lucide-react';
import { services } from '@/services';
import { useQuery } from '@/hooks/useQuery';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { Skeleton } from '@/components/ui/States';
import { downloadFile } from '@/lib/export';
import { formatDate, formatINR, formatPeriod, formatPhone, sentenceCase } from '@/lib/format';

const METHOD: Record<string, string> = { upi: 'UPI', cash: 'Cash', bank_transfer: 'Bank transfer', card: 'Card' };

export function ReceiptModal({ paymentId, onClose }: { paymentId: string | null; onClose: () => void }) {
  const q = useQuery(() => (paymentId ? services.payments.getReceipt(paymentId) : Promise.resolve(null)), [paymentId]);
  const r = q.data;
  // Only `simulated` payments (development) are not real; everything else returned by the API was received.
  const simulated = r?.payment.status === 'simulated';
  const download = () => {
    if (!r) return;
    const lines = [
      simulated ? 'MERAKI — SIMULATED PAYMENT (NO MONEY RECEIVED)' : 'MERAKI — RENT RECEIPT', '',
      `Receipt no: ${r.receiptNo}`, `Date: ${formatDate(r.payment.paidOn)}`, '',
      `Property: ${r.property.name}`, `Address: ${r.property.address}`, '',
      `Resident: ${r.student.name} (${r.student.studentCode})`, `Phone: ${formatPhone(r.student.phone)}`, `Room: ${r.roomLabel}`, '',
      `For: ${r.charge.description} — ${formatPeriod(r.charge.period)}`, `Amount paid: ${formatINR(r.payment.amount)}`,
      `Method: ${METHOD[r.payment.method]}`, `Reference: ${r.payment.reference}`, `Recorded by: ${r.payment.recordedBy}`, '',
      simulated ? 'Recorded in a development environment. No money was received.' : 'Computer-generated receipt.',
    ];
    downloadFile(`${r.receiptNo}.txt`, lines.join('\n'));
  };
  return (
    <Modal open={!!paymentId} onClose={onClose} title="Payment receipt" size="md"
      footer={<>
        <Button variant="secondary" icon={<Download className="size-4" />} onClick={download} disabled={!r}>Download</Button>
        <Button icon={<Printer className="size-4" />} onClick={() => window.print()} disabled={!r}>Print</Button>
      </>}>
      {!r ? <div className="space-y-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-6" />)}</div> : (
        <div className="print-area rounded-2xl border border-line bg-white p-5">
          <div className="flex items-start justify-between gap-4 border-b border-dashed border-line-strong pb-4">
            <BrandLogo />
            <div className="text-right text-xs text-dust">
              <p className="font-semibold text-espresso">{r.receiptNo}</p>
              <p>{formatDate(r.payment.paidOn)}</p>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 py-4 text-sm">
            <div><dt className="text-xs text-dust">Received from</dt><dd className="font-medium">{r.student.name}</dd><dd className="text-xs text-dust">{r.student.studentCode}</dd></div>
            <div><dt className="text-xs text-dust">Property</dt><dd className="font-medium">{r.property.name}</dd><dd className="text-xs text-dust">{r.roomLabel}</dd></div>
            <div><dt className="text-xs text-dust">For</dt><dd>{r.charge.description}, {formatPeriod(r.charge.period)}</dd></div>
            <div><dt className="text-xs text-dust">Method</dt><dd>{METHOD[r.payment.method] ?? sentenceCase(r.payment.method)}</dd><dd className="text-xs text-dust break-all">Ref {r.payment.reference}</dd></div>
          </dl>
          <div className="flex items-center justify-between rounded-xl bg-sand/60 px-4 py-3">
            <span className="text-sm text-bark">Amount paid</span>
            <span className="font-display text-2xl font-semibold tabular-nums">{formatINR(r.payment.amount)}</span>
          </div>
          <p className="mt-4 text-[11px] leading-relaxed text-dust">Recorded by {r.payment.recordedBy}. {simulated ? <strong className="text-brick">Simulated payment: no money was received.</strong> : 'Computer-generated receipt.'}</p>
        </div>
      )}
    </Modal>
  );
}
