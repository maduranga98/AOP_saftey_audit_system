import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useConfig } from '@/contexts/ConfigContext';
import { Badge, Card, EmptyState } from '@/components/ui';

export default function AreaHome() {
  const { uid, name } = useAuth();
  const { config, areaById, contractorById } = useConfig();

  const mine = useMemo(
    () =>
      (config?.subAreas ?? [])
        .filter((s) => s.active && uid && (s.ownerIds.includes(uid) || s.managerIds.includes(uid)))
        .sort((a, b) => a.order - b.order),
    [config, uid],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Hello, {name.split(' ')[0]}</h1>
        <p className="mt-1 text-sm text-slate-500">Your sub-areas. Findings and corrective actions will appear here.</p>
      </div>

      {mine.length === 0 ? (
        <EmptyState title="No sub-areas assigned yet" body="The safety officer assigns area owners and managers. Ask them to add you." />
      ) : (
        <div className="space-y-3">
          {mine.map((s) => (
            <Card key={s.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{areaById.get(s.areaId)?.name}</p>
                  <p className="font-medium">{s.name}</p>
                </div>
                <Badge>{uid && s.ownerIds.includes(uid) ? 'Owner' : 'Manager'}</Badge>
              </div>
              {s.contractors.length > 0 && (
                <p className="mt-2 text-sm text-slate-500">
                  {s.contractors.map((c) => contractorById.get(c.contractorId)?.name ?? c.contractorId).join(', ')}
                </p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
