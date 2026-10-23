import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { useStore } from '../../store/AppStore'
import { locationOf } from '../../store/selectors'
import { useConfirm, useToast } from '../ui'
import { AddStudentWizard } from './AddStudentWizard'
import { AssignBedModal, AssignStudentModal, TransferModal } from './AssignModals'
import { AnnouncementModal, ComplaintFormModal, EditStudentModal } from './Forms'
import { ReceiptModal, RecordPaymentModal } from './PaymentModals'

type ModalState =
  | { type: 'addStudent'; bedId?: string }
  | { type: 'recordPayment'; studentId?: string; dueId?: string }
  | { type: 'receipt'; txnId: string }
  | { type: 'assignBed'; studentId?: string }
  | { type: 'assignStudent'; bedId: string }
  | { type: 'transfer'; studentId: string }
  | { type: 'complaint'; studentId?: string; studentMode?: boolean }
  | { type: 'announcement' }
  | { type: 'editStudent'; studentId: string }

interface Api {
  open: (m: ModalState) => void
  close: () => void
  checkout: (studentId: string) => Promise<boolean>
}
const Ctx = createContext<Api | null>(null)

export function ModalsProvider({ children }: { children: ReactNode }) {
  const { data, session, checkoutStudent } = useStore()
  const confirm = useConfirm()
  const toast = useToast()
  const [m, setM] = useState<(ModalState & { key: number }) | null>(null)
  const open = useCallback((x: ModalState) => setM({ ...x, key: Date.now() }), [])
  const close = useCallback(() => setM(null), [])

  const student = session.role === 'student' ? data.students.find((s) => s.id === session.studentId) : null
  const propertyId = student?.propertyId ?? session.managerPropertyId

  const checkout = useCallback(
    async (studentId: string) => {
      const s = data.students.find((x) => x.id === studentId)!
      const loc = locationOf(data, s)
      const { ok } = await confirm({
        title: `Check out ${s.name}?`,
        description: loc ? `This will make Bed ${loc.bed.label} in Room ${loc.room.number} available. Unpaid future invoices are cancelled; past dues remain on record.` : 'The student will be marked as checked out.',
        confirmLabel: 'Confirm checkout',
        tone: 'danger',
      })
      if (!ok) return false
      checkoutStudent(studentId)
      toast.success(`${s.name} checked out`, { description: loc ? `Bed ${loc.label} is now available.` : undefined })
      return true
    },
    [data, confirm, checkoutStudent, toast],
  )

  const api = useMemo(() => ({ open, close, checkout }), [open, close, checkout])

  return (
    <Ctx.Provider value={api}>
      {children}
      {m?.type === 'addStudent' && <AddStudentWizard key={m.key} open onClose={close} propertyId={propertyId} presetBedId={m.bedId} />}
      {m?.type === 'recordPayment' && <RecordPaymentModal key={m.key} open onClose={close} propertyId={propertyId} studentId={m.studentId} dueId={m.dueId} onReceipt={(txnId) => open({ type: 'receipt', txnId })} />}
      {m?.type === 'receipt' && <ReceiptModal key={m.key} open onClose={close} txnId={m.txnId} />}
      {m?.type === 'assignBed' && <AssignBedModal key={m.key} open onClose={close} propertyId={propertyId} studentId={m.studentId} />}
      {m?.type === 'assignStudent' && <AssignStudentModal key={m.key} open onClose={close} bedId={m.bedId} onAddNew={() => open({ type: 'addStudent', bedId: m.bedId })} />}
      {m?.type === 'transfer' && <TransferModal key={m.key} open onClose={close} studentId={m.studentId} />}
      {m?.type === 'complaint' && <ComplaintFormModal key={m.key} open onClose={close} propertyId={propertyId} studentId={m.studentId} studentMode={m.studentMode} />}
      {m?.type === 'announcement' && <AnnouncementModal key={m.key} open onClose={close} propertyId={propertyId} />}
      {m?.type === 'editStudent' && <EditStudentModal key={m.key} open onClose={close} student={data.students.find((s) => s.id === m.studentId)!} />}
    </Ctx.Provider>
  )
}

export function useModals() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useModals outside provider')
  return v
}
