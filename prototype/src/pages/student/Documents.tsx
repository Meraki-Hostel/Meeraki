import { useCurrentStudent } from '../../store/AppStore'
import { PageHeader } from '../../components/ui'
import { DocumentsList } from '../../components/domain/Documents'

export default function StudentDocuments() {
  const s = useCurrentStudent()
  return (
    <div>
      <PageHeader title="Documents" description="Your agreement, ID and payment receipts" />
      <DocumentsList student={s} canUpload />
    </div>
  )
}
