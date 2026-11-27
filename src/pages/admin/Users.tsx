import { useMemo, useState, type FormEvent } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useConfig } from '@/contexts/ConfigContext';
import { callableMessage, createUser, resetCredential, updateUser } from '@/lib/callables';
import { isValidEmail, isValidEmpNo, isValidPin, MIN_PASSWORD, normalizeEmpNo, PIN_LENGTH } from '@/lib/identity';
import { PORTALS, ROLE_LABEL, type Person, type Portal, type Role } from '@/types';
import { Alert, Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, cx } from '@/components/ui';
import { CheckIcon, PlusIcon, SearchIcon } from '@/components/icons';

const ROLES: Role[] = ['auditor', 'area', 'admin'];
const linkFor = (portal: Portal) => `${window.location.origin}${PORTALS[portal].path}`;
const isEmailAccount = (p: Person) => Boolean(p.email);

function CopyLink({ portal }: { portal: Portal }) {
  const [copied, setCopied] = useState(false);
  const url = linkFor(portal);
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{PORTALS[portal].title}</div>
        <div className="truncate font-mono text-xs text-slate-500">{url}</div>
      </div>
      <Button
        size="sm"
        variant="secondary"
        onClick={async () => {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? <CheckIcon width={16} height={16} /> : null}
        {copied ? 'Copied' : 'Copy link'}
      </Button>
    </div>
  );
}

function RolePicker({ value, onChange, lockAdmin, disableAdmin }: { value: Role[]; onChange: (r: Role[]) => void; lockAdmin?: boolean; disableAdmin?: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      {ROLES.map((r) => {
        const on = value.includes(r);
        const locked = (lockAdmin && r === 'admin') || (disableAdmin && r === 'admin');
        return (
          <button
            type="button"
            key={r}
            disabled={locked}
            onClick={() => onChange(on ? value.filter((x) => x !== r) : [...value, r])}
            className={cx(
              'rounded-lg px-3 py-2 text-sm font-medium ring-1 ring-inset transition-colors',
              on ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white text-slate-700 ring-slate-300 hover:bg-slate-50',
              locked && 'cursor-not-allowed opacity-50',
            )}
          >
            {ROLE_LABEL[r]}
          </button>
        );
      })}
    </div>
  );
}

function SecretFields({ kind, value, confirm, setValue, setConfirm }: { kind: 'pin' | 'password'; value: string; confirm: string; setValue: (v: string) => void; setConfirm: (v: string) => void }) {
  const clean = (v: string) => (kind === 'pin' ? v.replace(/\D/g, '').slice(0, PIN_LENGTH) : v);
  const label = kind === 'pin' ? 'PIN' : 'Temporary password';
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label={label} hint={kind === 'pin' ? `${PIN_LENGTH} digits` : `${MIN_PASSWORD}+ characters`}>
        <Input value={value} onChange={(e) => setValue(clean(e.target.value))} inputMode={kind === 'pin' ? 'numeric' : undefined} type="password" autoComplete="new-password" />
      </Field>
      <Field label="Confirm">
        <Input value={confirm} onChange={(e) => setConfirm(clean(e.target.value))} inputMode={kind === 'pin' ? 'numeric' : undefined} type="password" autoComplete="new-password" />
      </Field>
    </div>
  );
}

