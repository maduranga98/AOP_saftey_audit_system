import type { ReactNode } from 'react';

export function FilterSelect({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="h-10 min-w-[150px] rounded-lg border-0 bg-white px-3 text-sm ring-1 ring-inset ring-slate-300">
        {children}
      </select>
    </label>
  );
}

/** Last 18 months as YYYY-MM options, newest first. */
export function monthOptions(count = 18): string[] {
  const out: string[] = [];
  const d = new Date();
  d.setDate(1);
  for (let i = 0; i < count; i++) {
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    d.setMonth(d.getMonth() - 1);
  }
  return out;
}
