import { SCALE } from '@/lib/score';
import type { ScoreValue } from '@/types';
import { cx } from './ui';

const LABEL: Record<number, string> = { 0: '0', 0.25: '¼', 0.5: '½', 0.75: '¾', 1: '1' };

/** Five score buttons plus NA. Selected state takes the score's colour so problem items stand out. */
export function ScoreButtons({
  score,
  na,
  onChange,
}: {
  score: ScoreValue | null;
  na: boolean;
  onChange: (score: ScoreValue | null, na: boolean) => void;
}) {
  return (
    <div className="grid grid-cols-6 gap-1.5" role="radiogroup" aria-label="Score">
      {SCALE.map((s) => {
        const on = !na && score === s.value;
        return (
          <button
            key={s.value}
            type="button"
            role="radio"
            aria-checked={on}
            title={`${s.value} — ${s.label}`}
            onClick={() => onChange(on ? null : s.value, false)}
            className={cx(
              'flex h-12 flex-col items-center justify-center rounded-lg text-base font-semibold transition-colors',
              on ? s.className : 'bg-slate-100 text-slate-700 active:bg-slate-200',
            )}
          >
            {LABEL[s.value]}
          </button>
        );
      })}
      <button
        type="button"
        role="radio"
        aria-checked={na}
        title="Not applicable"
        onClick={() => onChange(null, !na)}
        className={cx(
          'h-12 rounded-lg text-sm font-semibold transition-colors',
          na ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-500 active:bg-slate-200',
        )}
      >
        NA
      </button>
    </div>
  );
}

export function scoreLabel(score: ScoreValue | null, na: boolean): string {
  if (na) return 'NA';
  if (score === null) return 'Not scored';
  return `${score} · ${SCALE.find((s) => s.value === score)?.label}`;
}
