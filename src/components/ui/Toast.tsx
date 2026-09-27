import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'
import { cn } from '../../lib/utils'

type Kind = 'success' | 'error' | 'info'
interface ToastItem {
  id: number
  kind: Kind
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
}

type Api = Record<Kind, (title: string, opts?: { description?: string; action?: ToastItem['action'] }) => void>
const Ctx = createContext<Api | null>(null)
let seq = 1

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const dismiss = useCallback((id: number) => setItems((l) => l.filter((t) => t.id !== id)), [])
  const push = useCallback(
    (kind: Kind) => (title: string, opts?: { description?: string; action?: ToastItem['action'] }) => {
      const id = seq++
      setItems((l) => [...l.slice(-3), { id, kind, title, ...opts }])
      setTimeout(() => dismiss(id), opts?.action ? 6500 : 4000)
    },
    [dismiss],
  )
  const api = useMemo<Api>(() => ({ success: push('success'), error: push('error'), info: push('info') }), [push])
  return (
    <Ctx.Provider value={api}>
      {children}
      {createPortal(
        <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[70] flex flex-col items-center gap-2 px-4 md:right-6 md:bottom-6 md:left-auto md:items-end">
          {items.map((t) => {
            const Icon = t.kind === 'success' ? CheckCircle2 : t.kind === 'error' ? AlertCircle : Info
            return (
              <div key={t.id} role="status" className="pointer-events-auto flex w-full max-w-sm animate-toast-in items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-pop">
                <Icon size={18} className={cn('mt-px shrink-0', t.kind === 'success' ? 'text-emerald-600' : t.kind === 'error' ? 'text-rose-600' : 'text-brand-600')} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900">{t.title}</p>
                  {t.description && <p className="mt-0.5 text-[13px] text-slate-500">{t.description}</p>}
                  {t.action && (
                    <button
                      className="mt-1.5 text-[13px] font-semibold text-brand-700 hover:text-brand-800"
                      onClick={() => {
                        t.action!.onClick()
                        dismiss(t.id)
                      }}
                    >
                      {t.action.label}
                    </button>
                  )}
                </div>
                <button onClick={() => dismiss(t.id)} className="-mr-1 rounded p-0.5 text-slate-400 hover:text-slate-700" aria-label="Dismiss">
                  <X size={14} />
                </button>
              </div>
            )
          })}
        </div>,
        document.body,
      )}
    </Ctx.Provider>
  )
}

export function useToast() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useToast outside provider')
  return v
}
