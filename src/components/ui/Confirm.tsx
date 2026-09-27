import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { AlertTriangle, HelpCircle } from 'lucide-react'
import { Button } from './Button'
import { Modal } from './Modal'
import { Textarea } from './Form'
import { cn } from '../../lib/utils'

interface Opts {
  title: string
  description?: ReactNode
  confirmLabel?: string
  tone?: 'danger' | 'primary' | 'success'
  note?: { label: string; placeholder?: string; required?: boolean }
}
type ConfirmFn = (o: Opts) => Promise<{ ok: boolean; note: string }>
const Ctx = createContext<ConfirmFn | null>(null)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<Opts | null>(null)
  const [note, setNote] = useState('')
  const resolver = useRef<(v: { ok: boolean; note: string }) => void>(null)
  const confirm = useCallback<ConfirmFn>((o) => {
    setOpts(o)
    setNote('')
    return new Promise((res) => (resolver.current = res))
  }, [])
  const close = (ok: boolean) => {
    resolver.current?.({ ok, note })
    setOpts(null)
  }
  const danger = opts?.tone === 'danger'
  return (
    <Ctx.Provider value={confirm}>
      {children}
      <Modal
        open={!!opts}
        onClose={() => close(false)}
        size="sm"
        hideClose
        footer={
          <>
            <Button onClick={() => close(false)}>Cancel</Button>
            <Button variant={opts?.tone === 'success' ? 'success' : danger ? 'danger' : 'primary'} disabled={!!opts?.note?.required && !note.trim()} onClick={() => close(true)}>
              {opts?.confirmLabel ?? 'Confirm'}
            </Button>
          </>
        }
      >
        {opts && (
          <div className="flex gap-4">
            <div className={cn('flex size-10 shrink-0 items-center justify-center rounded-full', danger ? 'bg-rose-50 text-rose-600' : 'bg-brand-50 text-brand-600')}>
              {danger ? <AlertTriangle size={20} /> : <HelpCircle size={20} />}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold text-slate-900">{opts.title}</h2>
              {opts.description && <div className="mt-1 text-sm text-slate-500">{opts.description}</div>}
              {opts.note && (
                <div className="mt-4">
                  <span className="mb-1.5 block text-[13px] font-medium text-slate-700">{opts.note.label}</span>
                  <Textarea autoFocus value={note} onChange={(e) => setNote(e.target.value)} placeholder={opts.note.placeholder} className="min-h-20" />
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </Ctx.Provider>
  )
}

export function useConfirm() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useConfirm outside provider')
  return v
}
