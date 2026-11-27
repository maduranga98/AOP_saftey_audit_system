import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useConfig } from '@/contexts/ConfigContext';
import { addArea, addSubArea, moveArea, updateArea } from '@/lib/configWrites';
import type { Area } from '@/types';
import { Alert, Badge, Button, Card, Field, Input, Modal, PageHeader, cx } from '@/components/ui';
import { ArrowDownIcon, ArrowUpIcon, ChevronRightIcon, PlusIcon, SearchIcon } from '@/components/icons';

type Dialog = { kind: 'add-area' } | { kind: 'rename-area'; area: Area } | { kind: 'add-sub'; area: Area } | null;

function NameDialog({ dialog, onClose }: { dialog: NonNullable<Dialog>; onClose: () => void }) {
  const navigate = useNavigate();
  const [name, setName] = useState(dialog.kind === 'rename-area' ? dialog.area.name : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const title = dialog.kind === 'add-area' ? 'Add area' : dialog.kind === 'rename-area' ? 'Rename area' : `Add sub-area to ${dialog.area.name}`;

  const save = async () => {
    if (name.trim().length < 2) return setError('Enter a name.');
    setBusy(true);
    setError(null);
    try {
      if (dialog.kind === 'add-area') await addArea(name);
      else if (dialog.kind === 'rename-area') await updateArea(dialog.area.id, { name: name.trim() });
      else {
        const id = await addSubArea(dialog.area.id, name);
        navigate(`/admin/areas/${id}`);
      }
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} loading={busy}>Save</Button>
        </>
      }
    >
      <form onSubmit={(e) => (e.preventDefault(), void save())} className="space-y-3">
        {error && <Alert>{error}</Alert>}
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
        {dialog.kind === 'add-sub' && <p className="text-xs text-slate-500">Next you add its observations, contractors, owner and manager.</p>}
      </form>
    </Modal>
  );
}

export default function Areas() {
  const { sortedAreas, subAreasOf, personById, observationsOf, config } = useConfig();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'unassigned' | 'hidden'>('all');
  const [dialog, setDialog] = useState<Dialog>(null);
  const [error, setError] = useState<string | null>(null);
  const term = q.trim().toLowerCase();

  const names = (ids: string[]) => ids.map((id) => personById.get(id)?.name ?? '?').join(', ');
  const total = (config?.subAreas ?? []).filter((s) => s.active).length;

  const run = async (fn: () => Promise<void>) => {
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const groups = sortedAreas
    .map((a) => ({
      area: a,
      subs: subAreasOf(a.id).filter(
        (s) =>
          (!term || s.name.toLowerCase().includes(term) || a.name.toLowerCase().includes(term)) &&
          (filter === 'all' ? true : filter === 'hidden' ? !s.active || a.active === false : s.active && s.ownerIds.length === 0 && s.managerIds.length === 0),
      ),
    }))
    .filter((g) => g.subs.length > 0 || (!term && filter === 'all'));

  return (
    <div>
      <PageHeader
        title="Areas"
        subtitle={`${sortedAreas.filter((a) => a.active !== false).length} areas · ${total} active sub-areas`}
        actions={
          <Button onClick={() => setDialog({ kind: 'add-area' })}>
            <PlusIcon width={18} height={18} /> Add area
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" width={18} height={18} />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search area or sub-area" className="pl-10" />
        </div>
        <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} className="h-10 rounded-lg border-0 bg-white px-3 text-sm ring-1 ring-inset ring-slate-300">
          <option value="all">All sub-areas</option>
          <option value="unassigned">Without owner or manager</option>
          <option value="hidden">Hidden</option>
        </select>
      </div>

      {error && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      )}

      <div className="space-y-5">
        {groups.map(({ area, subs }, gi) => (
          <section key={area.id}>
            <div className="mb-2 flex items-center gap-2">
              <h2 className={cx('flex-1 text-xs font-semibold uppercase tracking-wide', area.active === false ? 'text-slate-400 line-through' : 'text-slate-500')}>{area.name}</h2>
              <button title="Move up" disabled={gi === 0} onClick={() => run(() => moveArea(area.id, -1))} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30">
                <ArrowUpIcon width={16} height={16} />
              </button>
              <button title="Move down" disabled={gi === groups.length - 1} onClick={() => run(() => moveArea(area.id, 1))} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30">
                <ArrowDownIcon width={16} height={16} />
              </button>
              <Button size="sm" variant="ghost" onClick={() => setDialog({ kind: 'rename-area', area })}>Rename</Button>
              <Button size="sm" variant="ghost" onClick={() => run(() => updateArea(area.id, { active: area.active === false }))}>
                {area.active === false ? 'Show' : 'Hide'}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setDialog({ kind: 'add-sub', area })}>
                <PlusIcon width={14} height={14} /> Sub-area
              </Button>
            </div>
            <Card className="divide-y divide-slate-100">
              {subs.length === 0 && <p className="px-4 py-3 text-sm text-slate-500">No sub-areas yet.</p>}
              {subs.map((s) => (
                <Link key={s.id} to={`/admin/areas/${s.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm hover:bg-slate-50">
                  <span className={cx('min-w-[180px] flex-1 font-medium', !s.active && 'text-slate-400')}>
                    {s.name} {!s.active && <Badge className="ml-1 bg-slate-100 text-slate-500 ring-slate-400/20">Hidden</Badge>}
                  </span>
                  <span className="w-full text-slate-600 sm:w-auto sm:min-w-[240px]">
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
                  <span className="text-xs text-slate-400">
                    {observationsOf(s.id).length} obs · {s.contractors.length} contractors
                  </span>
                  <ChevronRightIcon className="hidden text-slate-300 sm:block" width={16} height={16} />
                </Link>
              ))}
            </Card>
          </section>
        ))}
      </div>

      {dialog && <NameDialog dialog={dialog} onClose={() => setDialog(null)} />}
    </div>
  );
}
