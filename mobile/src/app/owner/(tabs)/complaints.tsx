import { Screen } from '@/components/ui';
import { ComplaintQueue } from '@/features/ComplaintQueue';

export default function OwnerComplaints() {
  return (
    <Screen>
      <ComplaintQueue basePath="/owner/complaints" />
    </Screen>
  );
}
