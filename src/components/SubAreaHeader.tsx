import { useConfig } from '@/contexts/ConfigContext';
import type { SubArea } from '@/types';

/** Who and what a sub-area covers: shown at the top of audits and area screens. */
export function SubAreaHeader({ subArea }: { subArea: SubArea }) {
  const { areaById, personById, contractorById } = useConfig();
  const names = (ids: string[]) => ids.map((id) => personById.get(id)?.name ?? 'Unknown').join(', ') || 'Not assigned';

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{areaById.get(subArea.areaId)?.name}</p>
        <h1 className="text-xl font-semibold tracking-tight">{subArea.name}</h1>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <div>
          <dt className="text-xs text-slate-500">Area owner</dt>
          <dd className="font-medium">{names(subArea.ownerIds)}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Area manager</dt>
          <dd className="font-medium">{names(subArea.managerIds)}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-xs text-slate-500">Contractors</dt>
          <dd>
            {subArea.contractors.length === 0 ? (
              <span className="text-slate-500">Own team</span>
            ) : (
              <ul className="space-y-0.5">
                {subArea.contractors.map((c) => (
                  <li key={c.contractorId}>
                    <span className="font-medium">{contractorById.get(c.contractorId)?.name ?? c.contractorId}</span>
                    {c.scope && <span className="text-slate-500"> — {c.scope}</span>}
                  </li>
                ))}
              </ul>
            )}
          </dd>
        </div>
      </dl>
    </div>
  );
}
