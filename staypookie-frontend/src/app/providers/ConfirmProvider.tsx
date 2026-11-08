import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

export interface ConfirmOptions {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
}
type ConfirmFn = (o: ConfirmOptions) => Promise<boolean>;
const Ctx = createContext<ConfirmFn | null>(null);

/** Promise-based replacement for window.confirm(). */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<(v: boolean) => void>();
  const confirm = useCallback<ConfirmFn>((o) => new Promise((resolve) => { resolver.current = resolve; setOpts(o); }), []);
  const close = (v: boolean) => { resolver.current?.(v); setOpts(null); };
  return (
    <Ctx.Provider value={confirm}>
      {children}
      <Modal open={!!opts} onClose={() => close(false)} title={opts?.title ?? ''} size="sm" role="alertdialog"
        footer={<>
          <Button variant="secondary" onClick={() => close(false)}>{opts?.cancelLabel ?? 'Cancel'}</Button>
          <Button variant={opts?.tone === 'danger' ? 'danger' : 'primary'} onClick={() => close(true)} autoFocus>{opts?.confirmLabel ?? 'Confirm'}</Button>
        </>}>
        <div className="text-sm leading-relaxed text-bark">{opts?.message}</div>
      </Modal>
    </Ctx.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const c = useContext(Ctx);
  if (!c) throw new Error('useConfirm must be used within ConfirmProvider');
  return c;
}
