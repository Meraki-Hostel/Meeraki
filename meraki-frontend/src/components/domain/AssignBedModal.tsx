import { useEffect, useState } from 'react';
import { services } from '@/services';
import { useMutation } from '@/hooks/useMutation';
import { useQuery } from '@/hooks/useQuery';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { BedPicker } from './BedPicker';

/** Assign or transfer a student to an available bed. Occupied/unavailable beds are not selectable. */
export function AssignBedModal({ open, onClose, studentId, studentName, currentBedId, propertyId }: { open: boolean; onClose: () => void; studentId: string; studentName: string; currentBedId?: string; propertyId?: string }) {
  const rooms = useQuery(() => (open ? services.rooms.list({ propertyId }) : Promise.resolve([])), [open, propertyId]);
  const [bed, setBed] = useState<string | null>(null);
  useEffect(() => { if (open) setBed(null); }, [open]);
  const m = useMutation((b: string) => services.rooms.assignBed(studentId, b), { success: currentBedId ? `${studentName} transferred. Room occupancy and profile updated.` : `Bed allotted to ${studentName}.`, onSuccess: onClose });
  return (
    <Modal open={open} onClose={onClose} size="lg" title={currentBedId ? `Transfer ${studentName}` : `Allot a bed to ${studentName}`} description="Only available beds can be selected. Rent updates to the new room’s rate."
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={!bed} loading={m.pending} onClick={() => bed && void m.run(bed)} title={!bed ? 'Select an available bed first' : undefined}>{currentBedId ? 'Confirm transfer' : 'Allot bed'}</Button></>}>
      <BedPicker rooms={rooms.data} loading={rooms.loading} value={bed} onChange={setBed} currentBedId={currentBedId} />
    </Modal>
  );
}
