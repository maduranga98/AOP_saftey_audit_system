import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useConfig } from '@/contexts/ConfigContext';
import { PORTALS, type Portal } from '@/types';
import { Alert, Button, FullScreenSpinner } from './ui';
import { ShieldIcon } from './icons';

export function RequireRole({ portal, children }: { portal: Portal; children: ReactNode }) {
  const { user, roles, loading, signOut } = useAuth();
  const config = useConfig();
  const location = useLocation();
  const navigate = useNavigate();

  if (loading) return <FullScreenSpinner />;
  if (!user) return <Navigate to={`${PORTALS[portal].path}/login`} replace state={{ from: location.pathname }} />;

  if (!roles.includes(PORTALS[portal].role)) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-4 text-center">
          <ShieldIcon className="mx-auto h-10 w-10 text-slate-400" />
          <h1 className="text-lg font-semibold">No access</h1>
          <p className="text-sm text-slate-500">
            Your account can't open the {PORTALS[portal].title} link. Ask the safety officer if you need access.
          </p>
          <Button
            variant="secondary"
            className="w-full"
            onClick={async () => {
              await signOut();
              navigate(`${PORTALS[portal].path}/login`, { replace: true });
            }}
          >
            Sign in with another account
          </Button>
        </div>
      </div>
    );
  }

  if (config.loading && !config.config) return <FullScreenSpinner label="Loading plant setup…" />;
  if (config.error && !config.config) {
    return (
      <div className="mx-auto max-w-md p-6">
        <Alert>
          Could not load plant setup. {navigator.onLine ? config.error : 'Connect to the internet once so this device can download it.'}
        </Alert>
      </div>
    );
  }

  return <>{children}</>;
}
