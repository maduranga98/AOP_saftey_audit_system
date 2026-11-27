import type { Bands, ScoreValue } from '@/types';

export const SCALE: { value: ScoreValue; label: string; meaning: string; className: string }[] = [
  { value: 0, label: 'Poor', meaning: 'Not implemented or fully non-compliant', className: 'bg-red-600 text-white' },
  { value: 0.25, label: 'Unsatisfactory', meaning: 'Major gaps, very limited compliance', className: 'bg-orange-500 text-white' },
  { value: 0.5, label: 'Average', meaning: 'Partially compliant, improvements needed', className: 'bg-amber-400 text-slate-900' },
  { value: 0.75, label: 'Good', meaning: 'Mostly compliant, minor improvements needed', className: 'bg-lime-500 text-white' },
  { value: 1, label: 'Excellent', meaning: 'Fully compliant', className: 'bg-green-600 text-white' },
];

export type Band = 'green' | 'amber' | 'red' | 'grey';

export const DEFAULT_BANDS: Bands = { green: 90, amber: 75 };

export function bandOf(pct: number | null | undefined, bands: Bands = DEFAULT_BANDS): Band {
  if (pct === null || pct === undefined || Number.isNaN(pct)) return 'grey';
  if (pct >= bands.green) return 'green';
  if (pct >= bands.amber) return 'amber';
  return 'red';
}

export const BAND_CLASS: Record<Band, string> = {
  green: 'bg-green-50 text-green-700 ring-green-600/20',
  amber: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  red: 'bg-red-50 text-red-700 ring-red-600/20',
  grey: 'bg-slate-100 text-slate-500 ring-slate-500/20',
};

/** Audit % = sum of scores / applicable (non-NA) observations x 100, 1 decimal. */
export function auditPercent(items: { score: ScoreValue | null; na: boolean }[]): number | null {
  const applicable = items.filter((i) => !i.na && i.score !== null);
  if (applicable.length === 0) return null;
  const sum = applicable.reduce((s, i) => s + (i.score as number), 0);
  return Math.round((sum / applicable.length) * 1000) / 10;
}

export function formatPct(pct: number | null | undefined): string {
  return pct === null || pct === undefined ? '—' : `${pct.toFixed(1)}%`;
}
