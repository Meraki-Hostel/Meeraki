import { useState } from 'react'
import { CheckCircle2, Star } from 'lucide-react'
import { useCurrentStudent, useStore } from '../../store/AppStore'
import { THIS_MONTH } from '../../store/selectors'
import { FEEDBACK_CATEGORIES, type FeedbackCategory } from '../../lib/types'
import { FEEDBACK_LABELS } from '../../lib/meta'
import { cn, cycleLabel, sleep } from '../../lib/utils'
import { Button, Card, Field, PageHeader, Textarea, useToast } from '../../components/ui'

const HINTS = ['', 'Poor', 'Below average', 'Okay', 'Good', 'Excellent']

export default function StudentFeedback() {
  const { data, submitFeedback } = useStore()
  const s = useCurrentStudent()
  const toast = useToast()
  const existing = data.feedback.find((f) => f.studentId === s.id && f.month === THIS_MONTH)
  const [ratings, setRatings] = useState<Record<FeedbackCategory, number>>(existing?.ratings ?? { cleanliness: 0, food: 0, maintenance: 0, staff: 0, safety: 0, wifi: 0 })
  const [comment, setComment] = useState(existing?.comment ?? '')
  const [editing, setEditing] = useState(!existing)
  const [saving, setSaving] = useState(false)
  const done = FEEDBACK_CATEGORIES.every((c) => ratings[c] > 0)

  const submit = async () => {
    if (!done) return toast.error('Please rate every category.')
    setSaving(true)
    await sleep(500)
    submitFeedback(s.id, THIS_MONTH, ratings, comment.trim())
    setSaving(false)
    setEditing(false)
    toast.success('Thanks for your feedback!', { description: 'It’s anonymous to other students and helps the hostel improve.' })
  }

  return (
    <div>
      <PageHeader title="Monthly feedback" description={`${cycleLabel(THIS_MONTH, true)} · takes about 30 seconds`} />
      {!editing ? (
        <Card className="p-6 text-center">
          <CheckCircle2 size={36} className="mx-auto text-emerald-500" />
          <h2 className="mt-3 text-base font-semibold text-slate-900">Feedback submitted for {cycleLabel(THIS_MONTH, true)}</h2>
          <p className="mt-1 text-sm text-slate-500">You can update it until the end of the month.</p>
          <Button className="mt-4" onClick={() => setEditing(true)}>Edit my feedback</Button>
        </Card>
      ) : (
        <Card className="divide-y divide-slate-100">
          {FEEDBACK_CATEGORIES.map((c) => (
            <div key={c} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-900">{FEEDBACK_LABELS[c]}</div>
                <div className="h-4 text-xs text-slate-500">{HINTS[ratings[c]]}</div>
              </div>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} onClick={() => setRatings({ ...ratings, [c]: n })} className="rounded-lg p-1.5 transition-transform hover:scale-110" aria-label={`${n} stars`}>
                    <Star size={26} className={cn(n <= ratings[c] ? 'fill-amber-400 text-amber-400' : 'text-slate-300')} />
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className="px-5 py-4">
            <Field label="Anything else? (optional)">
              <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="What should we improve next month?" />
            </Field>
            <Button variant="primary" size="lg" className="mt-4 w-full sm:w-auto" loading={saving} disabled={!done} onClick={submit}>Submit feedback</Button>
          </div>
        </Card>
      )}
    </div>
  )
}
