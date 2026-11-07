import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft';
export type ButtonSize = 'sm' | 'md' | 'lg';

const base = 'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-medium transition-colors focus-visible:outline-2 disabled:opacity-55 disabled:pointer-events-none select-none';
const variants: Record<ButtonVariant, string> = {
  primary: 'bg-clay-600 text-white shadow-sm hover:bg-clay-700 active:bg-clay-800',
  secondary: 'border border-line bg-cream text-espresso hover:border-line-strong hover:bg-white',
  ghost: 'text-bark hover:bg-sand/70 hover:text-espresso',
  danger: 'bg-brick text-white hover:bg-[#963a32]',
  soft: 'bg-clay-50 text-clay-700 hover:bg-clay-100',
};
const sizes: Record<ButtonSize, string> = { sm: 'h-8 px-3 text-[13px]', md: 'h-10 px-4 text-sm', lg: 'h-12 px-5 text-[15px]' };

export const buttonClass = (variant: ButtonVariant = 'primary', size: ButtonSize = 'md', className?: string) => cn(base, variants[variant], sizes[size], className);

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'primary', size = 'md', loading, icon, className, children, disabled, type = 'button', ...rest }, ref,
) {
  return (
    <button ref={ref} type={type} className={buttonClass(variant, size, className)} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
});

export function ButtonLink({ variant = 'primary', size = 'md', className, icon, children, ...rest }: LinkProps & { variant?: ButtonVariant; size?: ButtonSize; icon?: ReactNode }) {
  return <Link className={buttonClass(variant, size, className)} {...rest}>{icon}{children}</Link>;
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> { label: string; size?: 'sm' | 'md' }
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton({ label, size = 'md', className, children, type = 'button', ...rest }, ref) {
  return (
    <button ref={ref} type={type} aria-label={label} title={label}
      className={cn('inline-flex shrink-0 items-center justify-center rounded-xl text-bark transition-colors hover:bg-sand/80 hover:text-espresso disabled:opacity-50', size === 'sm' ? 'size-8' : 'size-10', className)} {...rest}>
      {children}
    </button>
  );
});
