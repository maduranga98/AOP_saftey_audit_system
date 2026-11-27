import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { collection, orderBy, query, where, type QueryConstraint } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useConfig } from '@/contexts/ConfigContext';
import { monthLabel } from '@/lib/dates';
import { usePagedQuery } from '@/hooks/usePagedQuery';
import type { ActionDoc } from '@/types';
import { ActionRow } from '@/components/ActionRow';
import { FilterSelect, monthOptions } from '@/components/FilterSelect';
import { Alert, Button, Card, EmptyState, PageHeader, Spinner } from '@/components/ui';

export default function Actions() {
  const { config, sortedAreas, subAreasOf } = useConfig();
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? 'open';
  const month = params.get('month') ?? '';
  const subAreaId = params.get('sub') ?? '';

  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    setParams(next, { replace: true });
  };

  // Month and sub-area together: query by month, filter the sub-area in the browser (keeps to indexed queries).
  const key = `${status}|${month}|${month ? '' : subAreaId}`;
  const base = useMemo(() => {
    const c: QueryConstraint[] = [];
    if (month) c.push(where('month', '==', month));
    else if (subAreaId) c.push(where('subAreaId', '==', subAreaId));
    if (status !== 'all') c.push(where('status', '==', status));
    c.push(orderBy('raisedAt', 'desc'));
    return query(collection(db, 'actions'), ...c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const { rows, loading, done, error, loadMore } = usePagedQuery<ActionDoc>(base, key);
  const shown = month && subAreaId ? rows.filter((a) => a.subAreaId === subAreaId) : rows;

  const subOptions = sortedAreas.flatMap((a) => subAreasOf(a.id).map((s) => ({ id: s.id, label: s.name === a.name ? s.name : `${a.name} · ${s.name}` })));

  return (
    <div className="max-w-4xl">
      <PageHeader title="Corrective actions" subtitle="Raised for every score below 1. Area owners and managers close them with photo proof." />

      <div className="mb-4 flex flex-wrap gap-3">
        <FilterSelect label="Status" value={status} onChange={(v) => set('status', v === 'open' ? '' : v)}>
          <option value="open">Open</option>
          <option value="closed">Closed</option>
          <option value="void">Void</option>
          <option value="all">All</option>
        </FilterSelect>
        <FilterSelect label="Month raised" value={month} onChange={(v) => set('month', v)}>
          <option value="">All months</option>
          {monthOptions().map((m) => (
            <option key={m} value={m}>{monthLabel(m)}</option>
          ))}
        </FilterSelect>
        <FilterSelect label="Sub-area" value={subAreaId} onChange={(v) => set('sub', v)}>
          <option value="">All sub-areas</option>
          {subOptions.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </FilterSelect>
      </div>

      {error && <Alert>{error.includes('index') ? 'A database index is still building. Try again in a few minutes.' : error}</Alert>}

      {!loading && shown.length === 0 && !error ? (
        <EmptyState title={status === 'open' ? 'No open actions' : 'No actions'} body="Nothing matches these filters." />
      ) : (
        <Card className="overflow-hidden">
          <div className="divide-y divide-slate-100">
            {shown.map((a) => (
              <div key={a.id}>
                <p className="px-4 pt-3 text-xs font-medium text-slate-500">
                  {a.subAreaName} · {config?.people.filter((p) => a.assigneeIds.includes(p.uid)).map((p) => p.name).join(', ') || 'No owner or manager'}
                </p>
                <ActionRow action={a} to={`/admin/actions/${a.id}`} closed={a.status === 'closed'} />
              </div>
            ))}
          </div>
          <div className="flex justify-center border-t border-slate-100 p-3">
            {loading ? <Spinner className="h-5 w-5 text-slate-400" /> : !done ? <Button variant="secondary" size="sm" onClick={loadMore}>Load more</Button> : <span className="text-xs text-slate-400">{shown.length} action{shown.length === 1 ? '' : 's'}</span>}
          </div>
        </Card>
      )}
    </div>
  );
}
