import { MeScreen } from '@/features/MeScreen';

export default function StudentMe() {
  return (
    <MeScreen links={[
      { title: 'My profile', icon: 'person-outline', href: '/student/profile', subtitle: 'Contact and emergency details' },
      { title: 'Documents', icon: 'document-text-outline', href: '/student/documents' },
      { title: 'Feedback', icon: 'star-outline', href: '/student/feedback' },
      { title: 'Emergency', icon: 'warning-outline', href: '/student/emergency' },
    ]} />
  );
}
