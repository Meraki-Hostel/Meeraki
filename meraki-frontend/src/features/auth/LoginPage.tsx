import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Building2, Lock, Mail, UserRound, Users } from 'lucide-react';
import { services } from '@/services';
import type { PersonaSummary } from '@/services/interfaces';
import { errorMessage, isServiceError } from '@/services/errors';
import { roleHome, useSession } from '@/app/providers/SessionProvider';
import { useToast } from '@/app/providers/ToastProvider';
import { Button } from '@/components/ui/Button';
import { Checkbox, Input, PasswordInput } from '@/components/ui/Field';
import { SegmentedControl } from '@/components/ui/Tabs';
import { Avatar } from '@/components/ui/Avatar';
import { rules, validate } from '@/lib/validation';
import type { Role } from '@/types/domain';
import { AuthHeading, AuthLayout } from './AuthLayout';

const ROLE_OPTIONS: Array<{ value: Role; label: string; icon: JSX.Element }> = [
  { value: 'manager', label: 'Manager', icon: <Building2 className="size-4" aria-hidden /> },
  { value: 'student', label: 'Student', icon: <Users className="size-4" aria-hidden /> },
  { value: 'owner', label: 'Owner', icon: <UserRound className="size-4" aria-hidden /> },
];
const DEMO_PASSWORD_HINT = 'meraki@123';

export function LoginPage() {
  const { loginWithPassword, loginAsPersona } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const [role, setRole] = useState<Role>('manager');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [personaPending, setPersonaPending] = useState<string | null>(null);
  const [personas, setPersonas] = useState<PersonaSummary[]>([]);

  useEffect(() => { void services.auth.listPersonas().then(setPersonas); }, []);

  const from = (location.state as { from?: string } | null)?.from;
  const finish = (r: Role) => {
    const prefix = `/${r}/`;
    navigate(from && (from.startsWith(prefix) || ['/notifications', '/profile', '/help'].some((p) => from.startsWith(p))) ? from : roleHome(r), { replace: true });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const v = validate({ identifier, password }, { identifier: [rules.required('Email or phone number'), rules.emailOrPhone()], password: [rules.required('Password')] });
    setErrors(v as Record<string, string>);
    if (Object.keys(v).length) return;
    setPending(true);
    try {
      const s = await loginWithPassword({ role, identifier, password, remember });
      toast.success(`Welcome back, ${s.user.name.split(' ')[0]}.`);
      finish(s.user.role);
    } catch (err) {
      if (isServiceError(err) && err.fieldErrors) setErrors(err.fieldErrors);
      setFormError(errorMessage(err));
    } finally { setPending(false); }
  };

  const demo = async (p: PersonaSummary) => {
    setPersonaPending(p.user.id);
    try { const s = await loginAsPersona(p.user.id); finish(s.user.role); } catch (err) { toast.error(errorMessage(err)); } finally { setPersonaPending(null); }
  };

  const fillDemo = () => {
    const p = personas.find((x) => x.user.role === role);
    if (!p) return;
    setIdentifier(p.user.email);
    setPassword(DEMO_PASSWORD_HINT);
    setErrors({});
  };

  return (
    <AuthLayout title="Sign in">
      <AuthHeading title="Welcome back" subtitle="Sign in to continue to your account" />
      <form onSubmit={submit} noValidate className="space-y-4">
        <div className="flex justify-center">
          <SegmentedControl label="Sign in as" value={role} onChange={(r) => { setRole(r); setFormError(null); }} options={ROLE_OPTIONS} />
        </div>
        <Input label="Email or phone number" name="identifier" autoComplete="username" inputMode="email" placeholder="Enter your email or phone number"
          leading={<Mail className="size-4" />} value={identifier} onChange={(e) => { setIdentifier(e.target.value); setErrors((x) => ({ ...x, identifier: '' })); }} error={errors.identifier} required />
        <PasswordInput label="Password" name="password" autoComplete="current-password" placeholder="Enter your password"
          leading={<Lock className="size-4" />} value={password} onChange={(e) => { setPassword(e.target.value); setErrors((x) => ({ ...x, password: '' })); }} error={errors.password} required />
        <div className="flex items-center justify-between gap-3">
          <Checkbox label="Remember me" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          <Link to="/forgot-password" className="text-sm font-medium text-clay-700 hover:underline">Forgot password?</Link>
        </div>
        {formError && <p role="alert" className="rounded-xl border border-brick/25 bg-brick-wash px-3 py-2 text-sm text-brick">{formError}</p>}
        <Button type="submit" size="lg" className="w-full" loading={pending}>Sign in <ArrowRight className="size-4" aria-hidden /></Button>
        <button type="button" onClick={fillDemo} className="block w-full text-center text-xs text-dust hover:text-espresso">
          Use demo credentials for <span className="font-medium text-bark">{ROLE_OPTIONS.find((r) => r.value === role)?.label}</span>
        </button>
      </form>

      <div className="my-5 flex items-center gap-3 text-xs text-mute"><span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" /></div>
      <Button variant="secondary" size="lg" className="w-full" onClick={() => toast.info('Google sign-in is not connected in this demo. Use a demo account below.', 'Demo only')}>
        <span className="grid size-5 place-items-center rounded-full border border-line font-display text-[13px] font-bold text-slate-ink" aria-hidden>G</span>
        Continue with Google
      </Button>

      <section className="mt-6 rounded-2xl border border-line bg-white/50 p-3" aria-labelledby="demo-heading">
        <h3 id="demo-heading" className="px-1 pb-2 text-[13px] font-semibold text-bark">Explore with a demo account</h3>
        <ul className="grid gap-1.5">
          {personas.map((p) => (
            <li key={p.user.id}>
              <button type="button" onClick={() => void demo(p)} disabled={!!personaPending}
                className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-sand/70 disabled:opacity-60">
                <Avatar name={p.user.name} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-espresso">{p.user.name}</span>
                  <span className="block truncate text-xs text-dust">{p.subtitle}</span>
                </span>
                <span className="text-xs font-medium text-clay-700">{personaPending === p.user.id ? 'Opening…' : 'Enter'}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-5 text-center text-sm text-dust">
        Don’t have an account? <Link to="/help#contact" className="font-medium text-clay-700 hover:underline">Contact your hostel admin</Link>
        <br />Got an invitation? <Link to="/invite/accept?token=demo-invite-2026" className="font-medium text-clay-700 hover:underline">Accept it here</Link>
      </p>
    </AuthLayout>
  );
}
