import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { collection, orderBy, query, where, type QueryConstraint } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useConfig } from '@/contexts/ConfigContext';
import { monthKey, monthLabel, formatDate } from '@/lib/dates';
import { BAND_CLASS, bandOf, formatPct } from '@/lib/score';
import { usePagedQuery } from '@/hooks/usePagedQuery';
import type { AuditDoc } from '@/types';
import { FilterSelect, monthOptions } from '@/components/FilterSelect';
import { Alert, Badge, Button, Card, EmptyState, PageHeader, Spinner, cx } from '@/components/ui';

export default function Audits() {
  const { sortedAreas, subAreasOf, config } = useConfig();
  const [params, setParams] = useSearchParams();
  const month = params.get('month') || monthKey();
  const areaId = params.get('area') || '';
  const subAreaId = params.get('sub') || '';
  const auditorUid = params.get('auditor') || '';

  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    if (k === 'area') next.delete('sub');
    setParams(next, { replace: true });
  };

  // One server filter besides month (most specific first); the auditor filter is applied in the browser
  // when a sub-area or area is also chosen, so only indexed queries are ever sent.
  const serverFilter = subAreaId ? ['subAreaId', subAreaId] : areaId ? ['areaId', areaId] : auditorUid ? ['auditorUid', auditorUid] : null;
  const key = `${month}|${serverFilter?.join('=') ?? ''}`;
  const base = useMemo(() => {
    const c: QueryConstraint[] = [where('month', '==', month)];
    if (serverFilter) c.push(where(serverFilter[0], '==', serverFilter[1]));
    c.push(orderBy('submittedAt', 'desc'));
    return query(collection(db, 'audits'), ...c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const { rows, loading, done, error, loadMore } = usePagedQuery<AuditDoc>(base, key);
  const shown = auditorUid && serverFilter?.[0] !== 'auditorUid' ? rows.filter((a) => a.auditorUid === auditorUid) : rows;

  const auditors = (config?.people ?? []).filter((p) => p.roles.includes('auditor')).sort((a, b) => a.name.localeCompare(b.name));
  const subs = areaId ? subAreasOf(areaId) : [];

  return (
    <div>
      <PageHeader title="Audits" subtitle={monthLabel(month)} />

      <div className="mb-4 flex flex-wrap gap-3">
        <FilterSelect label="Month" value={month} onChange={(v) => set('month', v)}>
          {monthOptions().map((m) => (
            <option key={m} value={m}>{monthLabel(m)}</option>
          ))}
        </FilterSelect>
        <FilterSelect label="Area" value={areaId} onChange={(v) => set('area', v)}>
          <option value="">All areas</option>
          {sortedAreas.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </FilterSelect>
        {subs.length > 1 && (
          <FilterSelect label="Sub-area" value={subAreaId} onChange={(v) => set('sub', v)}>
            <option value="">All sub-areas</option>
            {subs.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </FilterSelect>
        )}
        <FilterSelect label="Auditor" value={auditorUid} onChange={(v) => set('auditor', v)}>
          <option value="">All auditors</option>
          {auditors.map((p) => (
            <option key={p.uid} value={p.uid}>{p.name}</option>
          ))}
        </FilterSelect>
      </div>

      {error && <Alert>{error.includes('index') ? 'A database index is still building. Try again in a few minutes.' : error}</Alert>}

      {!loading && shown.length === 0 && !error ? (
        <EmptyState title="No audits" body="Nothing submitted for these filters yet." />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Sub-area</th>
                <th className="hidden px-4 py-3 md:table-cell">Auditor</th>
                <th className="hidden px-4 py-3 sm:table-cell">Date</th>
                <th className="hidden px-4 py-3 text-right lg:table-cell">Findings</th>
                <th className="px-4 py-3 text-right">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shown.map((a) => (
                <tr key={a.id} className={cx('cursor-pointer hover:bg-slate-50', a.voided && 'text-slate-400')}>
                  <td className="px-4 py-3">
                    <Link to={`/admin/audits/${a.id}`} className="block">
                      <div className="font-medium">
                        {a.subAreaName} {a.voided && <Badge className="ml-1 bg-red-50 text-red-700 ring-red-600/20">Void</Badge>}
                      </div>
                      <div className="text-xs text-slate-500">
                        {a.areaName}
                        <span className="md:hidden"> · {a.auditorName}</span>
                        <span className="sm:hidden"> · {formatDate(a.clientSubmittedAt)}</span>
                      </div>
                    </Link>
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    <Link to={`/admin/audits/${a.id}`} className="block">{a.auditorName}</Link>
                  </td>
                  <td className="hidden px-4 py-3 text-slate-600 sm:table-cell">{formatDate(a.clientSubmittedAt)}</td>
                  <td className="hidden px-4 py-3 text-right lg:table-cell">{a.belowOneCount}</td>
                  <td className="px-4 py-3 text-right">
                    <Link to={`/admin/audits/${a.id}`} className={cx('inline-block rounded-md px-2 py-0.5 font-semibold ring-1 ring-inset', BAND_CLASS[bandOf(a.voided ? null : a.pct, config?.bands)])}>
                      {formatPct(a.pct)}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex justify-center border-t border-slate-100 p-3">
            {loading ? <Spinner className="h-5 w-5 text-slate-400" /> : !done ? <Button variant="secondary" size="sm" onClick={loadMore}>Load more</Button> : <span className="text-xs text-slate-400">{shown.length} audit{shown.length === 1 ? '' : 's'}</span>}
          </div>
        </Card>
      )}
    </div>
  );
}
