import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { EmptyState } from '../components/ui'

export default function NotFound() {
  return (
    <EmptyState
      icon={Compass}
      title="This page isn’t part of the prototype"
      description="The link may be outdated. Use the navigation to continue."
      action={<Link to="/" className="text-sm font-semibold text-brand-700 hover:text-brand-800">Go to home</Link>}
    />
  )
}
