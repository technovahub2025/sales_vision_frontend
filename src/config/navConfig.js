import { ROUTES } from '../routes/routePaths';

export const NAV_CONFIG = [
  { label: 'Dashboard', icon: 'dashboard', path: ROUTES.dashboard, roles: 'all' },
  { label: 'My Tasks', icon: 'assignment', path: ROUTES.myTasks, roles: 'all' },
  { label: 'Projects', icon: 'pinboard', path: ROUTES.projects, roles: 'all' },
  { label: 'Leads', icon: 'leaderboard', path: ROUTES.leads, roles: 'all' },
  { label: 'Campaigns', icon: 'campaign', path: ROUTES.campaigns, roles: 'all' },
  { label: 'Employees', icon: 'group', path: ROUTES.employees, roles: 'all' },
  { label: 'Analytics', icon: 'analytics', path: ROUTES.analytics, roles: 'all' },
];
