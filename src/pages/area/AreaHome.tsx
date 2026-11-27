import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useConfig } from '@/contexts/ConfigContext';
import { monthKey, monthLabel, formatDate } from '@/lib/dates';
import { BAND_CLASS, bandOf, formatPct } from '@/lib/score';
import { useAreaAudits, useOpenActions, usePendingResponses } from '@/hooks/useAreaData';
import { ActionRow } from '@/components/ActionRow';
import { Alert, Badge, Card, EmptyState, Spinner, cx } from '@/components/ui';
import type { ActionDoc, AuditDoc } from '@/types';

function Section({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-1.5 flex items-center justify-between px-1">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

export default function AreaHome() {
  const { uid, name } = useAuth();
  const { config, areaById, contractorById } = useConfig();
  const month = monthKey();
  const { actions, error } = useOpenActions(uid);
  const audits = useAreaAudits(uid, month);
  const pending = usePendingResponses(uid);

  const mine = useMemo(
    () =>
      (config?.subAreas ?? [])
        .filter((s) => s.active && uid && (s.ownerIds.includes(uid) || s.managerIds.includes(uid)))
        .sort((a, b) => a.order - b.order),
    [config, uid],
  );

  const bySubArea = useMemo(() => {
    const m = new Map<string, ActionDoc[]>();
    for (const a of actions ?? []) {
      if (!m.has(a.subAreaId)) m.set(a.subAreaId, []);
      m.get(a.subAreaId)!.push(a);
    }
    return m;
  }, [actions]);

  const latestAudit = useMemo(() => {
    const m = new Map<string, AuditDoc[]>();
    for (const a of audits ?? []) {
      if (!m.has(a.subAreaId)) m.set(a.subAreaId, []);
      m.get(a.subAreaId)!.push(a);
    }
    return m;
  }, [audits]);

  const openCount = (actions ?? []).filter((a) => !pending.has(a.id)).length;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-slate-500">{monthLabel(month)}</p>
        <h1 className="text-xl font-semibold tracking-tight">Hello, {name.split(' ')[0]}</h1>
        {actions && (
          <p className="mt-1 text-sm text-slate-500">
            {openCount === 0 ? 'No open corrective actions.' : `${openCount} corrective action${openCount === 1 ? '' : 's'} to close.`}
          </p>
        )}
      </div>

      {error && <Alert>Could not load actions. {navigator.onLine ? error : 'Connect to the internet and reopen this page.'}</Alert>}

      {mine.length === 0 ? (
        <EmptyState title="No sub-areas assigned yet" body="The safety officer assigns area owners and managers. Ask them to add you." />
      ) : (
        <>
          <Section title="Open actions" right={<Link to="/area/closed" className="text-xs font-medium text-slate-600 hover:underline">Closed actions</Link>}>
            {actions === null ? (
              <div className="flex justify-center py-8 text-slate-400"><Spinner /></div>
            ) : actions.length === 0 ? (
              <Card className="px-4 py-6 text-center text-sm text-slate-500">All clear. New findings appear here after each audit.</Card>
            ) : (
              <div className="space-y-3">
                {mine
                  .filter((s) => bySubArea.has(s.id))
                  .map((s) => (
                    <Card key={s.id} className="overflow-hidden">
                      <div className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-sm font-medium">
                        {s.name} <span className="font-normal text-slate-500">· {bySubArea.get(s.id)!.length}</span>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {bySubArea.get(s.id)!.map((a) => (
                          <ActionRow key={a.id} action={a} to={`/area/action/${a.id}`} pending={pending.has(a.id)} />
                        ))}
                      </div>
                    </Card>
                  ))}
                {/* Actions for sub-areas no longer assigned to this user, kept visible until closed */}
                {[...bySubArea.keys()].filter((id) => !mine.some((s) => s.id === id)).map((id) => (
                  <Card key={id} className="overflow-hidden">
                    <div className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-sm font-medium">{bySubArea.get(id)![0].subAreaName}</div>
                    <div className="divide-y divide-slate-100">
                      {bySubArea.get(id)!.map((a) => (
                        <ActionRow key={a.id} action={a} to={`/area/action/${a.id}`} pending={pending.has(a.id)} />
                      ))}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </Section>

          <Section title="My sub-areas this month">
            <Card className="divide-y divide-slate-100">
              {mine.map((s) => {
                const list = latestAudit.get(s.id) ?? [];
                const avg = list.length ? Math.round((list.reduce((n, a) => n + (a.pct ?? 0), 0) / list.length) * 10) / 10 : null;
                const last = list[0];
                return (
                  <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{s.name}</span>
                        <Badge>{uid && s.ownerIds.includes(uid) ? 'Owner' : 'Manager'}</Badge>
                      </div>
                      <div className="truncate text-xs text-slate-500">
                        {areaById.get(s.areaId)?.name}
                        {s.contractors.length > 0 && ` · ${s.contractors.map((c) => contractorById.get(c.contractorId)?.name).join(', ')}`}
                      </div>
                      {last && (
                        <Link to={`/area/audit/${last.id}`} className="text-xs font-medium text-slate-700 hover:underline">
                          Audited {formatDate(last.clientSubmittedAt)} by {last.auditorName}
                          {list.length > 1 && ` (+${list.length - 1} more)`}
                        </Link>
                      )}
                    </div>
                    <span className={cx('shrink-0 rounded-md px-2 py-0.5 text-sm font-semibold ring-1 ring-inset', BAND_CLASS[bandOf(avg, config?.bands)])}>
                      {audits === null ? '…' : avg === null ? 'Not audited' : formatPct(avg)}
                    </span>
                  </div>
                );
              })}
            </Card>
          </Section>
        </>
      )}
    </div>
  );
}
