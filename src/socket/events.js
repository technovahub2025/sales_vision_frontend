export const EVENTS = {
  REALTIME_EVENT: 'realtime:event',
  WORKSPACE_JOIN: 'workspace:join',
  WORKSPACE_JOINED: 'workspace:joined',
  WORKSPACE_JOIN_ERROR: 'workspace:join_error',

  TASK_CREATED: 'task:created',
  TASK_UPDATED: 'task:updated',
  TASK_MOVED: 'task:moved',
  TASK_DELETED: 'task:deleted',
  TASK_ASSIGNED: 'task:assignedToMe',
  TASK_UNASSIGNED: 'task:unassigned',
  TASK_APPROVED: 'task:approved',

  LEAD_CREATED: 'lead:created',
  LEAD_UPDATED: 'lead:updated',
  LEAD_MOVED: 'lead:moved',
  LEAD_DELETED: 'lead:deleted',
  CAMPAIGN_CREATED: 'campaign:created',
  CAMPAIGN_UPDATED: 'campaign:updated',
  CAMPAIGN_DELETED: 'campaign:deleted',
  CAMPAIGN_STATUS_CHANGED: 'campaign:status_changed',

  CLIENT_CREATED: 'client:created',
  CLIENT_UPDATED: 'client:updated',
  SETTINGS_UPDATED: 'settings:updated',
  SECURITY_UPDATED: 'security:updated',

  EMPLOYEE_UPDATED: 'employee:updated',

  PROJECT_UPDATED: 'project:updated',
  PROJECT_MEMBER_ADDED: 'project:memberAdded',
  PROJECT_MEMBER_REMOVED: 'project:memberRemoved',

  TEAM_UPDATED: 'team:updated',
  TEAM_MEMBER_CHANGED: 'team:memberChanged',

  DASHBOARD_UPDATED: 'dashboard:updated',
  DASHBOARD_REFRESHED: 'dashboard:refreshed',
  ANALYTICS_UPDATED: 'analytics:updated',

  BOARD_UPDATED: 'board:updated',
  BOARD_REFRESHED: 'board:refreshed',
  BOARD_COLUMN_CREATED: 'board:column_created',
  BOARD_COLUMN_DELETED: 'board:column_deleted',
  BOARD_VIEW_UPDATED: 'board:view_updated',

  COMMENT_CREATED: 'comment:created',
  COMMENT_UPDATED: 'comment:updated',

  NOTIFICATION_NEW: 'notification:new',
  NOTIFY_MENTION: 'notify:mention',

  TIMER_STARTED: 'timer:started',
  TIMER_STOPPED: 'timer:stopped',
  TIMER_PAUSED: 'timer:paused',
  TIMER_RESUMED: 'timer:resumed',
  TIMELOG_CREATED: 'timeLog:created',

  SPRINT_CREATED: 'sprint:created',
  SPRINT_UPDATED: 'sprint:updated',
  SPRINT_STARTED: 'sprint:started',
  SPRINT_COMPLETED: 'sprint:completed',

  WORKFLOW_CREATED: 'workflow:created',
  WORKFLOW_UPDATED: 'workflow:updated',
  WORKFLOW_STATUS_CREATED: 'workflow_status:created',
  WORKFLOW_STATUS_UPDATED: 'workflow_status:updated',
  WORKFLOW_TRANSITION_CREATED: 'workflow_transition:created',
  WORKFLOW_TRANSITION_DELETED: 'workflow_transition:deleted',
  BOT_DRAFT_UPDATED: 'bot_draft:updated',
  BOT_PUBLISHED_CREATED: 'bot_published:created',

  ACTIVITY_APPENDED: 'activity:appended',
  SUPERADMIN_USERS_UPDATED: 'superadmin:users_updated',
};
