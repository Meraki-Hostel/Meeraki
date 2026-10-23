import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '../../lib/utils'

function useLockAndEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])
}

export function Modal({ open, onClose, title, description, children, footer, size = 'md', hideClose }: {
  open: boolean
  onClose: () => void
  title?: ReactNode
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  hideClose?: boolean
}) {
  useLockAndEscape(open, onClose)
  if (!open) return null
  const w = { sm: 'sm:max-w-md', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl', xl: 'sm:max-w-4xl' }[size]
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div className="absolute inset-0 animate-fade-in bg-slate-900/40 backdrop-blur-[2px]" onClick={onClose} />
      <div role="dialog" aria-modal="true" className={cn('relative flex max-h-[92dvh] w-full animate-slide-up flex-col rounded-t-3xl bg-white shadow-pop sm:rounded-3xl', w)}>
        {(title || !hideClose) && (
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
            <div className="min-w-0">
              {title && <h2 className="text-base font-semibold text-slate-900">{title}</h2>}
              {description && <p className="mt-0.5 text-[13px] text-slate-500">{description}</p>}
            </div>
            {!hideClose && (
              <button onClick={onClose} className="-mt-1 -mr-2 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close">
                <X size={18} />
              </button>
            )}
          </div>
        )}
        <div className="scrollbar-thin flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        {footer && <div className="pb-safe flex flex-col-reverse gap-2 border-t border-slate-100 px-5 py-3.5 sm:flex-row sm:justify-end sm:px-6">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

export function Drawer({ open, onClose, title, description, children, footer, width = 'md', headerExtra }: {
  open: boolean
  onClose: () => void
  title?: ReactNode
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  width?: 'md' | 'lg'
  headerExtra?: ReactNode
}) {
  useLockAndEscape(open, onClose)
  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 animate-fade-in bg-slate-900/30" onClick={onClose} />
      <aside className={cn('relative flex h-full w-full animate-slide-in-right flex-col bg-white shadow-pop', width === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-lg')}>
        <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              {title && <h2 className="text-base font-semibold text-slate-900">{title}</h2>}
              {description && <div className="mt-0.5 text-[13px] text-slate-500">{description}</div>}
            </div>
            <button onClick={onClose} className="-mt-1 -mr-2 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close">
              <X size={18} />
            </button>
          </div>
          {headerExtra}
        </div>
        <div className="scrollbar-thin flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        {footer && <div className="pb-safe flex flex-wrap justify-end gap-2 border-t border-slate-100 px-5 py-3.5 sm:px-6">{footer}</div>}
      </aside>
    </div>,
    document.body,
  )
}
