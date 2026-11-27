import { Link } from 'react-router-dom';
import type { ActionDoc } from '@/types';
import { ChevronRightIcon } from './icons';
import { cx } from './ui';

const SCORE_CHIP: Record<string, string> = {
  '0': 'bg-red-100 text-red-700',
  '0.25': 'bg-orange-100 text-orange-700',
  '0.5': 'bg-amber-100 text-amber-800',
  '0.75': 'bg-lime-100 text-lime-800',
};

export const scoreChipClass = (score: number) => SCORE_CHIP[String(score)] ?? 'bg-slate-100 text-slate-600';

/** Days since a Firestore timestamp (or null while it is still pending). */
export function ageDays(ts: unknown): number | null {
  const t = ts as { toMillis?: () => number } | null | undefined;
  if (!t?.toMillis) return null;
  return Math.floor((Date.now() - t.toMillis()) / 86_400_000);
}

export function ActionRow({ action, to, pending }: { action: ActionDoc; to: string; pending?: boolean }) {
  const age = ageDays(action.raisedAt);
  return (
    <Link to={to} className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50">
      <span className={cx('mt-0.5 shrink-0 rounded-md px-1.5 py-0.5 text-xs font-semibold', scoreChipClass(action.score))}>{action.score}</span>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm">{action.obsText}</p>
        <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{action.remark}</p>
        <p className={cx('mt-0.5 text-xs', pending ? 'font-medium text-sky-700' : age !== null && age > 14 ? 'font-medium text-red-600' : 'text-slate-400')}>
          {pending ? 'Response waiting to upload' : age === null ? 'Raised just now' : age === 0 ? 'Raised today' : `Open ${age} day${age === 1 ? '' : 's'}`}
        </p>
      </div>
      <ChevronRightIcon className="mt-1 shrink-0 text-slate-400" />
    </Link>
  );
}
