import { useMemo, useState } from 'react';
import { useConfig } from '@/contexts/ConfigContext';
import { updateSubArea } from '@/lib/configWrites';
import type { Person, SubArea } from '@/types';
import { Alert, Badge, Button, Card, Field, Input, Modal, PageHeader, cx } from '@/components/ui';
import { SearchIcon } from '@/components/icons';

function PeoplePicker({ people, value, onChange }: { people: Person[]; value: string[]; onChange: (ids: string[]) => void }) {
  const [q, setQ] = useState('');
  const term = q.trim().toLowerCase();
  const list = people.filter((p) => !term || p.name.toLowerCase().includes(term) || p.empNo.toLowerCase().includes(term));
  return (
    <div className="space-y-2">
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="h-9" />
      <div className="max-h-44 overflow-y-auto rounded-lg ring-1 ring-slate-200">
        {list.length === 0 && <p className="px-3 py-3 text-sm text-slate-500">No area owners or managers yet. Add them on the Users page.</p>}
        {list.map((p) => {
          const on = value.includes(p.uid);
          return (
            <label key={p.uid} className={cx('flex cursor-pointer items-center gap-3 px-3 py-2 text-sm', on && 'bg-slate-50')}>
              <input
                type="checkbox"
                checked={on}
                onChange={() => onChange(on ? value.filter((x) => x !== p.uid) : [...value, p.uid])}
                className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
              />
              <span className="flex-1">{p.name}</span>
              <span className="font-mono text-xs text-slate-400">{p.empNo}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function AssignModal({ subArea, onClose }: { subArea: SubArea; onClose: () => void }) {
  const { config, contractorById, observationsOf } = useConfig();
  const candidates = useMemo(
    () => (config?.people ?? []).filter((p) => p.active && p.roles.includes('area')).sort((a, b) => a.name.localeCompare(b.name)),
    [config],
  );
  const [owners, setOwners] = useState(subArea.ownerIds);
  const [managers, setManagers] = useState(subArea.managerIds);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await updateSubArea(subArea.id, { ownerIds: owners, managerIds: managers });
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      title={subArea.name}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} loading={busy}>Save</Button>
        </>
      }
    >
      <div className="space-y-5">
        {error && <Alert>{error}</Alert>}
        <Field label="Area owners">
          <PeoplePicker people={candidates} value={owners} onChange={setOwners} />
        </Field>
        <Field label="Area managers">
          <PeoplePicker people={candidates} value={managers} onChange={setManagers} />
        </Field>
        <div className="space-y-1 text-sm">
          <p className="font-medium text-slate-700">Contractors</p>
          {subArea.contractors.length === 0 ? (
            <p className="text-slate-500">Own team</p>
          ) : (
            subArea.contractors.map((c) => (
              <p key={c.contractorId}>
                {contractorById.get(c.contractorId)?.name}
                {c.scope && <span className="text-slate-500"> — {c.scope}</span>}
              </p>
            ))
          )}
          <p className="pt-2 text-xs text-slate-500">{observationsOf(subArea.id).length} observations. Editing contractors and observations comes in the admin release.</p>
        </div>
      </div>
    </Modal>
  );
}

export default function Areas() {
  const { sortedAreas, subAreasOf, personById, observationsOf, config } = useConfig();
  const [q, setQ] = useState('');
  const [onlyUnassigned, setOnlyUnassigned] = useState(false);
  const [editing, setEditing] = useState<SubArea | null>(null);
  const term = q.trim().toLowerCase();

  const names = (ids: string[]) => ids.map((id) => personById.get(id)?.name ?? '?').join(', ');
  const total = (config?.subAreas ?? []).filter((s) => s.active).length;

  const groups = sortedAreas
    .map((a) => ({
      area: a,
      subs: subAreasOf(a.id).filter(
        (s) =>
          s.active &&
          (!term || s.name.toLowerCase().includes(term) || a.name.toLowerCase().includes(term)) &&
          (!onlyUnassigned || (s.ownerIds.length === 0 && s.managerIds.length === 0)),
      ),
    }))
    .filter((g) => g.subs.length > 0);

  return (
    <div>
      <PageHeader title="Areas" subtitle={`${sortedAreas.length} areas · ${total} sub-areas`} />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" width={18} height={18} />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search area or sub-area" className="pl-10" />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={onlyUnassigned} onChange={(e) => setOnlyUnassigned(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
          Only without owner or manager
        </label>
      </div>

      <div className="space-y-5">
        {groups.map(({ area, subs }) => (
          <section key={area.id}>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{area.name}</h2>
            <Card className="divide-y divide-slate-100">
              {subs.map((s) => (
                <button key={s.id} onClick={() => setEditing(s)} className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-left text-sm hover:bg-slate-50">
                  <span className="min-w-[180px] flex-1 font-medium">{s.name}</span>
                  <span className="w-full text-slate-600 sm:w-auto sm:min-w-[260px]">
                    {s.ownerIds.length || s.managerIds.length ? (
                      <>
                        {s.ownerIds.length > 0 && <>Owner: {names(s.ownerIds)}</>}
                        {s.ownerIds.length > 0 && s.managerIds.length > 0 && ' · '}
                        {s.managerIds.length > 0 && <>Manager: {names(s.managerIds)}</>}
                      </>
                    ) : (
                      <Badge className="bg-amber-50 text-amber-700 ring-amber-600/20">Not assigned</Badge>
                    )}
                  </span>
                  <span className="text-xs text-slate-400">{observationsOf(s.id).length} obs · {s.contractors.length} contractors</span>
                </button>
              ))}
            </Card>
          </section>
        ))}
      </div>

      {editing && <AssignModal subArea={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
