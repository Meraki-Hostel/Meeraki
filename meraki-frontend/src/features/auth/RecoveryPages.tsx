import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Clock3, KeyRound, Mail, ShieldAlert } from 'lucide-react';
import { services } from '@/services';
import { errorMessage, isServiceError } from '@/services/errors';
import type { Invitation } from '@/types/domain';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Checkbox, Input, PasswordInput } from '@/components/ui/Field';
import { Skeleton } from '@/components/ui/States';
import { passwordStrength, rules, validate } from '@/lib/validation';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/cn';
import { AuthHeading, AuthLayout } from './AuthLayout';

function StatusPanel({ icon, tone, title, message, children }: { icon: JSX.Element; tone: 'moss' | 'brick' | 'amber'; title: string; message: React.ReactNode; children?: React.ReactNode }) {
  const t = { moss: 'bg-moss-wash text-moss', brick: 'bg-brick-wash text-brick', amber: 'bg-amber-wash text-amber' }[tone];
  return (
    <div className="flex flex-col items-center text-center" role="status">
      <span className={cn('mb-4 grid size-14 place-items-center rounded-full', t)} aria-hidden>{icon}</span>
      <h2 className="font-display text-[26px] font-semibold">{title}</h2>
      <p className="mt-2 text-[15px] leading-relaxed text-dust">{message}</p>
      <div className="mt-6 flex w-full flex-col gap-2">{children}</div>
    </div>
  );
}

function StrengthMeter({ password }: { password: string }) {
  const { score, label } = passwordStrength(password);
  if (!password) return null;
  const color = ['bg-brick', 'bg-brick', 'bg-amber', 'bg-moss', 'bg-moss'][score];
  return (
    <div className="-mt-1" aria-live="polite">
      <div className="flex gap-1" aria-hidden>{[0, 1, 2, 3].map((i) => <span key={i} className={cn('h-1 flex-1 rounded-full', i < score ? color : 'bg-line')} />)}</div>
      <p className="mt-1 text-xs text-dust">Strength: {label}. Use 8+ characters with a number and a symbol.</p>
    </div>
  );
}

export function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState('');
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const v = validate({ identifier }, { identifier: [rules.required('Email or phone number'), rules.emailOrPhone()] });
    setError(v.identifier);
    if (v.identifier) return;
    setPending(true);
    try { setSent((await services.auth.requestPasswordReset(identifier)).maskedDestination); }
    catch (err) { setError(isServiceError(err) ? err.fieldErrors?.identifier ?? err.message : errorMessage(err)); }
    finally { setPending(false); }
  };

  return (
    <AuthLayout title="Forgot password">
      {sent ? (
        <StatusPanel icon={<Mail className="size-6" />} tone="moss" title="Check your inbox"
          message={<>If an account exists for that address, a reset link has been sent to <strong className="text-espresso">{sent}</strong>.</>}>
          <ButtonLink to="/login" variant="ghost">Back to sign in</ButtonLink>
        </StatusPanel>
      ) : (
        <>
          <AuthHeading title="Reset your password" subtitle="Enter the email or phone number on your account and we’ll send a reset link." />
          <form onSubmit={submit} noValidate className="space-y-4">
            <Input label="Email or phone number" autoComplete="username" leading={<Mail className="size-4" />} placeholder="e.g. anita.desai@merakiliving.example" value={identifier} onChange={(e) => { setIdentifier(e.target.value); setError(undefined); }} error={error} required />
            <Button type="submit" size="lg" className="w-full" loading={pending}>Send reset link</Button>
            <p className="text-center text-sm"><Link to="/login" className="font-medium text-clay-700 hover:underline">Back to sign in</Link></p>
          </form>
        </>
      )}
    </AuthLayout>
  );
}

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [state, setState] = useState<'form' | 'done' | 'expired'>(!token || token === 'expired' ? 'expired' : 'form');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const v: Record<string, string> = {};
    if (pw.length < 8) v.password = 'Password must be at least 8 characters';
    else if (passwordStrength(pw).score < 2) v.password = 'Add a number or symbol to make it stronger';
    if (pw2 !== pw) v.confirm = 'Passwords do not match';
    setErrors(v);
    if (Object.keys(v).length) return;
    setPending(true);
    try { await services.auth.resetPassword(token!, pw); setState('done'); }
    catch (err) { if (isServiceError(err) && err.code === 'EXPIRED') setState('expired'); else setErrors({ password: errorMessage(err) }); }
    finally { setPending(false); }
  };

  return (
    <AuthLayout title="Choose a new password">
      {state === 'expired' && (
        <StatusPanel icon={<Clock3 className="size-6" />} tone="amber" title="Link expired or invalid" message="Reset links are valid for 30 minutes and can be used once. Request a fresh link to continue.">
          <ButtonLink to="/forgot-password" size="lg">Request a new link</ButtonLink>
          <ButtonLink to="/login" variant="ghost">Back to sign in</ButtonLink>
        </StatusPanel>
      )}
      {state === 'done' && (
        <StatusPanel icon={<CheckCircle2 className="size-6" />} tone="moss" title="Password updated" message="Your password has been changed. Sign in with it now.">
          <ButtonLink to="/login" size="lg">Go to sign in</ButtonLink>
        </StatusPanel>
      )}
      {state === 'form' && (
        <>
          <AuthHeading title="Choose a new password" subtitle="Your new password replaces the old one on all devices." />
          <form onSubmit={submit} noValidate className="space-y-4">
            <PasswordInput label="New password" autoComplete="new-password" leading={<KeyRound className="size-4" />} value={pw} onChange={(e) => setPw(e.target.value)} error={errors.password} required />
            <StrengthMeter password={pw} />
            <PasswordInput label="Confirm new password" autoComplete="new-password" leading={<KeyRound className="size-4" />} value={pw2} onChange={(e) => setPw2(e.target.value)} error={errors.confirm} required />
            <Button type="submit" size="lg" className="w-full" loading={pending}>Update password</Button>
            <p className="text-center text-xs text-dust">Testing? <Link className="underline" to="/reset-password?token=expired">See the expired-link state</Link></p>
          </form>
        </>
      )}
    </AuthLayout>
  );
}

