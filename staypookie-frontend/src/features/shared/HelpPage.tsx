import { useState } from 'react';
import { Building2, ChevronDown, LifeBuoy } from 'lucide-react';
import { useSession } from '@/app/providers/SessionProvider';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import type { Role } from '@/types/domain';

const FAQ: Record<Role | 'all', Array<[string, string]>> = {
  all: [
    ['I can’t sign in', 'Check you picked the right tab (Owner, Manager or Student). If you forgot your password, ask your hostel office to reset it: password reset by email or SMS isn’t set up yet.'],
    ['Why are some sections missing?', 'Complaints, leave, visitors, notices, documents and a few other sections are still being connected to the server. They appear in the menu as soon as they work for real.'],
    ['Are messages sent by SMS or email?', 'Not yet. Payment confirmations and rent reminders appear in the app under the bell icon only.'],
  ],
  owner: [['How do I add a property?', 'Go to Properties → Add property. It appears on the dashboard and list right after you save.'], ['Where is portfolio revenue?', 'Finance shows the ledger and collections for each month, with CSV export.']],
  manager: [['How do I move a student to another bed?', 'Open Rooms & beds, click an occupied bed and choose “Transfer”, or use Transfer on the student profile. Only available beds can be selected.'], ['How do I record cash rent?', 'Payments → Record payment. Pick the due, enter the amount and method. A receipt is generated automatically.']],
  student: [['How do I pay rent?', 'Pay at the hostel office and the manager will record it; your receipt then appears under Rent & receipts. Online payment is shown only when your hostel has set it up.']],
};

export function HelpPage() {
  const { user } = useSession();
  const [open, setOpen] = useState<number | null>(0);
  const items = [...FAQ.all, ...(user ? FAQ[user.role] : [])];

  return (
    <>
      <PageHeader title="Help & support" subtitle="Answers to common questions." />
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
            <CardHeader title="Need help?" />
            <ul className="mt-4 space-y-3 text-sm text-bark">
              <li className="flex gap-2"><Building2 className="mt-0.5 size-4 shrink-0 text-clay-600" aria-hidden />Your hostel office handles accounts, passwords, rooms and payments. Contact them directly.</li>
              <li className="flex gap-2"><LifeBuoy className="mt-0.5 size-4 shrink-0 text-clay-600" aria-hidden />No account yet? Ask your hostel office to create one for you.</li>
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
