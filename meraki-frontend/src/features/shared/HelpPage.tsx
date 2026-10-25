import { useState, type FormEvent } from 'react';
import { ChevronDown, LifeBuoy, Mail, Phone } from 'lucide-react';
import { useSession } from '@/app/providers/SessionProvider';
import { useToast } from '@/app/providers/ToastProvider';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Field';
import { rules, validate } from '@/lib/validation';
import type { Role } from '@/types/domain';

const FAQ: Record<Role | 'all', Array<[string, string]>> = {
  all: [
    ['Is this real data?', 'No. Everything here is fictional demo data stored in your browser. Use “Reset demo data” in the account menu to start over.'],
    ['How do I switch between Owner, Manager and Student?', 'Open the account menu (your name, top right) and pick another persona under “Switch demo persona”. Your changes are kept.'],
    ['Are payments or messages real?', 'No. Payments are simulated, and reminders or notices only create in-app notifications. No SMS, email or money moves.'],
  ],
  owner: [['How do I add a property?', 'Go to Properties → Add property. It appears on the dashboard and list right after you save.'], ['Where is portfolio revenue?', 'Finance shows the ledger and collections; Analytics shows six-month trends with CSV export.']],
  manager: [['How do I move a student to another bed?', 'Open Rooms & beds, click an occupied bed and choose “Transfer”, or use Transfer on the student profile. Only available beds can be selected.'], ['How do I record cash rent?', 'Payments → Record payment. Pick the due, enter the amount and method. A receipt is generated automatically.']],
  student: [['How do I pay rent?', 'Go to Rent & receipts and choose Pay now. It’s a simulated payment — no card or bank details are requested.'], ['How long does a leave approval take?', 'Your warden usually responds within a day. You’ll see the decision on the Leave page and in notifications.']],
};

export function HelpPage() {
  const { user } = useSession();
  const toast = useToast();
  const [open, setOpen] = useState<number | null>(0);
  const [form, setForm] = useState({ topic: 'general', email: user?.email ?? '', message: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const items = [...FAQ.all, ...(user ? FAQ[user.role] : [])];

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const v = validate(form, { email: [rules.required('Email'), rules.email()], message: [rules.required('Message'), rules.minLength(10, 'Message')] });
    setErrors(v as Record<string, string>);
    if (Object.keys(v).length) return;
    toast.success('Support request noted. In demo mode no ticket is sent — our team would reply within one working day.', 'Request received');
    setForm((f) => ({ ...f, message: '' }));
  };

  return (
    <>
      <PageHeader title="Help & support" subtitle="Answers to common questions, and a way to reach us." />
      <div className="grid gap-5 lg:grid-cols-5">
        <Card className="p-5 lg:col-span-3">
          <CardHeader title="Frequently asked" />
          <div className="mt-3 divide-y divide-line">
            {items.map(([q, a], i) => (
              <div key={q}>
                <h3 className="m-0">
                  <button type="button" aria-expanded={open === i} aria-controls={`faq-${i}`} onClick={() => setOpen(open === i ? null : i)} className="flex w-full items-center justify-between gap-3 py-3.5 text-left font-sans text-[15px] font-medium text-espresso">
                    {q}<ChevronDown className={`size-4 shrink-0 text-dust transition-transform ${open === i ? 'rotate-180' : ''}`} aria-hidden />
                  </button>
                </h3>
                {open === i && <p id={`faq-${i}`} className="pb-4 text-sm leading-relaxed text-bark">{a}</p>}
              </div>
            ))}
          </div>
        </Card>
        <div className="space-y-5 lg:col-span-2" id="contact">
          <Card className="p-5">
            <CardHeader title="Contact support" subtitle="Mon–Sat, 9 am to 7 pm IST" />
            <ul className="mt-4 space-y-2 text-sm">
              <li className="flex items-center gap-2 text-bark"><Phone className="size-4 text-clay-600" aria-hidden /> +91 94150 12345</li>
              <li className="flex items-center gap-2 text-bark"><Mail className="size-4 text-clay-600" aria-hidden /> support@merakiliving.example</li>
              <li className="flex items-center gap-2 text-bark"><LifeBuoy className="size-4 text-clay-600" aria-hidden /> No account yet? Ask your hostel office for an invitation.</li>
            </ul>
          </Card>
          <Card className="p-5">
            <CardHeader title="Send us a message" />
            <form onSubmit={submit} noValidate className="mt-4 space-y-4">
              <Select label="Topic" value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} options={[{ value: 'general', label: 'General question' }, { value: 'account', label: 'Account & sign-in' }, { value: 'billing', label: 'Billing & plans' }, { value: 'bug', label: 'Something isn’t working' }]} />
              <Input label="Your email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} error={errors.email} required />
              <Textarea label="How can we help?" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} error={errors.message} required />
              <Button type="submit" className="w-full">Send message</Button>
            </form>
          </Card>
        </div>
      </div>
    </>
  );
}