export function InviteAcceptPage() {
  const [params, setParams] = useSearchParams();
  const token = params.get('token');
  const navigate = useNavigate();
  const [inv, setInv] = useState<Invitation | null>(null);
  const [state, setState] = useState<'loading' | 'valid' | 'invalid' | 'expired' | 'used' | 'done' | 'none'>(token ? 'loading' : 'none');
  const [message, setMessage] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [agree, setAgree] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [code, setCode] = useState('');

  useEffect(() => {
    if (!token) { setState('none'); return; }
    setState('loading');
    services.auth.getInvitation(token).then((i) => { setInv(i); setState('valid'); }).catch((err) => {
      setMessage(errorMessage(err));
      setState(isServiceError(err) ? (err.code === 'EXPIRED' ? 'expired' : err.code === 'CONFLICT' ? 'used' : 'invalid') : 'invalid');
    });
  }, [token]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const v: Record<string, string> = {};
    if (pw.length < 8) v.password = 'Password must be at least 8 characters';
    if (pw2 !== pw) v.confirm = 'Passwords do not match';
    if (!agree) v.agree = 'Accept the house rules and privacy terms to continue';
    setErrors(v);
    if (Object.keys(v).length) return;
    setPending(true);
    try { await services.auth.acceptInvitation(token!, pw); setState('done'); }
    catch (err) { setErrors({ password: errorMessage(err) }); }
    finally { setPending(false); }
  };

  return (
    <AuthLayout title="Accept invitation">
      {state === 'none' && (
        <>
          <AuthHeading title="Accept your invitation" subtitle="Enter the code from your invitation email or SMS." />
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (code.trim()) setParams({ token: code.trim() }); else setErrors({ code: 'Enter your invitation code' }); }} noValidate>
            <Input label="Invitation code" value={code} onChange={(e) => { setCode(e.target.value); setErrors({}); }} error={errors.code}  required />
            <Button type="submit" size="lg" className="w-full">Continue</Button>
          </form>
        </>
      )}
      {state === 'loading' && <div className="space-y-3" aria-busy="true"><Skeleton className="mx-auto h-8 w-2/3" /><Skeleton className="h-11" /><Skeleton className="h-11" /><Skeleton className="h-12" /></div>}
      {(state === 'invalid' || state === 'expired' || state === 'used') && (
        <StatusPanel icon={<ShieldAlert className="size-6" />} tone={state === 'used' ? 'amber' : 'brick'}
          title={state === 'expired' ? 'Invitation expired' : state === 'used' ? 'Already accepted' : 'Invitation not found'}
          message={state === 'invalid' ? 'Check the link in your invitation, or ask your hostel admin to resend it.' : message}>
          <ButtonLink to="/login" size="lg">Go to sign in</ButtonLink>
          <ButtonLink to="/invite/accept" variant="ghost">Enter a different code</ButtonLink>
        </StatusPanel>
      )}
      {state === 'done' && (
        <StatusPanel icon={<CheckCircle2 className="size-6" />} tone="moss" title="You’re all set" message={`${inv?.name}, your account is active. Sign in with your email and the password you just chose.`}>
          <Button size="lg" onClick={() => navigate('/login')}>Continue to sign in</Button>
        </StatusPanel>
      )}
      {state === 'valid' && inv && (
        <>
          <AuthHeading title={`Welcome, ${inv.name.split(' ')[0]}`} subtitle={`${inv.invitedBy} invited you to join Meraki as ${inv.role === 'staff' ? 'staff' : inv.role}. Create a password to activate your account.`} />
          <div className="mb-4 rounded-xl border border-line bg-white/60 px-4 py-3 text-sm">
            <p className="text-dust">Signing up as</p>
            <p className="font-medium text-espresso">{inv.email}</p>
            <p className="mt-1 text-xs text-dust">Invitation valid until {formatDate(inv.expiresAt)}</p>
          </div>
          <form onSubmit={submit} noValidate className="space-y-4">
            <PasswordInput label="Create password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} error={errors.password} required />
            <StrengthMeter password={pw} />
            <PasswordInput label="Confirm password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} error={errors.confirm} required />
            <div>
              <Checkbox label="I accept the house rules and privacy terms" checked={agree} onChange={(e) => { setAgree(e.target.checked); setErrors((x) => ({ ...x, agree: '' })); }} />
              {errors.agree && <p className="mt-1 text-xs font-medium text-brick" role="alert">{errors.agree}</p>}
            </div>
            <Button type="submit" size="lg" className="w-full" loading={pending}>Activate account</Button>
          </form>
        </>
      )}
    </AuthLayout>
  );
}
