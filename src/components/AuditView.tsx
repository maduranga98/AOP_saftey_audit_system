import { useConfig } from '@/contexts/ConfigContext';
import { formatDate } from '@/lib/dates';
import { BAND_CLASS, bandOf, formatPct } from '@/lib/score';
import type { AuditDoc } from '@/types';
import { scoreLabel } from './ScoreButtons';
import { PhotoStrip } from './Photos';
import { Badge, Card, cx } from './ui';

const SCORE_CHIP: Record<string, string> = {
  '0': 'bg-red-100 text-red-700',
  '0.25': 'bg-orange-100 text-orange-700',
  '0.5': 'bg-amber-100 text-amber-800',
  '0.75': 'bg-lime-100 text-lime-800',
  '1': 'bg-green-100 text-green-700',
  na: 'bg-slate-100 text-slate-600',
};

/** Read-only audit: used by auditors now, and by area owners and the safety officer later. */
export function AuditView({ audit }: { audit: AuditDoc }) {
  const { config } = useConfig();
  const band = bandOf(audit.pct, config?.bands);

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{audit.areaName}</p>
            <h1 className="text-xl font-semibold tracking-tight">{audit.subAreaName}</h1>
            <p className="text-sm text-slate-500">
              {formatDate(audit.clientSubmittedAt)} · {audit.auditorName}
            </p>
          </div>
          <span className={cx('rounded-lg px-3 py-1.5 text-lg font-semibold ring-1 ring-inset', BAND_CLASS[band])}>{formatPct(audit.pct)}</span>
        </div>
        {audit.voided && <Badge className="bg-red-50 text-red-700 ring-red-600/20">Voided: {audit.voidReason}</Badge>}
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-slate-500">Score</dt>
            <dd className="font-medium">
              {audit.scoredSum} / {audit.applicable}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Findings</dt>
            <dd className="font-medium">{audit.belowOneCount}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Area owner</dt>
            <dd className="font-medium">{audit.ownerNames.join(', ') || '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Area manager</dt>
            <dd className="font-medium">{audit.managerNames.join(', ') || '—'}</dd>
          </div>
        </dl>
        {audit.contractors.length > 0 && (
          <p className="text-sm text-slate-500">Contractors: {audit.contractors.map((c) => c.name).join(', ')}</p>
        )}
      </div>

      <Card className="divide-y divide-slate-100">
        {audit.items.map((i) => (
          <div key={i.obsId} className="space-y-1.5 px-4 py-3">
            <div className="flex gap-3">
              <span className="w-6 shrink-0 text-sm font-medium text-slate-400">{i.no}</span>
              <p className="flex-1 text-sm">{i.text}</p>
              <span className={cx('h-fit shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold', SCORE_CHIP[i.na ? 'na' : String(i.score)])}>
                {i.na ? 'NA' : i.score}
              </span>
            </div>
            {(i.remark || i.photos.length > 0) && (
              <div className="pl-9">
                {i.remark && <p className="text-sm text-slate-600">{i.remark}</p>}
                <PhotoStrip paths={i.photos} />
              </div>
            )}
            <span className="sr-only">{scoreLabel(i.score, i.na)}</span>
          </div>
        ))}
      </Card>
    </div>
  );
}
