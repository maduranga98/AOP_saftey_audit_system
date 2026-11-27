import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { isValidEmpNo, isValidPin, normalizeEmpNo, PIN_LENGTH } from '@/lib/identity';
import { PORTALS, type Portal } from '@/types';
import { Alert, Button, Field, FullScreenSpinner, Input } from '@/components/ui';
import { ShieldIcon } from '@/components/icons';
import { useOnline } from '@/hooks/useOnline';

function authMessage(code: string | undefined): string {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-email':
      return 'Employee number or PIN is wrong.';
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

export default function Login({ portal }: { portal: Portal }) {
  const { user, roles, loading, signIn, signOut } = useAuth();
  const navigate = useNavigate();
  const online = useOnline();
  const [empNo, setEmpNo] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const target = PORTALS[portal];

  if (loading) return <FullScreenSpinner />;
  if (user && roles.includes(target.role)) return <Navigate to={target.path} replace />;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const normalized = normalizeEmpNo(empNo);
    if (!isValidEmpNo(normalized)) return setError('Enter your employee number.');
    if (!isValidPin(pin)) return setError(`PIN must be ${PIN_LENGTH} digits.`);
    setBusy(true);
    setError(null);
    try {
      const r = await signIn(normalized, pin);
      if (!r.includes(target.role)) {
        await signOut();
        setError(`This account can't use the ${target.title} link.`);
        return;
      }
      navigate(target.path, { replace: true });
    } catch (err) {
      setError(authMessage((err as { code?: string }).code));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center px-5 py-10">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900">
            <ShieldIcon className="text-green-400" width={26} height={26} />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">AOP Safety Audit</h1>
          <p className="text-sm text-slate-500">Sign in as {target.title}</p>
        </div>

        {!online && <Alert tone="info">You're offline. Sign-in on a new device needs internet.</Alert>}
        {error && <Alert>{error}</Alert>}

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

        <Button type="submit" size="lg" className="w-full" loading={busy}>
          Sign in
        </Button>
        <p className="text-center text-xs text-slate-400">Forgot your PIN? Ask the safety officer to reset it.</p>
      </form>
    </div>
  );
}
