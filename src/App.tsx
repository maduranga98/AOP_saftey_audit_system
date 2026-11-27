import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { ConfigProvider } from '@/contexts/ConfigContext';
import { AppShell, type NavItem } from '@/components/AppShell';
import { RequireRole } from '@/components/RequireRole';
import { SyncEngine } from '@/components/SyncEngine';
import { FullScreenSpinner } from '@/components/ui';
import { HomeIcon, MapIcon, UsersIcon } from '@/components/icons';
import Landing from '@/pages/Landing';
import Login from '@/pages/auth/Login';
import Setup from '@/pages/auth/Setup';

const AuditHome = lazy(() => import('@/pages/audit/AuditHome'));
const SubAreaStart = lazy(() => import('@/pages/audit/SubAreaStart'));
const AuditForm = lazy(() => import('@/pages/audit/AuditForm'));
const AuditDetail = lazy(() => import('@/pages/audit/AuditDetail'));
const AreaHome = lazy(() => import('@/pages/area/AreaHome'));
const AdminOverview = lazy(() => import('@/pages/admin/AdminOverview'));
const Areas = lazy(() => import('@/pages/admin/Areas'));
const Users = lazy(() => import('@/pages/admin/Users'));

const ADMIN_NAV: NavItem[] = [
  { to: '/admin', label: 'Overview', icon: HomeIcon, end: true },
  { to: '/admin/areas', label: 'Areas', icon: MapIcon },
  { to: '/admin/users', label: 'Users', icon: UsersIcon },
];

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ConfigProvider>
          <SyncEngine />
          <Suspense fallback={<FullScreenSpinner />}>
            <Routes>
              <Route path="/" element={<Landing />} />

              <Route path="/audit/login" element={<Login portal="audit" />} />
              <Route
                path="/audit/*"
                element={
                  <RequireRole portal="audit">
                    <AppShell portal="audit">
                      <Routes>
                        <Route index element={<AuditHome />} />
                        <Route path="sub-area/:subAreaId" element={<SubAreaStart />} />
                        <Route path="form/:draftId" element={<AuditForm />} />
                        <Route path="view/:auditId" element={<AuditDetail />} />
                        <Route path="*" element={<Navigate to="/audit" replace />} />
                      </Routes>
                    </AppShell>
                  </RequireRole>
                }
              />

              <Route path="/area/login" element={<Login portal="area" />} />
              <Route
                path="/area/*"
                element={
                  <RequireRole portal="area">
                    <AppShell portal="area">
                      <Routes>
                        <Route index element={<AreaHome />} />
                        <Route path="*" element={<Navigate to="/area" replace />} />
                      </Routes>
                    </AppShell>
                  </RequireRole>
                }
              />

              <Route path="/admin/login" element={<Login portal="admin" />} />
              <Route path="/admin/setup" element={<Setup />} />
              <Route
                path="/admin/*"
                element={
                  <RequireRole portal="admin">
                    <AppShell portal="admin" nav={ADMIN_NAV}>
                      <Routes>
                        <Route index element={<AdminOverview />} />
                        <Route path="areas" element={<Areas />} />
                        <Route path="users" element={<Users />} />
                        <Route path="*" element={<Navigate to="/admin" replace />} />
                      </Routes>
                    </AppShell>
                  </RequireRole>
                }
              />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </ConfigProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
