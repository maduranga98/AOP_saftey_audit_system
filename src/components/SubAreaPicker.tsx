import { useMemo, useState } from 'react';
import { useConfig } from '@/contexts/ConfigContext';
import type { SubArea } from '@/types';
import { ChevronRightIcon, SearchIcon } from './icons';
import { Input } from './ui';

/** Area → sub-area tap list with search. Used by auditors to start an audit. */
export function SubAreaPicker({ onPick }: { onPick: (s: SubArea) => void }) {
  const { sortedAreas, subAreasOf, personById } = useConfig();
  const [q, setQ] = useState('');
  const term = q.trim().toLowerCase();

  const groups = useMemo(
    () =>
      sortedAreas
        .map((a) => ({
          area: a,
          subs: subAreasOf(a.id).filter(
            (s) => s.active && (!term || s.name.toLowerCase().includes(term) || a.name.toLowerCase().includes(term)),
          ),
        }))
        .filter((g) => g.subs.length > 0),
    [sortedAreas, subAreasOf, term],
  );

  const names = (ids: string[]) => ids.map((id) => personById.get(id)?.name).filter(Boolean).join(', ');

  return (
    <div className="space-y-4">
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" width={18} height={18} />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search area or sub-area" className="h-11 pl-10" />
      </div>
      {groups.length === 0 && <p className="py-8 text-center text-sm text-slate-500">No matching sub-areas.</p>}
      {groups.map(({ area, subs }) => (
        <section key={area.id}>
          <h3 className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{area.name}</h3>
          <div className="divide-y divide-slate-100 overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
            {subs.map((s) => {
              const owners = names(s.ownerIds);
              const managers = names(s.managerIds);
              return (
                <button key={s.id} onClick={() => onPick(s)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-slate-50 active:bg-slate-100">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{s.name}</div>
                    <div className="truncate text-xs text-slate-500">
                      {owners || managers ? [owners && `Owner: ${owners}`, managers && `Manager: ${managers}`].filter(Boolean).join(' · ') : 'Owner and manager not assigned'}
                    </div>
                  </div>
                  <ChevronRightIcon className="shrink-0 text-slate-400" />
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
