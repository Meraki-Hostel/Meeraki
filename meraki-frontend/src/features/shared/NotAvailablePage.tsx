import { Hourglass } from 'lucide-react';
import { useSession, roleHome } from '@/app/providers/SessionProvider';
import { PageHeader } from '@/components/layout/PageHeader';
import { ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/States';
import { FEATURE_LABEL, type Feature } from '@/lib/features';

/** Honest placeholder for a module whose backend does not exist yet. Nothing on it can be saved. */
export function NotAvailablePage({ feature }: { feature: Feature }) {
  const { role } = useSession();
  const label = FEATURE_LABEL[feature];
  return (
    <>
      <PageHeader docTitle={label} title={label} />
      <Card>
        <EmptyState icon={<Hourglass className="size-5" />} title="Not available yet"
          message={<>{label} isn't connected to the Meraki server yet, so there is nothing to show and nothing here could be saved. It will appear in the menu once it's ready.</>}
          action={role ? <ButtonLink to={roleHome(role)} variant="secondary">Back to home</ButtonLink> : undefined} />
      </Card>
    </>
  );
}
