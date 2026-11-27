import { useState } from 'react';
import { useConfig } from '@/contexts/ConfigContext';
import { addContractor, updateBands, updateContractor } from '@/lib/configWrites';
import { BAND_CLASS, DEFAULT_BANDS } from '@/lib/score';
import type { Contractor } from '@/types';
import { Alert, Badge, Button, Card, Field, Input, PageHeader, cx } from '@/components/ui';
import { PlusIcon } from '@/components/icons';

function BandsCard() {
  const { config } = useConfig();
  const current = config?.bands ?? DEFAULT_BANDS;
  const [green, setGreen] = useState(String(current.green));
  const [amber, setAmber] = useState(String(current.amber));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const dirty = Number(green) !== current.green || Number(amber) !== current.amber;

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await updateBands({ green: Number(green), amber: Number(amber) });
      setMsg({ tone: 'success', text: 'Saved.' });
    } catch (e) {
      setMsg({ tone: 'error', text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="space-y-4 p-5">
      <div>
        <h2 className="font-semibold">Score colours</h2>
        <p className="text-xs text-slate-500">Used on every score, the dashboard and the Excel export.</p>
      </div>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Green from (%)">
          <Input type="number" min={1} max={100} value={green} onChange={(e) => setGreen(e.target.value)} />
        </Field>
        <Field label="Amber from (%)">
          <Input type="number" min={1} max={100} value={amber} onChange={(e) => setAmber(e.target.value)} />
        </Field>
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        <span className={cx('rounded-md px-2 py-1 ring-1 ring-inset', BAND_CLASS.green)}>Green: {green}% and above</span>
        <span className={cx('rounded-md px-2 py-1 ring-1 ring-inset', BAND_CLASS.amber)}>
          Amber: {amber}% to under {green}%
        </span>
        <span className={cx('rounded-md px-2 py-1 ring-1 ring-inset', BAND_CLASS.red)}>Red: under {amber}%</span>
        <span className={cx('rounded-md px-2 py-1 ring-1 ring-inset', BAND_CLASS.grey)}>Grey: not audited</span>
      </div>
      <div className="flex justify-end">
        <Button disabled={!dirty} loading={busy} onClick={save}>Save</Button>
      </div>
    </Card>
  );
}

function ContractorRow({ c, used }: { c: Contractor; used: number }) {
  const [name, setName] = useState(c.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="px-4 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} className={cx('h-9 min-w-[200px] flex-1', !c.active && 'text-slate-400')} />
        <span className="w-24 text-xs text-slate-500">{used} sub-area{used === 1 ? '' : 's'}</span>
        {!c.active && <Badge>Hidden</Badge>}
        {name.trim() !== c.name && (
          <Button size="sm" loading={busy} disabled={name.trim().length < 2} onClick={() => run(() => updateContractor(c.id, { name: name.trim() }))}>
            Save
          </Button>
        )}
        <Button size="sm" variant="ghost" loading={busy && name.trim() === c.name} onClick={() => run(() => updateContractor(c.id, { active: !c.active }))}>
          {c.active ? 'Hide' : 'Show'}
        </Button>
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function ContractorsCard() {
  const { config } = useConfig();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const contractors = config?.contractors ?? [];
  const usage = (id: string) => (config?.subAreas ?? []).filter((s) => s.active && s.contractors.some((c) => c.contractorId === id)).length;

  const add = async () => {
    if (name.trim().length < 2) return setError('Enter a contractor name.');
    setBusy(true);
    setError(null);
    try {
      await addContractor(name);
      setName('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="overflow-hidden">
      <div className="space-y-3 border-b border-slate-100 p-5">
        <div>
          <h2 className="font-semibold">Contractors · {contractors.filter((c) => c.active).length}</h2>
          <p className="text-xs text-slate-500">Master list. Link contractors to sub-areas in each sub-area's page. Hidden contractors stay on past audits.</p>
        </div>
        {error && <Alert>{error}</Alert>}
        <form onSubmit={(e) => (e.preventDefault(), void add())} className="flex gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New contractor name" />
          <Button type="submit" loading={busy}>
            <PlusIcon width={16} height={16} /> Add
          </Button>
        </form>
      </div>
      <div className="divide-y divide-slate-100">
        {contractors.map((c) => (
          <ContractorRow key={`${c.id}-${c.name}-${c.active}`} c={c} used={usage(c.id)} />
        ))}
      </div>
    </Card>
  );
}

export default function Settings() {
  return (
    <div className="max-w-3xl">
      <PageHeader title="Settings" />
      <div className="space-y-5">
        <BandsCard />
        <ContractorsCard />
      </div>
    </div>
  );
}
