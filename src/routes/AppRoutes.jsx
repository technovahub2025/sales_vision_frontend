import { Component, lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import SuperAdminLayout from '../layouts/SuperAdminLayout';
import { SocketProvider } from '../contexts/SocketContext';
import { ROUTES } from './routePaths';
import ProtectedAppLayout from './ProtectedAppLayout';
import WorkspaceAppLayout from './WorkspaceAppLayout';
import RoleGuard from './RoleGuard';
import { useAuth } from '../contexts/AuthContext';

const AnalyticsPage = lazy(() => import('../pages/analytics/AnalyticsPage'));
const CampaignsPage = lazy(() => import('../pages/campaigns/CampaignsPage'));
const CampaignDetailPage = lazy(() => import('../pages/campaigns/CampaignDetailPage'));
const ContactsPage = lazy(() => import('../pages/contacts/ContactsPage'));
const ClientDetailPage = lazy(() => import('../pages/contacts/ClientDetailPage'));
const DashboardPage = lazy(() => import('../pages/dashboard/DashboardPage'));
const EmployeeManagementPage = lazy(() => import('../pages/employee-management/EmployeeManagementPage'));
const EmployeeDetailPage = lazy(() => import('../pages/employee-management/EmployeeDetailPage'));
const LeadManagementPage = lazy(() => import('../pages/lead-management/LeadManagementPage'));
const NotFoundPage = lazy(() => import('../pages/NotFoundPage'));
const ProjectBoardPage = lazy(() => import('../pages/project-board/ProjectBoardRoutePage'));
const BacklogPage = lazy(() => import('../pages/project-board/BacklogPage'));
const SprintsPage = lazy(() => import('../pages/project-board/SprintsPage'));
const RoadmapPage = lazy(() => import('../pages/project-board/RoadmapPage'));
const ProjectMembersPage = lazy(() => import('../pages/project-board/ProjectMembersPage'));
const ProjectOverviewPage = lazy(() => import('../pages/project-board/ProjectOverviewPage'));
const ProjectsPage = lazy(() => import('../pages/projects/ProjectsPage'));
const MyTasksPage = lazy(() => import('../pages/tasks/MyTasksPage'));
const NewTaskPage = lazy(() => import('../pages/tasks/NewTaskPage'));
const TaskDetailPage = lazy(() => import('../pages/task-detail/TaskDetailPage'));
const SettingsSecurityPage = lazy(() => import('../pages/settings/SettingsSecurityPage'));
const SettingsPage = lazy(() => import('../pages/settings/SettingsPage'));
const SettingsWorkspacePage = lazy(() => import('../pages/settings/SettingsWorkspacePage'));
const SettingsMembersPage = lazy(() => import('../pages/settings/SettingsMembersPage'));
const OnboardingPage = lazy(() => import('../pages/onboarding/OnboardingPage'));

const LoginPage = lazy(() => import('../pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('../pages/auth/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('../pages/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('../pages/auth/ResetPasswordPage'));
const InvitePage = lazy(() => import('../pages/auth/InvitePage'));
const SuperAdminPage = lazy(() => import('../pages/super-admin/SuperAdminPage'));
const SuperAdminUserDatasPage = lazy(() => import('../pages/super-admin/SuperAdminUserDatasPage'));
const SuperAdminWorkspacesPage = lazy(() => import('../pages/super-admin/SuperAdminWorkspacesPage'));
const SuperAdminActivityPage = lazy(() => import('../pages/super-admin/SuperAdminActivityPage'));
const SuperAdminSecurityPage = lazy(() => import('../pages/super-admin/SuperAdminSecurityPage'));

function RouteFallback() {
  return <div className="animate-pulse rounded-xl bg-surface-container-low p-6 text-sm text-on-surface-variant">Loading...</div>;
}

class RouteErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('RouteErrorBoundary caught an error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-6 text-sm text-on-surface-variant">
          Something went wrong in this page. Please refresh and try again.
        </div>
      );
    }

    return this.props.children;
  }
}

function lazyElement(PageComponent) {
  return (
    <RouteErrorBoundary>
      <Suspense fallback={<RouteFallback />}>
        <PageComponent />
      </Suspense>
    </RouteErrorBoundary>
  );
}

function LegacyProjectRedirect() {
  const projectId =
    window.localStorage.getItem('salesvision:projectId') ||
    window.localStorage.getItem('salevision:projectId');
  if (!projectId) {
    return <Navigate replace to={ROUTES.dashboard} />;
  }
  return <Navigate replace to={`/projects/${projectId}/board`} />;
}

function RedirectIfAuthenticated({ to = ROUTES.dashboard, children }) {
  const { isAuthenticated, isLoading, isSuperAdmin } = useAuth();

  if (isLoading) {
    return <RouteFallback />;
  }

  if (isAuthenticated) {
    return <Navigate replace to={isSuperAdmin ? ROUTES.superAdmin : to} />;
  }

  return children;
}

function SuperAdminOnly({ children }) {
  const { isSuperAdmin } = useAuth();
  return isSuperAdmin ? children : <Navigate replace to={ROUTES.dashboard} />;
}

function WorkspaceOnly({ children }) {
  const { isSuperAdmin } = useAuth();
  return isSuperAdmin ? <Navigate replace to={ROUTES.superAdmin} /> : children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route
        path={ROUTES.login}
        element={<RedirectIfAuthenticated>{lazyElement(LoginPage)}</RedirectIfAuthenticated>}
      />
      <Route
        path={ROUTES.register}
        element={<RedirectIfAuthenticated>{lazyElement(RegisterPage)}</RedirectIfAuthenticated>}
      />
      <Route
        path={ROUTES.forgotPassword}
        element={<RedirectIfAuthenticated>{lazyElement(ForgotPasswordPage)}</RedirectIfAuthenticated>}
      />
      <Route path={ROUTES.resetPassword} element={lazyElement(ResetPasswordPage)} />
      <Route path={ROUTES.invite} element={<RedirectIfAuthenticated>{lazyElement(InvitePage)}</RedirectIfAuthenticated>} />
      <Route element={<ProtectedAppLayout />}>
        <Route element={<SuperAdminOnly><SocketProvider><SuperAdminLayout /></SocketProvider></SuperAdminOnly>}>
          <Route path={ROUTES.superAdmin} element={lazyElement(SuperAdminPage)} />
          <Route path={ROUTES.superAdminUserDatas} element={lazyElement(SuperAdminUserDatasPage)} />
          <Route path={ROUTES.superAdminWorkspaces} element={lazyElement(SuperAdminWorkspacesPage)} />
          <Route path={ROUTES.superAdminActivity} element={lazyElement(SuperAdminActivityPage)} />
          <Route path={ROUTES.superAdminSecurity} element={lazyElement(SuperAdminSecurityPage)} />
        </Route>

        <Route element={<WorkspaceOnly><WorkspaceAppLayout /></WorkspaceOnly>}>
          <Route index element={<Navigate replace to={ROUTES.dashboard} />} />

          <Route path={ROUTES.dashboard} element={lazyElement(DashboardPage)} />
          <Route path={ROUTES.projects} element={lazyElement(ProjectsPage)} />
          <Route path={ROUTES.myTasks} element={lazyElement(MyTasksPage)} />
          <Route path={ROUTES.newTask} element={lazyElement(NewTaskPage)} />
          <Route path={ROUTES.taskDetail} element={lazyElement(TaskDetailPage)} />
          <Route path={ROUTES.taskDetailById} element={lazyElement(TaskDetailPage)} />

          <Route path={ROUTES.projectBoard} element={lazyElement(ProjectBoardPage)} />
          <Route path={ROUTES.projectBacklog} element={lazyElement(BacklogPage)} />
          <Route path={ROUTES.projectSprints} element={lazyElement(SprintsPage)} />
          <Route path={ROUTES.projectRoadmap} element={lazyElement(RoadmapPage)} />
          <Route path={ROUTES.projectMembers} element={lazyElement(ProjectMembersPage)} />
          <Route path={ROUTES.projectOverview} element={lazyElement(ProjectOverviewPage)} />

          <Route path={ROUTES.leads} element={<RoleGuard allow={['owner', 'admin', 'member']}>{lazyElement(LeadManagementPage)}</RoleGuard>} />
          <Route path={ROUTES.clientDetail} element={<RoleGuard allow={['owner', 'admin', 'member']}>{lazyElement(ClientDetailPage)}</RoleGuard>} />
          <Route path={ROUTES.employees} element={lazyElement(EmployeeManagementPage)} />
          <Route path={ROUTES.employeeDetail} element={lazyElement(EmployeeDetailPage)} />

          <Route path={ROUTES.campaigns} element={<RoleGuard allow={['owner', 'admin', 'member']}>{lazyElement(CampaignsPage)}</RoleGuard>} />
          <Route path={ROUTES.campaignDetail} element={<RoleGuard allow={['owner', 'admin', 'member']}>{lazyElement(CampaignDetailPage)}</RoleGuard>} />
          <Route path={ROUTES.contacts} element={<RoleGuard allow={['owner', 'admin', 'member']}>{lazyElement(ContactsPage)}</RoleGuard>} />
          <Route path={ROUTES.analytics} element={lazyElement(AnalyticsPage)} />
          <Route path={ROUTES.settings} element={lazyElement(SettingsPage)} />
          <Route path={ROUTES.settingsWorkspace} element={lazyElement(SettingsWorkspacePage)} />
          <Route
            path={ROUTES.settingsMembers}
            element={<RoleGuard allow={['owner', 'admin']}>{lazyElement(SettingsMembersPage)}</RoleGuard>}
          />
          <Route
            path={ROUTES.settingsSecurity}
            element={<RoleGuard allow={['owner', 'admin']}>{lazyElement(SettingsSecurityPage)}</RoleGuard>}
          />
          <Route path={ROUTES.onboarding} element={lazyElement(OnboardingPage)} />

          <Route path={ROUTES.projectBoardLegacy} element={<LegacyProjectRedirect />} />
          <Route path={ROUTES.leadManagement} element={<Navigate replace to={ROUTES.leads} />} />
          <Route path={ROUTES.employeeManagement} element={<Navigate replace to={ROUTES.employees} />} />
        </Route>
      </Route>

      <Route path="*" element={lazyElement(NotFoundPage)} />
    </Routes>
  );
}

export default AppRoutes;
