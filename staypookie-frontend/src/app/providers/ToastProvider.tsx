import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';
import { cn } from '@/lib/cn';

type Tone = 'success' | 'error' | 'info';
interface Toast { id: number; tone: Tone; message: string; title?: string }
interface ToastApi {
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
}

const Ctx = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);
  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback((tone: Tone, message: string, title?: string) => {
    const id = ++seq.current;
    setToasts((t) => [...t.slice(-3), { id, tone, message, title }]);
    setTimeout(() => dismiss(id), tone === 'error' ? 6000 : 4000);
  }, [dismiss]);
  const api = useMemo<ToastApi>(() => ({
    success: (m, t) => push('success', m, t), error: (m, t) => push('error', m, t), info: (m, t) => push('info', m, t),
  }), [push]);

  const icon = { success: CheckCircle2, error: TriangleAlert, info: Info };
  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[80] flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-5 sm:items-end" role="region" aria-label="Notifications">
        {toasts.map((t) => {
          const Icon = icon[t.tone];
          return (
            <div key={t.id} role={t.tone === 'error' ? 'alert' : 'status'} aria-live={t.tone === 'error' ? 'assertive' : 'polite'}
              className="anim-toast pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border border-line bg-cream px-4 py-3 shadow-[var(--shadow-lift)]">
              <Icon className={cn('mt-0.5 size-5 shrink-0', t.tone === 'success' && 'text-moss', t.tone === 'error' && 'text-brick', t.tone === 'info' && 'text-slate-ink')} aria-hidden />
              <div className="min-w-0 flex-1 text-sm">
                {t.title && <p className="font-semibold text-espresso">{t.title}</p>}
                <p className="text-bark">{t.message}</p>
              </div>
              <button onClick={() => dismiss(t.id)} className="rounded-md p-0.5 text-dust hover:text-espresso" aria-label="Dismiss notification"><X className="size-4" /></button>
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}

export function useToast(): ToastApi {
  const c = useContext(Ctx);
  if (!c) throw new Error('useToast must be used within ToastProvider');
  return c;
}
