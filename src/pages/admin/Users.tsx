import { useMemo, useState, type FormEvent } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useConfig } from '@/contexts/ConfigContext';
import { callableMessage, createUser, resetPin, updateUser } from '@/lib/callables';
import { isValidEmpNo, isValidPin, normalizeEmpNo, PIN_LENGTH } from '@/lib/identity';
import { ROLE_LABEL, type Person, type Role } from '@/types';
import { Alert, Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, cx } from '@/components/ui';
import { PlusIcon, SearchIcon } from '@/components/icons';

const ROLES: Role[] = ['auditor', 'area', 'admin'];

function RolePicker({ value, onChange, lockAdmin }: { value: Role[]; onChange: (r: Role[]) => void; lockAdmin?: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      {ROLES.map((r) => {
        const on = value.includes(r);
        const locked = lockAdmin && r === 'admin';
        return (
          <button
            type="button"
            key={r}
            disabled={locked}
            onClick={() => onChange(on ? value.filter((x) => x !== r) : [...value, r])}
            className={cx(
              'rounded-lg px-3 py-2 text-sm font-medium ring-1 ring-inset transition-colors',
              on ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white text-slate-700 ring-slate-300 hover:bg-slate-50',
              locked && 'cursor-not-allowed opacity-60',
            )}
          >
            {ROLE_LABEL[r]}
          </button>
        );
      })}
    </div>
  );
}

function PinFields({ pin, confirm, setPin, setConfirm }: { pin: string; confirm: string; setPin: (v: string) => void; setConfirm: (v: string) => void }) {
  const clean = (v: string) => v.replace(/\D/g, '').slice(0, PIN_LENGTH);
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="PIN" hint={`${PIN_LENGTH} digits`}>
        <Input value={pin} onChange={(e) => setPin(clean(e.target.value))} inputMode="numeric" type="password" autoComplete="new-password" />
      </Field>
      <Field label="Confirm PIN">
        <Input value={confirm} onChange={(e) => setConfirm(clean(e.target.value))} inputMode="numeric" type="password" autoComplete="new-password" />
      </Field>
    </div>
  );
}

