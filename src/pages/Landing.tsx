import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { PORTALS, type Portal } from '@/types';
import { ChevronRightIcon, ShieldIcon } from '@/components/icons';
import { FullScreenSpinner } from '@/components/ui';

const ORDER: Portal[] = ['audit', 'area', 'admin'];
const BLURB: Record<Portal, string> = {
  audit: 'Score sub-areas against the AOP checklist',
  area: 'See findings for your areas and close actions',
  admin: 'Dashboard, setup, users and exports',
};

/** Root page. Users normally arrive through their own link; this lists the links. */
export default function Landing() {
  const { user, roles, loading } = useAuth();
  if (loading) return <FullScreenSpinner />;

  const mine = ORDER.filter((p) => roles.includes(PORTALS[p].role));
  if (user && mine.length === 1) return <Navigate to={PORTALS[mine[0]].path} replace />;
  const list = user && mine.length > 1 ? mine : ORDER;

  return (
    <div className="flex min-h-dvh items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900">
            <ShieldIcon className="text-green-400" width={26} height={26} />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">AOP Safety Audit</h1>
          <p className="text-sm text-slate-500">Area Ownership Program</p>
        </div>
        <div className="divide-y divide-slate-100 overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
          {list.map((p) => (
            <Link key={p} to={PORTALS[p].path} className="flex items-center gap-3 px-4 py-4 hover:bg-slate-50">
              <div className="flex-1">
                <div className="font-medium">{PORTALS[p].title}</div>
                <div className="text-sm text-slate-500">{BLURB[p]}</div>
              </div>
              <ChevronRightIcon className="text-slate-400" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
