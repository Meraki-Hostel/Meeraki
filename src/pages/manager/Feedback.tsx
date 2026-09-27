import { useManagerProperty } from '../../store/AppStore'
import { PageHeader } from '../../components/ui'
import { FeedbackAnalytics } from '../../components/domain/FeedbackAnalytics'

export default function FeedbackPage() {
  const property = useManagerProperty()
  return (
    <div>
      <PageHeader title="Feedback analytics" description={`Monthly student feedback · ${property.name}`} />
      <FeedbackAnalytics propertyId={property.id} />
    </div>
  )
}
