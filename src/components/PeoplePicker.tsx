import { useState } from 'react';
import type { Person } from '@/types';
import { Input, cx } from './ui';

/** Searchable checkbox list of people. */
export function PeoplePicker({ people, value, onChange, empty }: { people: Person[]; value: string[]; onChange: (ids: string[]) => void; empty?: string }) {
  const [q, setQ] = useState('');
  const term = q.trim().toLowerCase();
  const list = people.filter((p) => !term || p.name.toLowerCase().includes(term) || p.empNo.toLowerCase().includes(term));
  return (
    <div className="space-y-2">
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="h-9" />
      <div className="max-h-48 overflow-y-auto rounded-lg ring-1 ring-slate-200">
        {list.length === 0 && <p className="px-3 py-3 text-sm text-slate-500">{empty ?? 'No matching people.'}</p>}
        {list.map((p) => {
          const on = value.includes(p.uid);
          return (
            <label key={p.uid} className={cx('flex cursor-pointer items-center gap-3 px-3 py-2 text-sm', on && 'bg-slate-50')}>
              <input
                type="checkbox"
                checked={on}
                onChange={() => onChange(on ? value.filter((x) => x !== p.uid) : [...value, p.uid])}
                className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
              />
              <span className="flex-1">{p.name}</span>
              <span className="font-mono text-xs text-slate-400">{p.empNo || p.email}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
