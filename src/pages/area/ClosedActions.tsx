import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useClosedActions } from '@/hooks/useAreaData';
import { ActionRow } from '@/components/ActionRow';
import { Card, EmptyState, Spinner } from '@/components/ui';
import { ArrowLeftIcon } from '@/components/icons';

export default function ClosedActions() {
  const { uid } = useAuth();
  const actions = useClosedActions(uid);

  return (
    <div className="space-y-5">
      <Link to="/area" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeftIcon width={16} height={16} /> Back
      </Link>
      <h1 className="text-xl font-semibold tracking-tight">Closed actions</h1>
      {actions === null ? (
        <div className="flex justify-center py-8 text-slate-400"><Spinner /></div>
      ) : actions.length === 0 ? (
        <EmptyState title="No closed actions yet" />
      ) : (
        <Card className="divide-y divide-slate-100">
          {actions.map((a) => (
            <div key={a.id}>
              <p className="px-4 pt-3 text-xs font-medium text-slate-500">{a.subAreaName}</p>
              <ActionRow action={a} to={`/area/action/${a.id}`} closed />
            </div>
          ))}
        </Card>
      )}
      <p className="text-center text-xs text-slate-400">Showing the latest 30</p>
    </div>
  );
}
