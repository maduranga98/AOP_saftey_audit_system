import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { ConfigProvider } from '@/contexts/ConfigContext';
import { AppShell, type NavItem } from '@/components/AppShell';
import { RequireRole } from '@/components/RequireRole';
import { SyncEngine } from '@/components/SyncEngine';
import { FullScreenSpinner } from '@/components/ui';
import { ClipboardIcon, HomeIcon, MapIcon, SettingsIcon, UsersIcon, WrenchIcon } from '@/components/icons';
import Landing from '@/pages/Landing';
import Login from '@/pages/auth/Login';
import Setup from '@/pages/auth/Setup';

const AuditHome = lazy(() => import('@/pages/audit/AuditHome'));
const SubAreaStart = lazy(() => import('@/pages/audit/SubAreaStart'));
const AuditForm = lazy(() => import('@/pages/audit/AuditForm'));
const AuditDetail = lazy(() => import('@/pages/audit/AuditDetail'));
const AreaHome = lazy(() => import('@/pages/area/AreaHome'));
const ActionDetail = lazy(() => import('@/pages/area/ActionDetail'));
const ClosedActions = lazy(() => import('@/pages/area/ClosedActions'));
const AdminOverview = lazy(() => import('@/pages/admin/AdminOverview'));
const Areas = lazy(() => import('@/pages/admin/Areas'));
const Users = lazy(() => import('@/pages/admin/Users'));
const SubAreaEditor = lazy(() => import('@/pages/admin/SubAreaEditor'));
const Settings = lazy(() => import('@/pages/admin/Settings'));
const Audits = lazy(() => import('@/pages/admin/Audits'));
const AdminAuditDetail = lazy(() => import('@/pages/admin/AdminAuditDetail'));
const Actions = lazy(() => import('@/pages/admin/Actions'));

const ADMIN_NAV: NavItem[] = [
  { to: '/admin', label: 'Overview', icon: HomeIcon, end: true },
  { to: '/admin/audits', label: 'Audits', icon: ClipboardIcon },
  { to: '/admin/actions', label: 'Actions', icon: WrenchIcon },
  { to: '/admin/areas', label: 'Areas', icon: MapIcon },
  { to: '/admin/users', label: 'Users', icon: UsersIcon },
  { to: '/admin/settings', label: 'Settings', icon: SettingsIcon },
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
                        <Route path="action/:actionId" element={<ActionDetail />} />
                        <Route path="closed" element={<ClosedActions />} />
                        <Route path="audit/:auditId" element={<AuditDetail backTo="/area" />} />
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
                        <Route path="audits" element={<Audits />} />
                        <Route path="audits/:auditId" element={<AdminAuditDetail />} />
                        <Route path="actions" element={<Actions />} />
                        <Route path="actions/:actionId" element={<ActionDetail base="/admin" />} />
                        <Route path="areas" element={<Areas />} />
                        <Route path="areas/:subAreaId" element={<SubAreaEditor />} />
                        <Route path="settings" element={<Settings />} />
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
