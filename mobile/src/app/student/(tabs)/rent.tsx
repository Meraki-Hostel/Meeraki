import { useState } from 'react';
import { Alert, View } from 'react-native';
import { downloadAndShare } from '@/api/files';
import { toApiError } from '@/api/errors';
import { receiptPdfPath, students } from '@/api/services';
import { useUser } from '@/auth/session';
import { Badge, Body, Button, Card, Chips, Empty, ErrorState, Loading, Notice, Row, Screen, Section, Strong } from '@/components/ui';
import { space } from '@/components/theme';
import type { ChargeWithBalance } from '@/contract/domain';
import { useApi } from '@/hooks/api';
import { useQueryClient } from '@tanstack/react-query';
import { date, humanize, inr, period } from '@/lib/format';
import { METHOD_LABELS } from '@/lib/labels';
import { payCharge } from '@/lib/razorpay';

type Method = 'upi' | 'card' | 'netbanking';

export default function StudentRent() {
  const user = useUser();
  const qc = useQueryClient();
  const me = useApi(['students', 'me'], students.me);
  const [method, setMethod] = useState<Method>('upi');
  const [paying, setPaying] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; tone: 'good' | 'warn' | 'bad' } | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  if (me.loading) return <Loading />;
  if (me.error || !me.data) return <Screen><ErrorState error={me.error} onRetry={me.refetch} /></Screen>;

  const due = me.data.charges.filter((c) => c.balance > 0).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const history = [...me.data.payments].sort((a, b) => b.paidOn.localeCompare(a.paidOn));

  async function pay(c: ChargeWithBalance) {
    setPaying(c.id);
    setMessage(null);
    try {
      const out = await payCharge(c.id, method, user, `${humanize(c.kind ?? 'rent')} · ${period(c.period)}`);
      if (out.kind === 'paid') setMessage({ text: `Paid ${inr(c.balance)}. Your receipt is below.`, tone: 'good' });
      if (out.kind === 'processing') setMessage({ text: "We're confirming your payment with the bank. You'll get a notification when it's done.", tone: 'warn' });
      if (out.kind === 'failed') setMessage({ text: out.message, tone: 'bad' });
    } catch (e) {
      const err = toApiError(e);
      setMessage({ text: err.isUnavailableFeature ? `Online payment isn't available: ${err.message}` : err.message, tone: err.isUnavailableFeature ? 'warn' : 'bad' });
    } finally {
      setPaying(null);
      void qc.invalidateQueries();
    }
  }

  async function receipt(paymentId: string, receiptNo: string) {
    setDownloading(paymentId);
    try { await downloadAndShare(receiptPdfPath(paymentId), `${receiptNo}.pdf`); }
    catch (e) { Alert.alert('Receipt', toApiError(e).message); }
    finally { setDownloading(null); }
  }

  return (
    <Screen onRefresh={me.refetch} refreshing={me.refreshing}>
      {message && <Notice message={message.text} tone={message.tone} />}

      <Section title="To pay">
        {due.length === 0 ? <Empty title="All paid up" body="You have nothing due right now." icon="checkmark-circle-outline" /> : (
          <>
            <Chips<Method> label="Pay with" value={method} onChange={setMethod}
              options={[{ value: 'upi', label: 'UPI' }, { value: 'card', label: 'Card' }, { value: 'netbanking', label: 'Net banking' }]} />
            {due.map((c) => (
              <Card key={c.id}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Strong>{humanize(c.kind ?? 'rent')} · {period(c.period)}</Strong>
                  <Badge label={c.status} />
                </View>
                <Body muted>Due {date(c.dueDate)}{c.paid > 0 ? ` · ${inr(c.paid)} already paid` : ''}</Body>
                {!!c.description && <Body muted>{c.description}</Body>}
                <Button title={`Pay ${inr(c.balance)}`} icon="card-outline" onPress={() => { void pay(c); }}
                  loading={paying === c.id} disabled={!!paying && paying !== c.id} style={{ marginTop: space.md }} />
              </Card>
            ))}
          </>
        )}
      </Section>

      <Section title="Payments & receipts">
        {history.length === 0 ? <Body muted>No payments yet.</Body> : (
          <Card>
            {history.map((p) => (
              <Row key={p.id} title={`${inr(p.amount)} · ${METHOD_LABELS[p.method] ?? humanize(p.method)}`}
                subtitle={`${date(p.paidOn)} · ${p.receiptNo}${p.status === 'simulated' ? ' · test payment' : ''}`}
                right={downloading === p.id ? <Body muted>Opening…</Body> : undefined}
                onPress={() => { void receipt(p.id, p.receiptNo); }} />
            ))}
          </Card>
        )}
      </Section>
    </Screen>
  );
}
