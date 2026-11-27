import { Link, NavLink, useNavigate, type To } from 'react-router-dom';
import type { ComponentType, ReactNode, SVGProps } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { PORTALS, type Portal } from '@/types';
import { LogOutIcon, ShieldIcon } from './icons';
import { SyncBar } from './SyncBar';
import { cx } from './ui';

export interface NavItem {
  to: To;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  end?: boolean;
}

export function AppShell({ portal, nav, children }: { portal: Portal; nav?: NavItem[]; children: ReactNode }) {
  const { name, empNo, roles, signOut } = useAuth();
  const navigate = useNavigate();
  const otherPortals = (Object.keys(PORTALS) as Portal[]).filter((p) => p !== portal && roles.includes(PORTALS[p].role));
  const wide = portal === 'admin';

  const onSignOut = async () => {
    await signOut();
    navigate(`${PORTALS[portal].path}/login`, { replace: true });
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className={cx('mx-auto flex h-14 items-center gap-3 px-4', wide ? 'max-w-7xl' : 'max-w-2xl')}>
          <Link to={PORTALS[portal].path} className="flex items-center gap-2 font-semibold">
            <ShieldIcon className="text-green-600" />
            <span>AOP</span>
            <span className="hidden text-sm font-normal text-slate-500 sm:inline">· {PORTALS[portal].title}</span>
          </Link>
          <div className="ml-auto flex items-center gap-1">
            {otherPortals.map((p) => (
              <Link key={p} to={PORTALS[p].path} className="hidden rounded-md px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 sm:block">
                Switch to {PORTALS[p].title}
              </Link>
            ))}
            <div className="hidden text-right leading-tight sm:block">
              <div className="text-sm font-medium">{name}</div>
              <div className="text-xs text-slate-500">{empNo}</div>
            </div>
            <button onClick={onSignOut} className="ml-2 rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900" aria-label="Sign out" title="Sign out">
              <LogOutIcon />
            </button>
          </div>
        </div>
        <SyncBar />
      </header>

      {nav && nav.length > 0 ? (
        <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col md:flex-row">
          <nav className="sticky top-14 z-20 flex gap-1 overflow-x-auto border-b border-slate-200 bg-white px-2 py-2 md:h-[calc(100dvh-3.5rem)] md:w-56 md:flex-col md:border-b-0 md:border-r md:bg-transparent md:px-3 md:py-6">
            {nav.map((item) => (
              <NavLink
                key={String(item.to)}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cx(
                    'flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium',
                    isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                  )
                }
              >
                <item.icon width={18} height={18} />
                {item.label}
              </NavLink>
            ))}
          </nav>
          <main className="min-w-0 flex-1 px-4 py-6 md:px-8">{children}</main>
        </div>
      ) : (
        <main className={cx('mx-auto w-full flex-1 px-4 py-6', wide ? 'max-w-7xl' : 'max-w-2xl')}>{children}</main>
      )}
    </div>
  );
}
