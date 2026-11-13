import type {
  AnnouncementCategory, ComplaintCategory, ComplaintStatus, DocumentType, FeedbackCategory, PaymentMethod, Priority,
} from '@/contract/domain';
import type { EmergencyType } from '@/contract/interfaces';

type Opt<T extends string> = { value: T; label: string }[];

export const COMPLAINT_CATEGORIES: Opt<ComplaintCategory> = [
  { value: 'electrical', label: 'Electrical' }, { value: 'plumbing', label: 'Plumbing' }, { value: 'cleaning', label: 'Cleaning' },
  { value: 'internet', label: 'Internet' }, { value: 'food', label: 'Food' }, { value: 'furniture', label: 'Furniture' },
  { value: 'security', label: 'Security' }, { value: 'other', label: 'Other' },
];
export const PRIORITIES: Opt<Priority> = [
  { value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }, { value: 'urgent', label: 'Urgent' },
];
export const COMPLAINT_STATUSES: Opt<ComplaintStatus> = [
  { value: 'open', label: 'Open' }, { value: 'in_progress', label: 'In progress' }, { value: 'resolved', label: 'Resolved' }, { value: 'closed', label: 'Closed' },
];
export const FEEDBACK_CATEGORIES: Opt<FeedbackCategory> = [
  { value: 'food', label: 'Food' }, { value: 'cleanliness', label: 'Cleanliness' }, { value: 'staff', label: 'Staff' },
  { value: 'facilities', label: 'Facilities' }, { value: 'security', label: 'Security' }, { value: 'internet', label: 'Internet' }, { value: 'other', label: 'Other' },
];
export const EMERGENCY_TYPES: Opt<EmergencyType> = [
  { value: 'medical', label: 'Medical' }, { value: 'fire', label: 'Fire' }, { value: 'security', label: 'Security' }, { value: 'other', label: 'Other' },
];
/** Methods a manager records by hand (online payments come from the gateway). */
export const RECORD_METHODS: Opt<PaymentMethod> = [
  { value: 'cash', label: 'Cash' }, { value: 'upi', label: 'UPI' }, { value: 'bank_transfer', label: 'Bank transfer' }, { value: 'card', label: 'Card' },
];
export const ANNOUNCEMENT_CATEGORIES: Opt<AnnouncementCategory> = [
  { value: 'general', label: 'General' }, { value: 'maintenance', label: 'Maintenance' }, { value: 'mess', label: 'Mess' },
  { value: 'event', label: 'Event' }, { value: 'urgent', label: 'Urgent' },
];
export const DOCUMENT_LABELS: Record<DocumentType, string> = {
  id_proof: 'ID proof', admission_letter: 'Admission letter', photo: 'Photo', police_verification: 'Police verification',
  rent_agreement: 'Rent agreement', medical: 'Medical certificate',
};
export const METHOD_LABELS: Record<PaymentMethod, string> = { cash: 'Cash', upi: 'UPI', bank_transfer: 'Bank transfer', card: 'Card' };
