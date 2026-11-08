import { forwardRef, useId, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { ChevronDown, Eye, EyeOff, Upload } from 'lucide-react';
import { cn } from '@/lib/cn';

interface FieldShell { label: string; error?: string; hint?: ReactNode; required?: boolean; hideLabel?: boolean; className?: string }

/** Label + control + hint/error wiring with aria-describedby. */
export function FormField({ label, error, hint, required, hideLabel, className, children, id }: FieldShell & { id: string; children: ReactNode }) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className={cn('text-[13px] font-medium text-bark', hideLabel && 'sr-only')}>
        {label}{required && <span className="ml-0.5 text-clay-600" aria-hidden>*</span>}
      </label>
      {children}
      {error ? <p id={`${id}-err`} className="text-xs font-medium text-brick" role="alert">{error}</p>
        : hint ? <p id={`${id}-hint`} className="text-xs text-dust">{hint}</p> : null}
    </div>
  );
}

const describedBy = (id: string, error?: string, hint?: ReactNode) => (error ? `${id}-err` : hint ? `${id}-hint` : undefined);

type InputProps = InputHTMLAttributes<HTMLInputElement> & FieldShell & { leading?: ReactNode; trailing?: ReactNode };
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ label, error, hint, required, hideLabel, className, leading, trailing, id: idProp, ...rest }, ref) {
  const auto = useId();
  const id = idProp ?? auto;
  return (
    <FormField id={id} label={label} error={error} hint={hint} required={required} hideLabel={hideLabel} className={className}>
      <div className="relative">
        {leading && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-dust">{leading}</span>}
        <input ref={ref} id={id} required={required} aria-invalid={!!error || undefined} aria-describedby={describedBy(id, error, hint)}
          className={cn('field-base', error && 'field-error', leading ? 'pl-10' : '', trailing ? 'pr-11' : '')} {...rest} />
        {trailing && <span className="absolute right-1.5 top-1/2 -translate-y-1/2">{trailing}</span>}
      </div>
    </FormField>
  );
});

export const PasswordInput = forwardRef<HTMLInputElement, Omit<InputProps, 'type' | 'trailing'>>(function PasswordInput(props, ref) {
  const [show, setShow] = useState(false);
  return (
    <Input ref={ref} type={show ? 'text' : 'password'} {...props}
      trailing={
        <button type="button" onClick={() => setShow((s) => !s)} className="rounded-lg p-2 text-dust hover:text-espresso" aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show}>
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      } />
  );
});

export interface Option { value: string; label: string; disabled?: boolean }
type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & FieldShell & { options: Option[]; placeholder?: string };
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select({ label, error, hint, required, hideLabel, className, options, placeholder, id: idProp, ...rest }, ref) {
  const auto = useId();
  const id = idProp ?? auto;
  return (
    <FormField id={id} label={label} error={error} hint={hint} required={required} hideLabel={hideLabel} className={className}>
      <div className="relative">
        <select ref={ref} id={id} required={required} aria-invalid={!!error || undefined} aria-describedby={describedBy(id, error, hint)}
          className={cn('field-base appearance-none pr-9', error && 'field-error')} {...rest}>
          {placeholder !== undefined && <option value="">{placeholder}</option>}
          {options.map((o) => <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>)}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-dust" aria-hidden />
      </div>
    </FormField>
  );
});

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & FieldShell;
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea({ label, error, hint, required, hideLabel, className, id: idProp, rows = 4, ...rest }, ref) {
  const auto = useId();
  const id = idProp ?? auto;
  return (
    <FormField id={id} label={label} error={error} hint={hint} required={required} hideLabel={hideLabel} className={className}>
      <textarea ref={ref} id={id} rows={rows} required={required} aria-invalid={!!error || undefined} aria-describedby={describedBy(id, error, hint)}
        className={cn('field-base resize-y leading-relaxed', error && 'field-error')} {...rest} />
    </FormField>
  );
});

export function Checkbox({ label, description, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; description?: ReactNode }) {
  const id = useId();
  return (
    <div className={cn('flex items-start gap-3', className)}>
      <input id={id} type="checkbox" className="mt-0.5 size-4 shrink-0 rounded border-line-strong accent-clay-600" {...rest} />
      <label htmlFor={id} className="text-sm text-espresso">
        {label}
        {description && <span className="block text-xs text-dust">{description}</span>}
      </label>
    </div>
  );
}

export function Switch({ checked, onChange, label, description, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string; disabled?: boolean }) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div>
        <label htmlFor={id} className="text-sm font-medium text-espresso">{label}</label>
        {description && <p className="text-xs text-dust">{description}</p>}
      </div>
      <button id={id} role="switch" type="button" aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)}
        className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors', checked ? 'bg-clay-600' : 'bg-line-strong')}>
        <span className={cn('absolute left-0 top-0.5 size-5 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-[22px]' : 'translate-x-0.5')} />
      </button>
    </div>
  );
}

export function RadioGroup<T extends string>({ label, name, value, onChange, options, error, className, inline }: {
  label: string; name: string; value: T; onChange: (v: T) => void; options: Array<{ value: T; label: string; description?: string }>; error?: string; className?: string; inline?: boolean;
}) {
  return (
    <fieldset className={cn('flex flex-col gap-2', className)}>
      <legend className="mb-1.5 text-[13px] font-medium text-bark">{label}</legend>
      <div className={cn('flex gap-2', inline ? 'flex-wrap' : 'flex-col')}>
        {options.map((o) => (
          <label key={o.value} className={cn('flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2 text-sm transition-colors', value === o.value ? 'border-clay-400 bg-clay-50' : 'border-line bg-white/70 hover:border-line-strong')}>
            <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} className="mt-0.5 accent-clay-600" />
            <span>{o.label}{o.description && <span className="block text-xs text-dust">{o.description}</span>}</span>
          </label>
        ))}
      </div>
      {error && <p className="text-xs font-medium text-brick" role="alert">{error}</p>}
    </fieldset>
  );
}

/** File picker UI. Files are never uploaded; only name/size are passed to the mock service. */
export function FilePicker({ label, accept, onPick, hint, error, multiple, disabled }: { label: string; accept?: string; onPick: (files: File[]) => void; hint?: string; error?: string; multiple?: boolean; disabled?: boolean }) {
  const id = useId();
  const [drag, setDrag] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); if (!disabled) onPick(Array.from(e.dataTransfer.files)); }}
        className={cn('flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed px-4 py-5 text-center text-sm transition-colors',
          drag ? 'border-clay-500 bg-clay-50' : 'border-line-strong bg-white/60 hover:bg-white', error && 'border-brick', disabled && 'pointer-events-none opacity-60')}>
        <Upload className="size-5 text-clay-600" aria-hidden />
        <span className="font-medium text-espresso">{label}</span>
        {hint && <span className="text-xs text-dust">{hint}</span>}
        <input id={id} type="file" accept={accept} multiple={multiple} disabled={disabled} className="sr-only" onChange={(e) => { onPick(Array.from(e.target.files ?? [])); e.target.value = ''; }} />
      </label>
      {error && <p className="text-xs font-medium text-brick" role="alert">{error}</p>}
    </div>
  );
}
