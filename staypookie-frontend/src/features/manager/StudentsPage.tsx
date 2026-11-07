import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Download, UserPlus } from 'lucide-react';
import { services } from '@/services';
import type { StudentListItem } from '@/services/interfaces';
import type { StudentStatus } from '@/types/domain';
import { useQuery } from '@/hooks/useQuery';
import { useDebounced } from '@/hooks/misc';
import { useCurrentUser } from '@/app/providers/SessionProvider';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { FilterBar, FilterSelect, SearchInput } from '@/components/ui/FilterBar';
import { StatusBadge, statusOptions } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/States';
import { exportCSV } from '@/lib/export';
import { formatINR, formatPhone } from '@/lib/format';
import { StudentWizard } from './StudentWizard';

export function StudentsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useCurrentUser();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [dues, setDues] = useState('');
  const [wizard, setWizard] = useState(false);
  const ds = useDebounced(search);
  const q = useQuery(() => services.students.list({ search: ds, status: (status || undefined) as StudentStatus | undefined }), [ds, status]);
  useEffect(() => {
    if ((location.state as { openWizard?: boolean } | null)?.openWizard) { setWizard(true); navigate(location.pathname, { replace: true, state: null }); }
  }, [location, navigate]);
  const rows = useMemo(() => (q.data ?? []).filter((s) => !dues || (dues === 'due' ? s.balance > 0 : s.balance === 0)), [q.data, dues]);

  const columns: Column<StudentListItem>[] = [
    { key: 'name', header: 'Student', cell: (s) => <div className="flex items-center gap-3"><Avatar name={s.name} size="sm" /><div><p className="font-medium">{s.name}</p><p className="text-xs text-dust">{s.studentCode}</p></div></div>, sortValue: (s) => s.name },
    { key: 'room', header: 'Room · bed', cell: (s) => (s.roomNumber ? `${s.roomNumber} · ${s.bedLabel}` : <span className="text-mute">Not allotted</span>), sortValue: (s) => s.roomNumber ?? 'zzz' },
    { key: 'college', header: 'College', cell: (s) => <div><p>{s.college}</p><p className="text-xs text-dust">{s.course} · Year {s.year}</p></div>, sortValue: (s) => s.college, hideBelow: 'lg' },
    { key: 'phone', header: 'Phone', cell: (s) => formatPhone(s.phone), hideBelow: 'md' },
    { key: 'bal', header: 'Balance', align: 'right', cell: (s) => <span className={s.balance ? 'font-semibold text-brick' : 'text-dust'}>{formatINR(s.balance)}</span>, sortValue: (s) => s.balance },
    { key: 'status', header: 'Status', cell: (s) => <StatusBadge kind="student" value={s.status} />, sortValue: (s) => s.status },
  ];

  return (
    <>
      <PageHeader title="Students" subtitle={`Residents at ${user.title.replace('Manager · ', '')}. Open a profile to edit, transfer or record a payment.`}
        actions={<>
          <Button variant="secondary" icon={<Download className="size-4" />} disabled={!rows.length} onClick={() => exportCSV('students', rows, [{ header: 'Student ID', value: (s) => s.studentCode }, { header: 'Name', value: (s) => s.name }, { header: 'Phone', value: (s) => s.phone }, { header: 'Email', value: (s) => s.email }, { header: 'Room', value: (s) => s.roomNumber }, { header: 'Bed', value: (s) => s.bedLabel }, { header: 'College', value: (s) => s.college }, { header: 'Course', value: (s) => s.course }, { header: 'Status', value: (s) => s.status }, { header: 'Balance', value: (s) => s.balance }])}>Export CSV</Button>
          <Button icon={<UserPlus className="size-4" />} onClick={() => setWizard(true)}>Add student</Button>
        </>} />
      <Card className="p-4 sm:p-5">
        <FilterBar className="mb-4">
          <SearchInput value={search} onChange={setSearch} placeholder="Name, ID, phone, room" label="Search students" />
          <FilterSelect label="Statuses" value={status} onChange={setStatus} options={statusOptions('student')} />
          <FilterSelect label="Dues" allLabel="Any" value={dues} onChange={setDues} options={[{ value: 'due', label: 'Has balance due' }, { value: 'clear', label: 'All paid up' }]} />
        </FilterBar>
        <DataTable caption="Students" columns={columns} rows={q.data ? rows : undefined} loading={q.loading} error={q.error} onRetry={q.reload} rowKey={(s) => s.id} pageSize={12}
          onRowClick={(s) => navigate(`/manager/students/${s.id}`)} rowLabel={(s) => `Open ${s.name}`}
          empty={<EmptyState title="No students match" message="Clear filters or add a student." action={<Button size="sm" onClick={() => setWizard(true)}>Add student</Button>} />} />
      </Card>
      <StudentWizard open={wizard} onClose={() => setWizard(false)} />
    </>
  );
}
