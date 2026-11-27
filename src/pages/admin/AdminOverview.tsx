import { Link } from 'react-router-dom';
import { useConfig } from '@/contexts/ConfigContext';
import { Card, PageHeader } from '@/components/ui';
import { ROLE_LABEL, type Role } from '@/types';

function Stat({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <Card className="p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </Card>
  );
}

export default function AdminOverview() {
  const { config, checklists } = useConfig();
  const subAreas = (config?.subAreas ?? []).filter((s) => s.active);
  const people = (config?.people ?? []).filter((p) => p.active);
  const observations = subAreas.reduce((n, s) => n + (checklists?.lists[s.id]?.filter((o) => o.active).length ?? 0), 0);
  const unassigned = subAreas.filter((s) => s.ownerIds.length === 0 && s.managerIds.length === 0);
  const byRole = (r: Role) => people.filter((p) => p.roles.includes(r)).length;

  return (
    <div>
      <PageHeader title="Overview" subtitle="Plant setup at a glance. The audit dashboard arrives with the dashboard release." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Areas" value={config?.areas.length ?? 0} />
        <Stat label="Sub-areas" value={subAreas.length} />
        <Stat label="Observations" value={observations} />
        <Stat label="Active users" value={people.length} hint={(['auditor', 'area', 'admin'] as Role[]).map((r) => `${byRole(r)} ${ROLE_LABEL[r].toLowerCase()}`).join(' · ')} />
      </div>

      <h2 className="mb-3 mt-8 text-sm font-semibold text-slate-900">Setup to finish</h2>
      <Card className="divide-y divide-slate-100">
        <SetupRow done={people.some((p) => p.roles.includes('auditor'))} label="Add at least one auditor" to="/admin/users" />
        <SetupRow done={people.some((p) => p.roles.includes('area'))} label="Add area owners and managers" to="/admin/users" />
        <SetupRow
          done={unassigned.length === 0}
          label={unassigned.length === 0 ? 'Every sub-area has an owner or manager' : `${unassigned.length} sub-areas have no owner or manager`}
          to="/admin/areas"
        />
      </Card>
    </div>
  );
}

function SetupRow({ done, label, to }: { done: boolean; label: string; to: string }) {
  return (
    <Link to={to} className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-slate-50">
      <span className={done ? 'h-2.5 w-2.5 rounded-full bg-green-500' : 'h-2.5 w-2.5 rounded-full bg-amber-500'} />
      <span className="flex-1">{label}</span>
      <span className="text-slate-400">→</span>
    </Link>
  );
}
