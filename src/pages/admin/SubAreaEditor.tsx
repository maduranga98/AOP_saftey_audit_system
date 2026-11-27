import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useConfig } from '@/contexts/ConfigContext';
import { copyObservations, nextObservationId, saveObservations, updateSubArea } from '@/lib/configWrites';
import type { ContractorLink, Observation, SubArea } from '@/types';
import { PeoplePicker } from '@/components/PeoplePicker';
import { Alert, Badge, Button, Card, EmptyState, Field, Input, cx } from '@/components/ui';
import { ArrowDownIcon, ArrowLeftIcon, ArrowUpIcon, PlusIcon, TrashIcon } from '@/components/icons';

function Section({ title, hint, children, footer }: { title: string; hint?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-slate-100 px-5 py-3">
        <h2 className="font-semibold">{title}</h2>
        {hint && <p className="text-xs text-slate-500">{hint}</p>}
      </div>
      <div className="space-y-4 px-5 py-4">{children}</div>
      {footer && <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50 px-5 py-3">{footer}</div>}
    </Card>
  );
}

/** Save button with its own busy/done/error state. */
function useSaver() {
  const [state, setState] = useState<{ busy: boolean; error: string | null; savedAt: number | null }>({ busy: false, error: null, savedAt: null });
  const run = async (fn: () => Promise<void>) => {
    setState({ busy: true, error: null, savedAt: null });
    try {
      await fn();
      setState({ busy: false, error: null, savedAt: Date.now() });
    } catch (e) {
      setState({ busy: false, error: (e as Error).message, savedAt: null });
    }
  };
  const status = state.error ? <span className="mr-auto text-xs text-red-600">{state.error}</span> : state.savedAt ? <span className="mr-auto text-xs text-green-700">Saved</span> : null;
  return { ...state, run, status };
}

function DetailsSection({ sub }: { sub: SubArea }) {
  const { sortedAreas } = useConfig();
  const [name, setName] = useState(sub.name);
  const [areaId, setAreaId] = useState(sub.areaId);
  const saver = useSaver();
  const dirty = name.trim() !== sub.name || areaId !== sub.areaId;

  return (
    <Section
      title="Details"
      footer={
        <>
          {saver.status}
          <Button
            variant="secondary"
            onClick={() => saver.run(() => updateSubArea(sub.id, { active: !sub.active }))}
            loading={saver.busy && !dirty}
          >
            {sub.active ? 'Hide sub-area' : 'Show sub-area'}
          </Button>
          <Button disabled={!dirty || name.trim().length < 2} loading={saver.busy && dirty} onClick={() => saver.run(() => updateSubArea(sub.id, { name: name.trim(), areaId }))}>
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Area">
          <select value={areaId} onChange={(e) => setAreaId(e.target.value)} className="h-10 w-full rounded-lg border-0 bg-white px-3 text-sm ring-1 ring-inset ring-slate-300">
            {sortedAreas.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </Field>
      </div>
      {!sub.active && <Alert tone="info">Hidden: auditors can't pick it. Past audits keep it.</Alert>}
    </Section>
  );
}

function PeopleSection({ sub }: { sub: SubArea }) {
  const { config } = useConfig();
  const candidates = useMemo(() => (config?.people ?? []).filter((p) => p.active && p.roles.includes('area')).sort((a, b) => a.name.localeCompare(b.name)), [config]);
  const [owners, setOwners] = useState(sub.ownerIds);
  const [managers, setManagers] = useState(sub.managerIds);
  const saver = useSaver();
  const dirty = owners.join() !== sub.ownerIds.join() || managers.join() !== sub.managerIds.join();
  const empty = 'No area owners or managers yet. Add them on the Users page.';

  return (
    <Section
      title="Area owner and manager"
      hint="They receive this sub-area's corrective actions. Changing them moves open actions to the new people."
      footer={
        <>
          {saver.status}
          <Button disabled={!dirty} loading={saver.busy} onClick={() => saver.run(() => updateSubArea(sub.id, { ownerIds: owners, managerIds: managers }))}>
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Area owners">
          <PeoplePicker people={candidates} value={owners} onChange={setOwners} empty={empty} />
        </Field>
        <Field label="Area managers">
          <PeoplePicker people={candidates} value={managers} onChange={setManagers} empty={empty} />
        </Field>
      </div>
    </Section>
  );
}

function ContractorsSection({ sub }: { sub: SubArea }) {
  const { config } = useConfig();
  const all = (config?.contractors ?? []).filter((c) => c.active || sub.contractors.some((l) => l.contractorId === c.id));
  const [rows, setRows] = useState<ContractorLink[]>(sub.contractors);
  const saver = useSaver();
  const dirty = JSON.stringify(rows) !== JSON.stringify(sub.contractors);
  const free = all.filter((c) => !rows.some((r) => r.contractorId === c.id));

  return (
    <Section
      title="Contractors"
      hint="Who works in this sub-area and their scope. Add new contractor names in Settings."
      footer={
        <>
          {saver.status}
          <Button disabled={!dirty} loading={saver.busy} onClick={() => saver.run(() => updateSubArea(sub.id, { contractors: rows.map((r) => ({ ...r, scope: r.scope.trim() })) }))}>
            Save
          </Button>
        </>
      }
    >
      {rows.length === 0 && <p className="text-sm text-slate-500">Own team, no contractors.</p>}
      {rows.map((r, i) => (
        <div key={r.contractorId} className="flex flex-wrap items-center gap-2">
          <span className="w-44 shrink-0 text-sm font-medium">{all.find((c) => c.id === r.contractorId)?.name ?? r.contractorId}</span>
          <Input
            value={r.scope}
            onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, scope: e.target.value } : x)))}
            placeholder="Scope of work"
            className="min-w-[200px] flex-1"
          />
          <button onClick={() => setRows(rows.filter((_, j) => j !== i))} className="rounded p-2 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="Remove">
            <TrashIcon width={16} height={16} />
          </button>
        </div>
      ))}
      {free.length > 0 && (
        <select
          value=""
          onChange={(e) => e.target.value && setRows([...rows, { contractorId: e.target.value, scope: '' }])}
          className="h-10 rounded-lg border-0 bg-white px-3 text-sm ring-1 ring-inset ring-slate-300"
        >
          <option value="">+ Add contractor…</option>
          {free.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      )}
    </Section>
  );
}

function ObservationsSection({ sub }: { sub: SubArea }) {
  const { checklists, config } = useConfig();
  const saved = useMemo(() => (checklists?.lists[sub.id] ?? []).filter((o) => o.active).sort((a, b) => a.order - b.order), [checklists, sub.id]);
  const [items, setItems] = useState<Observation[]>(saved);
  const [copyFrom, setCopyFrom] = useState('');
  const saver = useSaver();

  useEffect(() => setItems(saved), [saved]);

  const allIds = useMemo(() => [...(checklists?.lists[sub.id] ?? []), ...items], [checklists, sub.id, items]);
  const dirty = JSON.stringify(items.map((o) => [o.id, o.text.trim()])) !== JSON.stringify(saved.map((o) => [o.id, o.text]));
  const blank = items.some((o) => o.text.trim().length < 3);

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    setItems(next);
  };

  const save = () =>
    saver.run(() => saveObservations(sub.id, () => items.map((o, i) => ({ ...o, text: o.text.trim().replace(/\s+/g, ' '), order: i + 1, active: true }))));

  const others = (config?.subAreas ?? []).filter((s) => s.id !== sub.id && (checklists?.lists[s.id] ?? []).some((o) => o.active));

  return (
    <Section
      title={`Observations · ${items.length}`}
      hint="Changes apply to audits started after saving. Submitted audits keep the wording they were scored against."
      footer={
        <>
          {saver.status ?? (dirty && <span className="mr-auto text-xs text-amber-700">Unsaved changes</span>)}
          {dirty && (
            <Button variant="ghost" onClick={() => setItems(saved)}>
              Undo changes
            </Button>
          )}
          <Button disabled={!dirty || blank} loading={saver.busy} onClick={save}>
            Save observations
          </Button>
        </>
      }
    >
      {items.length === 0 && others.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 p-3">
          <span className="text-sm text-slate-600">Start from another sub-area's list:</span>
          <select value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)} className="h-9 rounded-lg border-0 bg-white px-3 text-sm ring-1 ring-inset ring-slate-300">
            <option value="">Choose…</option>
            {others.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <Button size="sm" variant="secondary" disabled={!copyFrom} loading={saver.busy} onClick={() => saver.run(() => copyObservations(copyFrom, sub.id))}>
            Copy
          </Button>
        </div>
      )}

      <ol className="space-y-2">
        {items.map((o, i) => (
          <li key={o.id} className="flex items-start gap-2">
            <span className="mt-2.5 w-6 shrink-0 text-right text-sm font-medium text-slate-400">{i + 1}</span>
            <textarea
              value={o.text}
              onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
              rows={2}
              className={cx(
                'block flex-1 resize-y rounded-lg border-0 px-3 py-2 text-sm ring-1 ring-inset focus:ring-2 focus:ring-inset focus:ring-slate-900',
                o.text.trim().length < 3 ? 'bg-red-50 ring-red-300' : 'bg-white ring-slate-300',
              )}
            />
            <div className="flex flex-col">
              <button onClick={() => move(i, -1)} disabled={i === 0} className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-30" aria-label="Move up">
                <ArrowUpIcon width={16} height={16} />
              </button>
              <button onClick={() => move(i, 1)} disabled={i === items.length - 1} className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-30" aria-label="Move down">
                <ArrowDownIcon width={16} height={16} />
              </button>
            </div>
            <button onClick={() => setItems(items.filter((_, j) => j !== i))} className="mt-1 rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="Remove">
              <TrashIcon width={16} height={16} />
            </button>
          </li>
        ))}
      </ol>

      <Button variant="secondary" onClick={() => setItems([...items, { id: nextObservationId(allIds), text: '', order: items.length + 1, active: true }])}>
        <PlusIcon width={16} height={16} /> Add observation
      </Button>
    </Section>
  );
}

export default function SubAreaEditor() {
  const { subAreaId = '' } = useParams();
  const { subAreaById, areaById } = useConfig();
  const sub = subAreaById.get(subAreaId);

  if (!sub) return <EmptyState title="Sub-area not found" action={<Link to="/admin/areas" className="text-sm font-medium underline">Back to areas</Link>} />;

  return (
    <div className="max-w-3xl space-y-5">
      <Link to="/admin/areas" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeftIcon width={16} height={16} /> Areas
      </Link>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{areaById.get(sub.areaId)?.name}</p>
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          {sub.name} {!sub.active && <Badge>Hidden</Badge>}
        </h1>
      </div>
      {/* key: reset local edits when another admin saves the same sub-area */}
      <DetailsSection key={`d-${sub.name}-${sub.areaId}`} sub={sub} />
      <PeopleSection key={`p-${sub.ownerIds.join()}-${sub.managerIds.join()}`} sub={sub} />
      <ContractorsSection key={`c-${JSON.stringify(sub.contractors)}`} sub={sub} />
      <ObservationsSection sub={sub} />
    </div>
  );
}
