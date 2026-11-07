import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Building2, ChartColumn, Eye, EyeOff, Leaf, LockKeyhole, Mail, UserRound, Users } from 'lucide-react';
import { errorMessage, isServiceError } from '@/services/errors';
import { roleHome, useSession } from '@/app/providers/SessionProvider';
import { useToast } from '@/app/providers/ToastProvider';
import { useDocumentTitle } from '@/hooks/misc';
import { rules, validate } from '@/lib/validation';
import type { Role } from '@/types/domain';
import './login-page.css';

const ROLE_OPTIONS: Array<{ value: Role; label: string; Icon: typeof Building2 }> = [
  { value: 'manager', label: 'Manager', Icon: Building2 },
  { value: 'student', label: 'Student', Icon: Users },
  { value: 'owner', label: 'Owner', Icon: UserRound },
];

function Brand({ centered = false }: { centered?: boolean }) {
  return (
    <div className={`lp-brand ${centered ? 'lp-brand-centered' : ''}`}>
      <svg className="lp-brand-mark" viewBox="0 0 70 48" aria-hidden="true">
        <path d="M4 40 35 8 66 40H48L35 26 22 40Z" fill="currentColor" />
        <path d="M24 40 35 29 46 40Z" fill="#f8eee5" />
      </svg>
      <div className="lp-brand-copy">
        <div className="lp-brand-name">StayPookie</div>
        <div className="lp-brand-sub">Hostel Management</div>
      </div>
    </div>
  );
}

export function LoginPage() {
  useDocumentTitle('Sign in');
  const { loginWithPassword } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const [role, setRole] = useState<Role>('manager');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

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

  return (
    <div className="login-page-root">
      <main className="lp-shell">
        <div className="lp-campus-bg" aria-hidden="true" />
        <div className="lp-bottom-blur" aria-hidden="true" />

        <section className="lp-intro">
          <Brand />
          <div className="lp-intro-copy">
            <h1>
              <span>Simpler</span><br />Hostel Management<br />for a <em>Better Tomorrow</em>
            </h1>
            <p>Students. Rooms. Operations.<br />All in one place.</p>
            <div className="lp-rule" />
          </div>
          <ul className="lp-features">
            {[
              { Icon: Building2, top: 'Manage', bottom: 'Properties' },
              { Icon: Users, top: 'Keep', bottom: 'Students Aligned' },
              { Icon: ChartColumn, top: 'Real-time', bottom: 'Visibility' },
            ].map(({ Icon, top, bottom }) => (
              <li key={bottom}>
                <span aria-hidden="true"><Icon /></span>
                <p>{top}<br />{bottom}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="lp-card" aria-labelledby="lp-title">
          <Leaf className="lp-leaf" strokeWidth={0.7} aria-hidden="true" />
          <Brand centered />
          <h2 id="lp-title">Welcome Back</h2>
          <p className="lp-subtitle">Sign in to continue to your account</p>

          <form onSubmit={submit} noValidate>
            <div className="lp-role-switch" role="radiogroup" aria-label="Sign in as">
              {ROLE_OPTIONS.map(({ value, label, Icon }) => (
                <button key={value} type="button" role="radio" aria-checked={role === value}
                  className={`lp-role-option ${role === value ? 'active' : ''}`}
                  onClick={() => { setRole(value); setFormError(null); }}>
                  <Icon aria-hidden="true" />
                  <span>{label}</span>
                </button>
              ))}
            </div>

            <label htmlFor="lp-identifier">Email or phone number</label>
            <div className={`lp-field ${errors.identifier ? 'has-error' : ''}`}>
              <Mail aria-hidden="true" />
              <input id="lp-identifier" name="identifier" autoComplete="username" inputMode="email"
                placeholder="Enter your email or phone number" value={identifier} required
                aria-invalid={!!errors.identifier} aria-describedby={errors.identifier ? 'lp-identifier-error' : undefined}
                onChange={(e) => { setIdentifier(e.target.value); setErrors((x) => ({ ...x, identifier: '' })); }} />
              <span className="lp-field-spacer" />
            </div>
            {errors.identifier && <p id="lp-identifier-error" className="lp-field-error">{errors.identifier}</p>}

            <label htmlFor="lp-password">Password</label>
            <div className={`lp-field ${errors.password ? 'has-error' : ''}`}>
              <LockKeyhole aria-hidden="true" />
              <input id="lp-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password"
                placeholder="Enter your password" value={password} required
                aria-invalid={!!errors.password} aria-describedby={errors.password ? 'lp-password-error' : undefined}
                onChange={(e) => { setPassword(e.target.value); setErrors((x) => ({ ...x, password: '' })); }} />
              <button className="lp-icon-button" type="button" onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword}>
                {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
              </button>
            </div>
            {errors.password && <p id="lp-password-error" className="lp-field-error">{errors.password}</p>}

            <div className="lp-options-row">
              <label className="lp-remember">
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                Remember me
              </label>
              <Link to="/forgot-password" className="lp-text-link">Forgot password?</Link>
            </div>

            {formError && <p role="alert" className="lp-form-error">{formError}</p>}

            <button className="lp-login-button" type="submit" disabled={pending} aria-busy={pending}>
              <span>{pending ? 'Signing in…' : 'Sign in'}</span>
              <ArrowRight aria-hidden="true" />
            </button>
          </form>

          <p className="lp-signup-note">
            Don’t have an account? <Link to="/help#contact" className="lp-text-link">Contact your hostel admin</Link>
          </p>
        </section>
      </main>
    </div>
  );
}