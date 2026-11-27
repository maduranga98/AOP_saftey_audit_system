import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { isValidEmail, isValidEmpNo, isValidPin, normalizeEmpNo, PIN_LENGTH } from '@/lib/identity';
import { PORTALS, type Portal, type Role } from '@/types';
import { Alert, Button, Field, FullScreenSpinner, Input } from '@/components/ui';
import { ShieldIcon } from '@/components/icons';
import { useOnline } from '@/hooks/useOnline';
import { useSetupStatus } from '@/hooks/useSetupStatus';

function authMessage(code: string | undefined, method: 'pin' | 'email'): string {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-email':
      return method === 'pin' ? 'Employee number or PIN is wrong.' : 'Email or password is wrong.';
    case 'auth/user-disabled':
      return 'This account is switched off. Contact the safety officer.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a few minutes and try again.';
    case 'auth/network-request-failed':
      return 'No connection. The first sign-in on a device needs internet.';
    default:
      return 'Could not sign in. Try again.';
  }
}

function Shell({ subtitle, children }: { subtitle: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900">
            <ShieldIcon className="text-green-400" width={26} height={26} />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">AOP Safety Audit</h1>
          <p className="text-sm text-slate-500">{subtitle}</p>
        </div>
        {children}
      </div>
    </div>
  );
}

/**
 * Safety officer link (/admin) signs in with email + password.
 * Auditor (/audit) and area owner/manager (/area) links sign in with employee number + PIN.
 * A safety officer who also audits can switch the staff links to email.
 */
export default function Login({ portal }: { portal: Portal }) {
  const { user, roles, loading, signIn, signInWithEmail, sendPasswordReset, signOut } = useAuth();
  const navigate = useNavigate();
  const online = useOnline();
  const target = PORTALS[portal];
  const [method, setMethod] = useState<'pin' | 'email'>(portal === 'admin' ? 'email' : 'pin');
  const [empNo, setEmpNo] = useState('');
  const [pin, setPin] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { adminReady } = useSetupStatus();

  if (loading) return <FullScreenSpinner />;
  if (user && roles.includes(target.role)) return <Navigate to={target.path} replace />;

  const finish = async (r: Role[]) => {
    if (!r.includes(target.role)) {
      await signOut();
      setError(`This account can't use the ${target.title} link.`);
      return;
    }
    navigate(target.path, { replace: true });
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (method === 'pin') {
      const normalized = normalizeEmpNo(empNo);
      if (!isValidEmpNo(normalized)) return setError('Enter your employee number.');
      if (!isValidPin(pin)) return setError(`PIN must be ${PIN_LENGTH} digits.`);
      setBusy(true);
      try {
        await finish(await signIn(normalized, pin));
      } catch (err) {
        setError(authMessage((err as { code?: string }).code, 'pin'));
      } finally {
        setBusy(false);
      }
      return;
    }
    if (!isValidEmail(email)) return setError('Enter your email address.');
    if (!password) return setError('Enter your password.');
    setBusy(true);
    try {
      await finish(await signInWithEmail(email, password));
    } catch (err) {
      setError(authMessage((err as { code?: string }).code, 'email'));
    } finally {
      setBusy(false);
    }
  };

  const onForgot = async () => {
    setError(null);
    if (!isValidEmail(email)) return setError('Enter your email address first, then tap Forgot password.');
    try {
      await sendPasswordReset(email);
      setInfo(`If ${email.trim()} has an account, a reset link is on its way. Check spam too.`);
    } catch {
      setError('Could not send the reset email. Try again.');
    }
  };

  return (
    <Shell subtitle={`Sign in as ${target.title}`}>
      <form onSubmit={onSubmit} className="space-y-6">
        {!online && <Alert tone="info">You're offline. Sign-in on a new device needs internet.</Alert>}
        {portal === 'admin' && adminReady === false && (
          <Alert tone="info">
            No safety officer account exists yet.{' '}
            <Link to="/admin/setup" className="font-medium underline">
              Run first-time setup
            </Link>
          </Alert>
        )}
        {error && <Alert>{error}</Alert>}
        {info && <Alert tone="success">{info}</Alert>}

        {method === 'pin' ? (
          <div className="space-y-4">
            <Field label="Employee number">
              <Input
                value={empNo}
                onChange={(e) => setEmpNo(e.target.value)}
                autoCapitalize="characters"
                autoComplete="username"
                autoFocus
                placeholder="e.g. EMP1024"
                className="h-12 text-base uppercase"
              />
            </Field>
            <Field label="PIN">
              <Input
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, PIN_LENGTH))}
                type="password"
                inputMode="numeric"
                autoComplete="current-password"
                placeholder={'•'.repeat(PIN_LENGTH)}
                className="h-12 text-center text-lg tracking-[0.5em]"
              />
            </Field>
          </div>
        ) : (
          <div className="space-y-4">
            <Field label="Email">
              <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" autoFocus className="h-12 text-base" />
            </Field>
            <Field label="Password">
              <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="current-password" className="h-12 text-base" />
            </Field>
          </div>
        )}

        <Button type="submit" size="lg" className="w-full" loading={busy}>
          Sign in
        </Button>

        <div className="space-y-2 text-center text-xs text-slate-500">
          {method === 'email' ? (
            <button type="button" onClick={onForgot} className="font-medium text-slate-700 hover:underline">
              Forgot password?
            </button>
          ) : (
            <p>Forgot your PIN? Ask the safety officer to reset it.</p>
          )}
          {portal !== 'admin' && (
            <p>
              <button type="button" onClick={() => setMethod(method === 'pin' ? 'email' : 'pin')} className="hover:underline">
                {method === 'pin' ? 'Safety officer? Sign in with email' : 'Sign in with employee number'}
              </button>
            </p>
          )}
        </div>
      </form>
    </Shell>
  );
}