function AddUserModal({ open, onClose, existing }: { open: boolean; onClose: () => void; existing: Person[] }) {
  const [name, setName] = useState('');
  const [roles, setRoles] = useState<Role[]>(['auditor']);
  const [empNo, setEmpNo] = useState('');
  const [email, setEmail] = useState('');
  const [secret, setSecret] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ name: string; login: string; portals: Portal[] } | null>(null);
  const emailAccount = roles.includes('admin');

  const reset = () => {
    setName('');
    setRoles(['auditor']);
    setEmpNo('');
    setEmail('');
    setSecret('');
    setConfirm('');
    setError(null);
    setCreated(null);
  };
  const close = () => {
    reset();
    onClose();
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) return setError('Enter the full name.');
    if (roles.length === 0) return setError('Pick at least one role.');
    if (secret !== confirm) return setError(emailAccount ? 'Passwords do not match.' : 'PINs do not match.');
    setError(null);

    let login: string;
    try {
      setBusy(true);
      if (emailAccount) {
        const em = email.trim().toLowerCase();
        if (!isValidEmail(em)) throw new Error('Enter a valid email address.');
        if (existing.some((p) => p.email === em)) throw new Error('A user with this email already exists.');
        if (secret.length < MIN_PASSWORD) throw new Error(`Password must be at least ${MIN_PASSWORD} characters.`);
        await createUser({ name: name.trim(), roles, email: em, password: secret });
        login = em;
      } else {
        const emp = normalizeEmpNo(empNo);
        if (!isValidEmpNo(emp)) throw new Error('Employee number: 2–20 letters, digits or dashes.');
        if (existing.some((p) => p.empNo === emp)) throw new Error('A user with this employee number already exists.');
        if (!isValidPin(secret)) throw new Error(`PIN must be ${PIN_LENGTH} digits.`);
        await createUser({ name: name.trim(), roles, empNo: emp, pin: secret });
        login = emp;
      }
      const portals = (['admin', 'audit', 'area'] as Portal[]).filter((p) => roles.includes(PORTALS[p].role));
      setCreated({ name: name.trim(), login, portals });
    } catch (err) {
      setError(err instanceof Error && !(err as { code?: string }).code ? err.message : callableMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (created) {
    return (
      <Modal open={open} title="User added" onClose={close} footer={<Button onClick={close}>Done</Button>}>
        <div className="space-y-4 text-sm">
          <Alert tone="success">
            {created.name} can sign in with <span className="font-semibold">{created.login}</span> and the {emailAccount ? 'password' : 'PIN'} you set.
          </Alert>
          <p className="text-slate-600">Send them their link. Give the {emailAccount ? 'password' : 'PIN'} in person.</p>
          <Card className="divide-y divide-slate-100">
            {created.portals.map((p) => (
              <CopyLink key={p} portal={p} />
            ))}
          </Card>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      title="Add user"
      onClose={close}
      footer={
        <>
          <Button variant="secondary" onClick={close}>Cancel</Button>
          <Button type="submit" form="add-user" loading={busy}>Add user</Button>
        </>
      }
    >
      <form id="add-user" onSubmit={submit} className="space-y-4">
        {error && <Alert>{error}</Alert>}
        <Field label="Full name">
          <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
        <Field label="Roles" hint="One person can have more than one role.">
          <RolePicker
            value={roles}
            onChange={(r) => {
              setRoles(r);
              setSecret('');
              setConfirm('');
            }}
          />
        </Field>
        {emailAccount ? (
          <>
            <Alert tone="info">Safety officers sign in at the safety officer link with email and password.</Alert>
            <Field label="Email">
              <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="off" />
            </Field>
          </>
        ) : (
          <Field label="Employee number" hint="They sign in with this and a 6-digit PIN.">
            <Input value={empNo} onChange={(e) => setEmpNo(e.target.value)} className="uppercase" autoComplete="off" />
          </Field>
        )}
        <SecretFields kind={emailAccount ? 'password' : 'pin'} value={secret} confirm={confirm} setValue={setSecret} setConfirm={setConfirm} />
        {emailAccount && <p className="text-xs text-slate-500">They can change it with "Forgot password" on the sign-in page.</p>}
      </form>
    </Modal>
  );
}

function EditUserModal({ person, onClose, isSelf }: { person: Person; onClose: () => void; isSelf: boolean }) {
  const [name, setName] = useState(person.name);
  const [roles, setRoles] = useState<Role[]>(person.roles);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'save' | 'active' | null>(null);
  const emailAccount = isEmailAccount(person);

  const run = async (kind: 'save' | 'active', fn: () => Promise<unknown>) => {
    setBusy(kind);
    setError(null);
    try {
      await fn();
      onClose();
    } catch (err) {
      setError(callableMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const save = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) return setError('Enter the full name.');
    if (roles.length === 0) return setError('Pick at least one role.');
    void run('save', () => updateUser({ uid: person.uid, name: name.trim(), roles }));
  };

  return (
    <Modal
      open
      title={`Edit ${person.name}`}
      onClose={onClose}
      footer={
        <>
          {!isSelf && (
            <Button variant={person.active ? 'danger' : 'secondary'} className="mr-auto" onClick={() => run('active', () => updateUser({ uid: person.uid, active: !person.active }))} loading={busy === 'active'}>
              {person.active ? 'Switch off account' : 'Switch on account'}
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="edit-user" loading={busy === 'save'}>Save</Button>
        </>
      }
    >
      <form id="edit-user" onSubmit={save} className="space-y-4">
        {error && <Alert>{error}</Alert>}
        <p className="text-sm text-slate-500">
          Signs in with <span className="font-medium text-slate-900">{person.email ?? person.empNo}</span>
        </p>
        <Field label="Full name">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field
          label="Roles"
          hint={
            isSelf
              ? 'You cannot remove your own safety officer role.'
              : emailAccount
                ? 'Changes apply the next time the user opens the app.'
                : 'Employee-number accounts cannot be safety officers. Add a new user with their email instead.'
          }
        >
          <RolePicker value={roles} onChange={setRoles} lockAdmin={isSelf} disableAdmin={!emailAccount} />
        </Field>
        {!person.active && <Alert tone="info">This account is switched off. The user cannot sign in.</Alert>}
      </form>
    </Modal>
  );
}

function ResetModal({ person, onClose }: { person: Person; onClose: () => void }) {
  const kind = isEmailAccount(person) ? 'password' : 'pin';
  const [value, setValue] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (kind === 'pin' && !isValidPin(value)) return setError(`PIN must be ${PIN_LENGTH} digits.`);
    if (kind === 'password' && value.length < MIN_PASSWORD) return setError(`Password must be at least ${MIN_PASSWORD} characters.`);
    if (value !== confirm) return setError('They do not match.');
    setBusy(true);
    setError(null);
    try {
      await resetCredential({ uid: person.uid, secret: value });
      setDone(true);
    } catch (err) {
      setError(callableMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      title={`${kind === 'pin' ? 'Reset PIN' : 'Set password'} · ${person.name}`}
      onClose={onClose}
      footer={
        done ? (
          <Button onClick={onClose}>Done</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" form="reset-secret" loading={busy}>Save</Button>
          </>
        )
      }
    >
      {done ? (
        <Alert tone="success">Changed. {person.name} is signed out on every device and signs in again with the new {kind === 'pin' ? 'PIN' : 'password'}.</Alert>
      ) : (
        <form id="reset-secret" onSubmit={submit} className="space-y-4">
          {error && <Alert>{error}</Alert>}
          <SecretFields kind={kind} value={value} confirm={confirm} setValue={setValue} setConfirm={setConfirm} />
        </form>
      )}
    </Modal>
  );
}

export default function Users() {
  const { uid } = useAuth();
  const { config } = useConfig();
  const [q, setQ] = useState('');
  const [roleFilter, setRoleFilter] = useState<Role | 'all'>('all');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Person | null>(null);
  const [resetting, setResetting] = useState<Person | null>(null);

  const people = config?.people ?? [];
  const term = q.trim().toLowerCase();
  const rows = useMemo(
    () =>
      [...people]
        .filter((p) => roleFilter === 'all' || p.roles.includes(roleFilter))
        .filter((p) => !term || p.name.toLowerCase().includes(term) || p.empNo.toLowerCase().includes(term) || (p.email ?? '').includes(term))
        .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name)),
    [people, roleFilter, term],
  );

  return (
    <div>
      <PageHeader
        title="Users"
        subtitle={`${people.filter((p) => p.active).length} active`}
        actions={
          <Button onClick={() => setAdding(true)}>
            <PlusIcon width={18} height={18} /> Add user
          </Button>
        }
      />

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold">Sign-in links</h2>
        <Card className="divide-y divide-slate-100">
          <CopyLink portal="audit" />
          <CopyLink portal="area" />
          <CopyLink portal="admin" />
        </Card>
        <p className="mt-2 text-xs text-slate-500">Auditors and area owners/managers use employee number + PIN. Safety officers use email + password.</p>
      </section>

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" width={18} height={18} />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, employee number or email" className="pl-10" />
        </div>
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as Role | 'all')} className="h-10 rounded-lg border-0 bg-white px-3 text-sm ring-1 ring-inset ring-slate-300">
          <option value="all">All roles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>{ROLE_LABEL[r]}</option>
          ))}
        </select>
      </div>

      {rows.length === 0 ? (
        <EmptyState title={people.length ? 'No users match' : 'No users yet'} body={people.length ? undefined : 'Add auditors, area owners and managers.'} />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="hidden px-4 py-3 sm:table-cell">Signs in with</th>
                <th className="hidden px-4 py-3 md:table-cell">Roles</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((p) => (
                <tr key={p.uid} className={p.active ? '' : 'text-slate-400'}>
                  <td className="px-4 py-3">
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-slate-500 sm:hidden">{p.email ?? p.empNo}</div>
                    {!p.active && <Badge className="mt-1 bg-slate-100 text-slate-500 ring-slate-400/20">Switched off</Badge>}
                  </td>
                  <td className="hidden px-4 py-3 font-mono text-xs sm:table-cell">{p.email ?? p.empNo}</td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {p.roles.map((r) => (
                        <Badge key={r}>{ROLE_LABEL[r]}</Badge>
                      ))}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <Button size="sm" variant="ghost" onClick={() => setResetting(p)} disabled={!p.active}>
                      {isEmailAccount(p) ? 'Set password' : 'Reset PIN'}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(p)}>Edit</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <AddUserModal open={adding} onClose={() => setAdding(false)} existing={people} />
      {editing && <EditUserModal person={editing} isSelf={editing.uid === uid} onClose={() => setEditing(null)} />}
      {resetting && <ResetModal person={resetting} onClose={() => setResetting(null)} />}
    </div>
  );
}
