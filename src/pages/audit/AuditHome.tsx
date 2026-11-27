import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAuth } from '@/contexts/AuthContext';
import { useConfig } from '@/contexts/ConfigContext';
import { localDb } from '@/lib/localdb';
import { monthKey, monthLabel, timeAgo, formatDate } from '@/lib/dates';
import { BAND_CLASS, bandOf, formatPct } from '@/lib/score';
import { useMyAudits } from '@/hooks/useMyAudits';
import { SubAreaPicker } from '@/components/SubAreaPicker';
import { Alert, Card, cx } from '@/components/ui';
import { ChevronRightIcon, UploadIcon } from '@/components/icons';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
      <Card className="divide-y divide-slate-100">{children}</Card>
    </section>
  );
}

export default function AuditHome() {
  const { uid, name } = useAuth();
  const { subAreaById, config } = useConfig();
  const navigate = useNavigate();
  const location = useLocation();
  const month = monthKey();
  const [toast, setToast] = useState<string | null>((location.state as { submitted?: string } | null)?.submitted ?? null);

  useEffect(() => {
    if (!toast) return;
    navigate('.', { replace: true, state: null });
    const t = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(t);
  }, [toast, navigate]);

  const drafts = useLiveQuery(() => (uid ? localDb.drafts.where('uid').equals(uid).reverse().sortBy('updatedAt') : []), [uid], []);
  const outbox = useLiveQuery(() => (uid ? localDb.outbox.where('uid').equals(uid).filter((i) => i.kind === 'audit').toArray() : []), [uid], []);
  const { audits } = useMyAudits(uid, month);
  const submitted = (audits ?? []).filter((a) => !outbox.some((o) => o.id === a.id));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-slate-500">{monthLabel(month)}</p>
        <h1 className="text-xl font-semibold tracking-tight">Hello, {name.split(' ')[0]}</h1>
      </div>

      {toast && <Alert tone="success">{toast} audit submitted. It uploads in the background.</Alert>}

      {drafts.length > 0 && (
        <Section title="In progress">
          {drafts.map((d) => {
            const p = d.payload;
            const scored = p.items.filter((i) => i.na || i.score !== null).length;
            return (
              <Link key={d.id} to={`/audit/form/${d.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
                <div className="flex-1">
                  <div className="font-medium">{subAreaById.get(p.subAreaId)?.name ?? 'Removed sub-area'}</div>
                  <div className="text-xs text-slate-500">
                    {scored} / {p.items.length} scored · edited {timeAgo(p.updatedAt)}
                  </div>
                </div>
                <ChevronRightIcon className="text-slate-400" />
              </Link>
            );
          })}
        </Section>
      )}

      {outbox.length > 0 && (
        <Section title="Waiting to upload">
          {outbox.map((o) => (
            <div key={o.id} className="flex items-center gap-3 px-4 py-3">
              <UploadIcon className="text-sky-600" width={18} height={18} />
              <div className="flex-1">
                <div className="font-medium">{o.kind === 'audit' ? o.payload.audit.subAreaName : o.label}</div>
                <div className={cx('text-xs', o.lastError ? 'text-red-600' : 'text-slate-500')}>{o.lastError ?? 'Uploads when there is signal'}</div>
              </div>
            </div>
          ))}
        </Section>
      )}

      {submitted.length > 0 && (
        <Section title={`Submitted this month · ${submitted.length}`}>
          {submitted.map((a) => (
            <Link key={a.id} to={`/audit/view/${a.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
              <div className="flex-1">
                <div className="font-medium">{a.subAreaName}</div>
                <div className="text-xs text-slate-500">
                  {formatDate(a.clientSubmittedAt)} · {a.belowOneCount} finding{a.belowOneCount === 1 ? '' : 's'}
                </div>
              </div>
              <span className={cx('rounded-md px-2 py-0.5 text-sm font-semibold ring-1 ring-inset', BAND_CLASS[bandOf(a.pct, config?.bands)])}>{formatPct(a.pct)}</span>
            </Link>
          ))}
        </Section>
      )}

      <div>
        <h2 className="mb-2 px-1 text-base font-semibold">Start an audit</h2>
        <SubAreaPicker onPick={(s) => navigate(`/audit/sub-area/${s.id}`)} />
      </div>
    </div>
  );
}
