import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { IconButton } from './Button';

const FOCUSABLE = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Traps focus, closes on Escape, restores focus to the opener. */
function useDialogBehaviour(open: boolean, onClose: () => void, ref: React.RefObject<HTMLElement>) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const node = ref.current;
    const t = setTimeout(() => {
      const auto = node?.querySelector<HTMLElement>('[autofocus], [data-autofocus]');
      (auto ?? node?.querySelector<HTMLElement>(FOCUSABLE) ?? node)?.focus();
    }, 20);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); closeRef.current(); return; }
      if (e.key !== 'Tab' || !node) return;
      const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0]!; const last = items[items.length - 1]!;
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { clearTimeout(t); document.removeEventListener('keydown', onKey); document.body.style.overflow = prevOverflow; opener?.focus?.(); };
  }, [open, ref]);
}

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  role?: 'dialog' | 'alertdialog';
}

export function Modal({ open, onClose, title, description, children, footer, size = 'md', role = 'dialog' }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useDialogBehaviour(open, onClose, ref);
  if (!open) return null;
  const width = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }[size];
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-6">
      <div className="anim-fade absolute inset-0 bg-espresso/35 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div ref={ref} role={role} aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
        className={cn('anim-rise relative flex max-h-[92dvh] w-full flex-col rounded-t-3xl border border-line bg-cream shadow-[var(--shadow-lift)] sm:rounded-3xl', width)}>
        <header className="flex items-start justify-between gap-4 border-b border-line px-5 pb-4 pt-5 sm:px-6">
          <div>
            <h2 id={titleId} className="text-xl font-semibold text-espresso">{title}</h2>
            {description && <p className="mt-1 text-sm text-dust">{description}</p>}
          </div>
          <IconButton label="Close dialog" size="sm" onClick={onClose}><X className="size-4" /></IconButton>
        </header>
        <div className="scroll-thin overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-4 sm:px-6">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}

export function Drawer({ open, onClose, title, description, children, footer, width = 'max-w-xl' }: Omit<Props, 'size' | 'role'> & { width?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useDialogBehaviour(open, onClose, ref);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[70] flex justify-end">
      <div className="anim-fade absolute inset-0 bg-espresso/30" onClick={onClose} aria-hidden />
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
        className={cn('anim-drawer relative flex h-full w-full flex-col border-l border-line bg-cream shadow-[var(--shadow-lift)]', width)}>
        <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 id={titleId} className="truncate text-xl font-semibold text-espresso">{title}</h2>
            {description && <div className="mt-1 text-sm text-dust">{description}</div>}
          </div>
          <IconButton label="Close panel" size="sm" onClick={onClose}><X className="size-4" /></IconButton>
        </header>
        <div className="scroll-thin flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-4 sm:px-6">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}
