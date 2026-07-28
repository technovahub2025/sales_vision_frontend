export const ROUTES = {
  login: '/login',
  register: '/register',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password/:token',
  invite: '/invite/:token',
  superAdmin: '/super-admin',
  superAdminUserDatas: '/super-admin/user-datas',
  superAdminWorkspaces: '/super-admin/workspaces',
  superAdminActivity: '/super-admin/activity',
  superAdminSecurity: '/super-admin/security',
  onboarding: '/onboarding',
  dashboard: '/dashboard',
  projects: '/projects',
  myTasks: '/my-tasks',
  myTasksLegacy: '/task-detail',
  campaigns: '/campaigns',
  campaignDetail: '/campaigns/:campaignId',
  projectBoard: '/projects/:projectId/board',
  projectBoardLegacy: '/project-board',
  projectBacklog: '/projects/:projectId/backlog',
  projectSprints: '/projects/:projectId/sprints',
  projectRoadmap: '/projects/:projectId/roadmap',
  projectMembers: '/projects/:projectId/members',
  projectOverview: '/projects/:projectId/overview',
  newTask: '/tasks/new',
  taskDetail: '/task-detail',
  taskDetailById: '/tasks/:taskId',
  employees: '/employees',
  employeeDetail: '/employees/:employeeId',
  employeeManagement: '/employee-management',
  leads: '/leads',
  leadEdit: '/leads/:leadId/edit',
  clientDetail: '/clients/:clientId',
  leadManagement: '/lead-management',
  contacts: '/contacts',
  analytics: '/analytics',
  settings: '/settings',
  settingsWorkspace: '/settings/workspace',
  settingsMembers: '/settings/members',
  settingsSecurity: '/settings/security',
};

export function projectRoute(path, projectId) {
  const safeProjectId =
    projectId ||
    window.localStorage.getItem('salesvision:projectId') ||
    window.localStorage.getItem('salevision:projectId') ||
    '';
  if (!safeProjectId) {
    return ROUTES.projectBoardLegacy;
  }
  return `/projects/${safeProjectId}/${path}`;
}
