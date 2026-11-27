import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { callableMessage, setupFirstAdmin } from '@/lib/callables';
import { isValidEmail, MIN_PASSWORD } from '@/lib/identity';
import { useSetupStatus } from '@/hooks/useSetupStatus';
import { Alert, Button, Field, FullScreenSpinner, Input } from '@/components/ui';
import { ShieldIcon } from '@/components/icons';

/**
 * First-time setup: creates the first safety officer (email + password).
 * Needs the setup code set when the functions were deployed, and closes for good once used.
 */
export default function Setup() {
  const { adminReady } = useSetupStatus();
  const { signInWithEmail } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (adminReady === null) return <FullScreenSpinner />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) return setError('Enter your full name.');
    if (!isValidEmail(email)) return setError('Enter a valid email address.');
    if (password.length < MIN_PASSWORD) return setError(`Password must be at least ${MIN_PASSWORD} characters.`);
    if (password !== confirm) return setError('Passwords do not match.');
    if (!code.trim()) return setError('Enter the setup code.');
    setBusy(true);
    setError(null);
    try {
      await setupFirstAdmin({ name: name.trim(), email: email.trim().toLowerCase(), password, setupCode: code.trim() });
      await signInWithEmail(email, password);
      navigate('/admin', { replace: true });
    } catch (err) {
      setError(callableMessage(err));
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900">
            <ShieldIcon className="text-green-400" width={26} height={26} />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">First-time setup</h1>
          <p className="text-sm text-slate-500">Create the safety officer account</p>
        </div>

        {adminReady ? (
          <div className="space-y-4">
            <Alert tone="info">Setup is already complete. Other safety officers are added from the Users page.</Alert>
            <Link to="/admin/login" className="block text-center text-sm font-medium underline">
              Go to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            {error && <Alert>{error}</Alert>}
            <Field label="Full name">
              <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" autoFocus />
            </Field>
            <Field label="Email">
              <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Password" hint={`${MIN_PASSWORD}+ characters`}>
                <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="new-password" />
              </Field>
              <Field label="Confirm">
                <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} type="password" autoComplete="new-password" />
              </Field>
            </div>
            <Field label="Setup code" hint="Given by the developer who installed the system.">
              <Input value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" />
            </Field>
            <Button type="submit" size="lg" className="w-full" loading={busy}>
              Create account
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