function AddUserModal({ open, onClose, existing }: { open: boolean; onClose: () => void; existing: Person[] }) {
  const [empNo, setEmpNo] = useState('');
  const [name, setName] = useState('');
  const [roles, setRoles] = useState<Role[]>(['auditor']);
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setEmpNo('');
    setName('');
    setRoles(['auditor']);
    setPin('');
    setConfirm('');
    setError(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const emp = normalizeEmpNo(empNo);
    if (!isValidEmpNo(emp)) return setError('Employee number: 2–20 letters, digits or dashes.');
    if (existing.some((p) => p.empNo === emp)) return setError('A user with this employee number already exists.');
    if (name.trim().length < 2) return setError('Enter the full name.');
    if (roles.length === 0) return setError('Pick at least one role.');
    if (!isValidPin(pin)) return setError(`PIN must be ${PIN_LENGTH} digits.`);
    if (pin !== confirm) return setError('PINs do not match.');
    setBusy(true);
    setError(null);
    try {
      await createUser({ empNo: emp, name: name.trim(), roles, pin });
      reset();
      onClose();
    } catch (err) {
      setError(callableMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Add user"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="add-user" loading={busy}>Add user</Button>
        </>
      }
    >
      <form id="add-user" onSubmit={submit} className="space-y-4">
        {error && <Alert>{error}</Alert>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Employee number">
            <Input value={empNo} onChange={(e) => setEmpNo(e.target.value)} className="uppercase" autoFocus />
          </Field>
          <Field label="Full name">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
        </div>
        <Field label="Roles" hint="One person can have more than one role.">
          <RolePicker value={roles} onChange={setRoles} />
        </Field>
        <PinFields pin={pin} confirm={confirm} setPin={setPin} setConfirm={setConfirm} />
        <p className="text-xs text-slate-500">Give the PIN to the user in person. They sign in with their employee number and this PIN.</p>
      </form>
    </Modal>
  );
}

function EditUserModal({ person, onClose, isSelf }: { person: Person; onClose: () => void; isSelf: boolean }) {
  const [name, setName] = useState(person.name);
  const [roles, setRoles] = useState<Role[]>(person.roles);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'save' | 'active' | null>(null);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) return setError('Enter the full name.');
    if (roles.length === 0) return setError('Pick at least one role.');
    setBusy('save');
    setError(null);
    try {
      await updateUser({ uid: person.uid, name: name.trim(), roles });
      onClose();
    } catch (err) {
      setError(callableMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const toggleActive = async () => {
    setBusy('active');
    setError(null);
    try {
      await updateUser({ uid: person.uid, active: !person.active });
      onClose();
    } catch (err) {
      setError(callableMessage(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal
      open
      title={`Edit ${person.empNo}`}
      onClose={onClose}
      footer={
        <>
          {!isSelf && (
            <Button variant={person.active ? 'danger' : 'secondary'} className="mr-auto" onClick={toggleActive} loading={busy === 'active'}>
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
        <Field label="Full name">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Roles" hint={isSelf ? 'You cannot remove your own safety officer role.' : 'Changes apply the next time the user opens the app.'}>
          <RolePicker value={roles} onChange={setRoles} lockAdmin={isSelf} />
        </Field>
        {!person.active && <Alert tone="info">This account is switched off. The user cannot sign in.</Alert>}
      </form>
    </Modal>
  );
}

function ResetPinModal({ person, onClose }: { person: Person; onClose: () => void }) {
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isValidPin(pin)) return setError(`PIN must be ${PIN_LENGTH} digits.`);
    if (pin !== confirm) return setError('PINs do not match.');
    setBusy(true);
    setError(null);
    try {
      await resetPin({ uid: person.uid, pin });
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
      title={`Reset PIN · ${person.name}`}
      onClose={onClose}
      footer={
        done ? (
          <Button onClick={onClose}>Done</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" form="reset-pin" loading={busy}>Reset PIN</Button>
          </>
        )
      }
    >
      {done ? (
        <Alert tone="success">PIN changed. {person.name} is signed out on every device and signs in again with the new PIN.</Alert>
      ) : (
        <form id="reset-pin" onSubmit={submit} className="space-y-4">
          {error && <Alert>{error}</Alert>}
          <PinFields pin={pin} confirm={confirm} setPin={setPin} setConfirm={setConfirm} />
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
        .filter((p) => !term || p.name.toLowerCase().includes(term) || p.empNo.toLowerCase().includes(term))
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

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" width={18} height={18} />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or employee number" className="pl-10" />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as Role | 'all')}
          className="h-10 rounded-lg border-0 bg-white px-3 text-sm ring-1 ring-inset ring-slate-300"
        >
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
                <th className="hidden px-4 py-3 sm:table-cell">Employee no</th>
                <th className="hidden px-4 py-3 md:table-cell">Roles</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((p) => (
                <tr key={p.uid} className={p.active ? '' : 'text-slate-400'}>
                  <td className="px-4 py-3">
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-slate-500 sm:hidden">{p.empNo}</div>
                    {!p.active && <Badge className="mt-1 bg-slate-100 text-slate-500 ring-slate-400/20">Switched off</Badge>}
                  </td>
                  <td className="hidden px-4 py-3 font-mono text-xs sm:table-cell">{p.empNo}</td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {p.roles.map((r) => (
                        <Badge key={r}>{ROLE_LABEL[r]}</Badge>
                      ))}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <Button size="sm" variant="ghost" onClick={() => setResetting(p)} disabled={!p.active}>Reset PIN</Button>
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
      {resetting && <ResetPinModal person={resetting} onClose={() => setResetting(null)} />}
    </div>
  );
}
