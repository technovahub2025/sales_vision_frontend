import { apiRequest, axiosClient } from './axiosClient';
import { wsV1 } from './ws';

export const dashboardApi = {
  get: (workspaceId, { view = 'workspace', userId } = {}, signal) =>
    apiRequest({
      method: 'get',
      url: wsV1(workspaceId, '/dashboard'),
      signal,
      params: { view, ...(userId ? { userId } : {}) },
      dedupeKey: `dashboard:${workspaceId}:${view}:${userId || 'workspace'}`,
    }),
  exportReport: async (workspaceId, format = 'pdf') => {
    const response = await axiosClient.post(wsV1(workspaceId, '/dashboard/export-report'), { format }, {
      responseType: 'blob',
      withCredentials: true,
    });
    const disposition = String(response.headers?.['content-disposition'] || '');
    const match = disposition.match(/filename="?([^"]+)"?/i);
    return {
      blob: response.data,
      filename: match?.[1] || `salesvision_dashboard.${String(format || 'pdf').toLowerCase()}`,
      contentType: response.headers?.['content-type'] || '',
    };
  },
  strategyMeeting: (workspaceId) =>
    apiRequest({ method: 'post', url: wsV1(workspaceId, '/dashboard/strategy-meeting'), data: {} }),
};

export const projectsApi = {
  list: (workspaceId, params, signal) =>
    apiRequest({
      method: 'get',
      url: wsV1(workspaceId, '/projects'),
      params,
      signal,
      dedupeKey: `projects:${workspaceId}:${JSON.stringify(params || {})}`,
    }),
  create: (workspaceId, data) => apiRequest({ method: 'post', url: wsV1(workspaceId, '/projects'), data }),
  update: (workspaceId, projectId, data) =>
    apiRequest({ method: 'patch', url: wsV1(workspaceId, `/projects/${projectId}`), data }),
  delete: (workspaceId, projectId) =>
    apiRequest({ method: 'delete', url: wsV1(workspaceId, `/projects/${projectId}`) }),
  overview: (workspaceId, projectId, signal) =>
    apiRequest({
      method: 'get',
      url: wsV1(workspaceId, `/projects/${projectId}/overview`),
      signal,
      dedupeKey: `project-overview:${workspaceId}:${projectId}`,
    }),
  timeLogs: (workspaceId, projectId, params, signal) =>
    apiRequest({ method: 'get', url: wsV1(workspaceId, `/projects/${projectId}/time-logs`), params, signal }),
  members: (workspaceId, projectId, signal) =>
    apiRequest({
      method: 'get',
      url: wsV1(workspaceId, `/projects/${projectId}/members`),
      signal,
      dedupeKey: `project-members:${workspaceId}:${projectId}`,
    }),
  addMember: (workspaceId, projectId, data) =>
    apiRequest({ method: 'post', url: wsV1(workspaceId, `/projects/${projectId}/members`), data }),
  updateMemberRole: (workspaceId, projectId, userId, data) =>
    apiRequest({ method: 'patch', url: wsV1(workspaceId, `/projects/${projectId}/members/${userId}`), data }),
  removeMember: (workspaceId, projectId, userId) =>
    apiRequest({ method: 'delete', url: wsV1(workspaceId, `/projects/${projectId}/members/${userId}`) }),
  board: (workspaceId, projectId, params, signal) =>
    apiRequest({ method: 'get', url: wsV1(workspaceId, `/projects/${projectId}/board`), params, signal, dedupeKey: `board:${workspaceId}:${projectId}` }),
  updateBoardView: (workspaceId, projectId, view) =>
    apiRequest({ method: 'patch', url: wsV1(workspaceId, `/projects/${projectId}/board/view`), data: view }),
  addBoardColumn: (workspaceId, projectId, data) =>
    apiRequest({ method: 'post', url: wsV1(workspaceId, `/projects/${projectId}/board/columns`), data }),
  removeBoardColumn: (workspaceId, projectId, columnKey, data) =>
    apiRequest({ method: 'delete', url: wsV1(workspaceId, `/projects/${projectId}/board/columns/${columnKey}`), data }),
  updateBoardColumn: (workspaceId, projectId, columnKey, data) =>
    apiRequest({ method: 'patch', url: wsV1(workspaceId, `/projects/${projectId}/board/columns/${columnKey}`), data }),
  createBoardTask: (workspaceId, projectId, data) =>
    apiRequest({ method: 'post', url: wsV1(workspaceId, `/projects/${projectId}/board/tasks`), data }),
  moveBoardTask: (workspaceId, projectId, taskId, data) =>
    apiRequest({ method: 'patch', url: wsV1(workspaceId, `/projects/${projectId}/board/tasks/${taskId}/move`), data }),
  removeBoardTask: (workspaceId, projectId, taskId) =>
    apiRequest({ method: 'delete', url: wsV1(workspaceId, `/projects/${projectId}/board/tasks/${taskId}`) }),
};

export const teamsApi = {
  list: (workspaceId, params, signal) =>
    apiRequest({ method: 'get', url: wsV1(workspaceId, '/teams'), params, signal, dedupeKey: `teams:${workspaceId}` }),
  create: (workspaceId, data) => apiRequest({ method: 'post', url: wsV1(workspaceId, '/teams'), data }),
  get: (workspaceId, id, signal) => apiRequest({ method: 'get', url: wsV1(workspaceId, `/teams/${id}`), signal }),
  update: (workspaceId, id, data) => apiRequest({ method: 'patch', url: wsV1(workspaceId, `/teams/${id}`), data }),
  addMember: (workspaceId, id, data) => apiRequest({ method: 'post', url: wsV1(workspaceId, `/teams/${id}/members`), data }),
  removeMember: (workspaceId, id, userId) =>
    apiRequest({ method: 'delete', url: wsV1(workspaceId, `/teams/${id}/members/${userId}`) }),
  workload: (workspaceId, id, signal) => apiRequest({ method: 'get', url: wsV1(workspaceId, `/teams/${id}/workload`), signal }),
};

export const tasksApi = {
  list: (workspaceId, params, signal) => apiRequest({ method: 'get', url: wsV1(workspaceId, '/tasks'), params, signal }),
  get: (workspaceId, id, signal) => apiRequest({ method: 'get', url: wsV1(workspaceId, `/tasks/${id}`), signal }),
  create: (workspaceId, data) => apiRequest({ method: 'post', url: wsV1(workspaceId, '/tasks'), data }),
  duplicate: (workspaceId, taskId) => apiRequest({ method: 'post', url: wsV1(workspaceId, `/tasks/${taskId}/duplicate`), data: {} }),
  activity: (workspaceId, taskId, params, signal) =>
    apiRequest({ method: 'get', url: wsV1(workspaceId, `/tasks/${taskId}/activity`), params, signal }),
  setEstimate: (workspaceId, taskId, minutes) =>
    apiRequest({ method: 'patch', url: wsV1(workspaceId, `/tasks/${taskId}/estimate`), data: { minutes } }),
  exportCsv: async (workspaceId, params) => {
    const response = await axiosClient.get(wsV1(workspaceId, '/tasks/export/csv'), {
      params,
      responseType: 'blob',
      withCredentials: true,
    });
    return response.data;
  },
  listAttachments: (workspaceId, taskId, signal) =>
    apiRequest({ method: 'get', url: wsV1(workspaceId, `/tasks/${taskId}/attachments`), signal }),
  createAttachment: (workspaceId, taskId, data) =>
    apiRequest({ method: 'post', url: wsV1(workspaceId, `/tasks/${taskId}/attachments`), data }),
  startTimer: (workspaceId, taskId, data) =>
    apiRequest({ method: 'post', url: wsV1(workspaceId, `/tasks/${taskId}/timer/start`), data }),
  stopTimer: (workspaceId, taskId, data) => apiRequest({ method: 'post', url: wsV1(workspaceId, `/tasks/${taskId}/timer/stop`), data }),
  pauseTimer: (workspaceId, taskId, data) => apiRequest({ method: 'post', url: wsV1(workspaceId, `/tasks/${taskId}/timer/pause`), data }),
  resumeTimer: (workspaceId, taskId, data) => apiRequest({ method: 'post', url: wsV1(workspaceId, `/tasks/${taskId}/timer/resume`), data }),
  createManualTimeLog: (workspaceId, taskId, data) =>
    apiRequest({ method: 'post', url: wsV1(workspaceId, `/tasks/${taskId}/time-log`), data }),
  listTimeLogs: (workspaceId, taskId, params, signal) =>
    apiRequest({ method: 'get', url: wsV1(workspaceId, `/tasks/${taskId}/time-logs`), params, signal }),
  dependencies: (workspaceId, taskId, signal) =>
    apiRequest({ method: 'get', url: wsV1(workspaceId, `/tasks/${taskId}/dependencies`), signal }),
  addDependency: (workspaceId, taskId, data) =>
    apiRequest({ method: 'post', url: wsV1(workspaceId, `/tasks/${taskId}/dependencies`), data }),
  removeDependency: (workspaceId, taskId, dependencyId) =>
    apiRequest({ method: 'delete', url: wsV1(workspaceId, `/tasks/${taskId}/dependencies/${dependencyId}`) }),
  setBacklogOrder: (workspaceId, taskId, backlogOrder) =>
    apiRequest({ method: 'patch', url: wsV1(workspaceId, `/tasks/${taskId}/backlog-order`), data: { backlogOrder } }),
  approve: (workspaceId, taskId, data) => apiRequest({ method: 'patch', url: wsV1(workspaceId, `/tasks/${taskId}/approve`), data }),
  addAttachmentUrl: (workspaceId, taskId, data) =>
    apiRequest({ method: 'post', url: wsV1(workspaceId, `/tasks/${taskId}/attachments/url`), data }),
  removeAttachment: (workspaceId, taskId, attachmentId) =>
    apiRequest({ method: 'delete', url: wsV1(workspaceId, `/tasks/${taskId}/attachments/${attachmentId}`) }),
  removeAttachmentUrl: (workspaceId, taskId, attachmentId) =>
    apiRequest({ method: 'delete', url: wsV1(workspaceId, `/tasks/${taskId}/attachments/url/${attachmentId}`) }),
  update: (workspaceId, id, data) => apiRequest({ method: 'patch', url: wsV1(workspaceId, `/tasks/${id}`), data }),
  updateStatus: (workspaceId, taskId, statusOrPayload) =>
    apiRequest({
      method: 'patch',
      url: wsV1(workspaceId, `/tasks/${taskId}/status`),
      data: typeof statusOrPayload === 'string' ? { status: statusOrPayload } : (statusOrPayload || {}),
    }),
  bulkUpdate: (workspaceId, payload) =>
    apiRequest({ method: 'patch', url: wsV1(workspaceId, '/tasks/bulk'), data: payload }),
  remove: (workspaceId, id) => apiRequest({ method: 'delete', url: wsV1(workspaceId, `/tasks/${id}`) }),
};

export const workflowApi = {
  list: (workspaceId, params, signal) => apiRequest({ method: 'get', url: wsV1(workspaceId, '/workflows'), params, signal }),
  create: (workspaceId, data) => apiRequest({ method: 'post', url: wsV1(workspaceId, '/workflows'), data }),
  ensureDefault: (workspaceId) => apiRequest({ method: 'post', url: wsV1(workspaceId, '/workflows/ensure-default') }),
  listStatuses: (workspaceId, workflowId, signal) =>
    apiRequest({ method: 'get', url: wsV1(workspaceId, `/workflows/${workflowId}/statuses`), signal }),
  createStatus: (workspaceId, workflowId, data) =>
    apiRequest({ method: 'post', url: wsV1(workspaceId, `/workflows/${workflowId}/statuses`), data }),
  updateStatus: (workspaceId, workflowId, statusId, data) =>
    apiRequest({ method: 'patch', url: wsV1(workspaceId, `/workflows/${workflowId}/statuses/${statusId}`), data }),
  listTransitions: (workspaceId, workflowId, signal) =>
    apiRequest({ method: 'get', url: wsV1(workspaceId, `/workflows/${workflowId}/transitions`), signal }),
  createTransition: (workspaceId, workflowId, data) =>
    apiRequest({ method: 'post', url: wsV1(workspaceId, `/workflows/${workflowId}/transitions`), data }),
  removeTransition: (workspaceId, workflowId, transitionId) =>
    apiRequest({ method: 'delete', url: wsV1(workspaceId, `/workflows/${workflowId}/transitions/${transitionId}`) }),
};

export const usersApi = {
  list: (workspaceId, params, signal) =>
    apiRequest({ method: 'get', url: wsV1(workspaceId, '/users'), params, signal, dedupeKey: `users:${workspaceId}` }),
};

export const myTasksApi = {
  list: (workspaceId, params, signal) => apiRequest({ method: 'get', url: wsV1(workspaceId, '/my-tasks'), params, signal }),
  summary: (workspaceId, params, signal) => apiRequest({ method: 'get', url: wsV1(workspaceId, '/my-tasks'), params, signal }),
  patch: (workspaceId, taskId, data) => apiRequest({ method: 'patch', url: wsV1(workspaceId, `/my-tasks/${taskId}`), data }),
  quickCreate: (workspaceId, data) => apiRequest({ method: 'post', url: wsV1(workspaceId, '/my-tasks/quick-create'), data }),
  reorder: (workspaceId, payload) => apiRequest({ method: 'patch', url: wsV1(workspaceId, '/my-tasks/reorder'), data: payload }),
};

export const commentsApi = {
  list: (workspaceId, params, signal) => apiRequest({ method: 'get', url: wsV1(workspaceId, '/comments'), params, signal }),
  listByTask: (workspaceId, taskId, signal) => apiRequest({ method: 'get', url: wsV1(workspaceId, `/tasks/${taskId}/comments`), signal }),
  listByLead: (workspaceId, leadId, signal) => apiRequest({ method: 'get', url: wsV1(workspaceId, `/leads/${leadId}/comments`), signal }),
  create: (workspaceId, data) => apiRequest({ method: 'post', url: wsV1(workspaceId, '/comments'), data }),
  createForTask: (workspaceId, taskId, data) =>
    apiRequest({ method: 'post', url: wsV1(workspaceId, `/tasks/${taskId}/comments`), data }),
  createForLead: (workspaceId, leadId, data) =>
    apiRequest({ method: 'post', url: wsV1(workspaceId, `/leads/${leadId}/comments`), data }),
  addAttachment: (workspaceId, commentId, data) =>
    apiRequest({ method: 'post', url: wsV1(workspaceId, `/comments/${commentId}/attachments`), data }),
  removeAttachment: (workspaceId, commentId, attachmentId) =>
    apiRequest({ method: 'delete', url: wsV1(workspaceId, `/comments/${commentId}/attachments/${attachmentId}`) }),
  update: (workspaceId, id, data) => apiRequest({ method: 'patch', url: wsV1(workspaceId, `/comments/${id}`), data }),
  remove: (workspaceId, id) => apiRequest({ method: 'delete', url: wsV1(workspaceId, `/comments/${id}`) }),
};

export const sprintsApi = {
  list: (workspaceId, projectId, params, signal) =>
    apiRequest({ method: 'get', url: wsV1(workspaceId, `/projects/${projectId}/sprints`), params, signal }),
  create: (workspaceId, projectId, data) =>
    apiRequest({ method: 'post', url: wsV1(workspaceId, `/projects/${projectId}/sprints`), data }),
  start: (workspaceId, sprintId) => apiRequest({ method: 'patch', url: wsV1(workspaceId, `/sprints/${sprintId}/start`) }),
  complete: (workspaceId, sprintId, data) => apiRequest({ method: 'patch', url: wsV1(workspaceId, `/sprints/${sprintId}/complete`), data }),
  board: (workspaceId, sprintId, signal) => apiRequest({ method: 'get', url: wsV1(workspaceId, `/sprints/${sprintId}/board`), signal }),
  burndown: (workspaceId, sprintId, signal) => apiRequest({ method: 'get', url: wsV1(workspaceId, `/sprints/${sprintId}/burndown`), signal }),
  backlog: (workspaceId, projectId, signal) => apiRequest({ method: 'get', url: wsV1(workspaceId, `/projects/${projectId}/backlog`), signal }),
  addBacklogTasks: (workspaceId, sprintId, taskIds) =>
    apiRequest({ method: 'post', url: wsV1(workspaceId, `/sprints/${sprintId}/tasks`), data: { taskIds } }),
  items: (workspaceId, sprintId, signal) => apiRequest({ method: 'get', url: wsV1(workspaceId, `/sprints/${sprintId}/items`), signal }),
  addItem: (workspaceId, sprintId, data) =>
    apiRequest({ method: 'post', url: wsV1(workspaceId, `/sprints/${sprintId}/items`), data }),
  reorderItems: (workspaceId, sprintId, orderedTaskIds) =>
    apiRequest({ method: 'patch', url: wsV1(workspaceId, `/sprints/${sprintId}/items/reorder`), data: { orderedTaskIds } }),
  incompleteTasks: (workspaceId, sprintId, signal) =>
    apiRequest({ method: 'get', url: wsV1(workspaceId, `/sprints/${sprintId}/incomplete-tasks`), signal }),
};

export const notificationsApi = {
  list: (workspaceId, params, signal) => apiRequest({ method: 'get', url: wsV1(workspaceId, '/notifications'), params, signal }),
  markAllRead: (workspaceId, data) => apiRequest({ method: 'post', url: wsV1(workspaceId, '/notifications/read-all'), data }),
  markRead: (workspaceId, id, data) =>
    apiRequest({ method: 'patch', url: wsV1(workspaceId, `/notifications/${id}/read`), data }),
  remove: (workspaceId, id) => apiRequest({ method: 'delete', url: wsV1(workspaceId, `/notifications/${id}`) }),
};

export const workspacesApi = {
  list: (paramsOrSignal, signal) => {
    const isSignalOnly =
      paramsOrSignal &&
      typeof paramsOrSignal === 'object' &&
      typeof paramsOrSignal.aborted === 'boolean' &&
      typeof paramsOrSignal.addEventListener === 'function';

    return apiRequest({
      method: 'get',
      url: '/v1/workspaces',
      params: isSignalOnly ? undefined : (paramsOrSignal || undefined),
      signal: isSignalOnly ? paramsOrSignal : signal,
      dedupeKey: 'workspaces:list',
    });
  },
  create: (data) => apiRequest({ method: 'post', url: '/v1/workspaces', data }),
  get: (workspaceId, signal) => apiRequest({ method: 'get', url: `/v1/workspaces/${workspaceId}`, signal }),
  update: (workspaceId, data) => apiRequest({ method: 'patch', url: `/v1/workspaces/${workspaceId}`, data }),
  remove: (workspaceId) => apiRequest({ method: 'delete', url: `/v1/workspaces/${workspaceId}` }),
  members: (workspaceId, params, signal) => apiRequest({ method: 'get', url: `/v1/workspaces/${workspaceId}/members`, params, signal }),
  invite: (workspaceId, data) => apiRequest({ method: 'post', url: `/v1/workspaces/${workspaceId}/members/invite`, data }),
  updateMember: (workspaceId, userId, data) =>
    apiRequest({ method: 'patch', url: `/v1/workspaces/${workspaceId}/members/${userId}`, data }),
  removeMember: (workspaceId, userId) => apiRequest({ method: 'delete', url: `/v1/workspaces/${workspaceId}/members/${userId}` }),
  auditLog: (workspaceId, params, signal) =>
    apiRequest({ method: 'get', url: `/v1/workspaces/${workspaceId}/audit-log`, params, signal }),
  activity: (workspaceId, params, signal) =>
    apiRequest({ method: 'get', url: `/v1/workspaces/${workspaceId}/activity`, params, signal }),
};

export const labelsApi = {
  list: (workspaceId, signal) => apiRequest({ method: 'get', url: wsV1(workspaceId, '/labels'), signal }),
  create: (workspaceId, data) => apiRequest({ method: 'post', url: wsV1(workspaceId, '/labels'), data }),
  remove: (workspaceId, id) => apiRequest({ method: 'delete', url: wsV1(workspaceId, `/labels/${id}`) }),
};

export const customFieldsApi = {
  list: (workspaceId, params, signal) => apiRequest({ method: 'get', url: wsV1(workspaceId, '/custom-fields'), params, signal }),
  create: (workspaceId, data) => apiRequest({ method: 'post', url: wsV1(workspaceId, '/custom-fields'), data }),
  update: (workspaceId, id, data) => apiRequest({ method: 'patch', url: wsV1(workspaceId, `/custom-fields/${id}`), data }),
};

export const roadmapApi = {
  get: (workspaceId, projectId, signal) =>
    apiRequest({ method: 'get', url: wsV1(workspaceId, `/projects/${projectId}/roadmap`), signal }),
};

export const campaignsApi = {
  list: (workspaceId, params, signal) => apiRequest({ method: 'get', url: wsV1(workspaceId, '/campaigns'), params, signal }),
  get: (workspaceId, id, signal) => apiRequest({ method: 'get', url: wsV1(workspaceId, `/campaigns/${id}`), signal }),
  create: (workspaceId, data) => apiRequest({ method: 'post', url: wsV1(workspaceId, '/campaigns'), data }),
  duplicate: (workspaceId, id) => apiRequest({ method: 'post', url: wsV1(workspaceId, `/campaigns/${id}/duplicate`), data: {} }),
  updateStatus: (workspaceId, id, status) =>
    apiRequest({ method: 'patch', url: wsV1(workspaceId, `/campaigns/${id}/status`), data: { status } }),
  exportReport: (workspaceId, id, signal, params) =>
    apiRequest({ method: 'get', url: wsV1(workspaceId, id ? `/campaigns/${id}/report` : '/campaigns/report'), signal, params }),
  update: (workspaceId, id, data) => apiRequest({ method: 'patch', url: wsV1(workspaceId, `/campaigns/${id}`), data }),
  remove: (workspaceId, id) => apiRequest({ method: 'delete', url: wsV1(workspaceId, `/campaigns/${id}`) }),
  restore: (workspaceId, id) => apiRequest({ method: 'patch', url: wsV1(workspaceId, `/campaigns/${id}/restore`), data: {} }),
};

export const leadsApi = {
  pipeline: (workspaceId, signal, params) =>
    apiRequest({ method: 'get', url: wsV1(workspaceId, '/leads/pipeline'), signal, params, dedupeKey: `lead-pipeline:${workspaceId}` }),
  list: (workspaceId, params, signal) => apiRequest({ method: 'get', url: wsV1(workspaceId, '/leads'), params, signal }),
  get: (workspaceId, id, signal) => apiRequest({ method: 'get', url: wsV1(workspaceId, `/leads/${id}`), signal }),
  create: (workspaceId, data) => apiRequest({ method: 'post', url: wsV1(workspaceId, '/leads'), data }),
  update: (workspaceId, id, data) => apiRequest({ method: 'patch', url: wsV1(workspaceId, `/leads/${id}`), data }),
  updateStatus: (workspaceId, id, statusId) =>
    apiRequest({ method: 'patch', url: wsV1(workspaceId, `/leads/${id}/status`), data: { statusId } }),
  activity: (workspaceId, id, params, signal) =>
    apiRequest({ method: 'get', url: wsV1(workspaceId, `/leads/${id}/activity`), params, signal }),
  addNote: (workspaceId, id, body) => apiRequest({ method: 'post', url: wsV1(workspaceId, `/leads/${id}/notes`), data: { body } }),
  scheduleFollowUp: (workspaceId, id, nextFollowUp) =>
    apiRequest({ method: 'post', url: wsV1(workspaceId, `/leads/${id}/follow-up`), data: { nextFollowUp } }),
  listAttachments: (workspaceId, id, params, signal) =>
    apiRequest({ method: 'get', url: wsV1(workspaceId, `/leads/${id}/attachments`), params, signal }),
  addAttachment: (workspaceId, id, data) =>
    apiRequest({ method: 'post', url: wsV1(workspaceId, `/leads/${id}/attachments`), data }),
  removeAttachment: (workspaceId, id, attachmentId) =>
    apiRequest({ method: 'delete', url: wsV1(workspaceId, `/leads/${id}/attachments/${attachmentId}`) }),
  remove: (workspaceId, id) => apiRequest({ method: 'delete', url: wsV1(workspaceId, `/leads/${id}`) }),
  restore: (workspaceId, id) => apiRequest({ method: 'patch', url: wsV1(workspaceId, `/leads/${id}/restore`), data: {} }),
};

export const clientsApi = {
  list: (workspaceId, params, signal) => apiRequest({ method: 'get', url: wsV1(workspaceId, '/clients'), params, signal }),
  create: (workspaceId, data) => apiRequest({ method: 'post', url: wsV1(workspaceId, '/clients'), data }),
  get: (workspaceId, id, signal) => apiRequest({ method: 'get', url: wsV1(workspaceId, `/clients/${id}`), signal }),
  update: (workspaceId, id, data) => apiRequest({ method: 'patch', url: wsV1(workspaceId, `/clients/${id}`), data }),
  remove: (workspaceId, id) => apiRequest({ method: 'delete', url: wsV1(workspaceId, `/clients/${id}`) }),
  restore: (workspaceId, id) => apiRequest({ method: 'patch', url: wsV1(workspaceId, `/clients/${id}/restore`), data: {} }),
  leads: (workspaceId, id, signal) => apiRequest({ method: 'get', url: wsV1(workspaceId, `/clients/${id}/leads`), signal }),
  projects: (workspaceId, id, signal) => apiRequest({ method: 'get', url: wsV1(workspaceId, `/clients/${id}/projects`), signal }),
  addNote: (workspaceId, id, body) => apiRequest({ method: 'post', url: wsV1(workspaceId, `/clients/${id}/notes`), data: { body } }),
};

export const contactsApi = {
  list: (workspaceId, params, signal) => apiRequest({ method: 'get', url: wsV1(workspaceId, '/contacts'), params, signal }),
  create: (workspaceId, data) => apiRequest({ method: 'post', url: wsV1(workspaceId, '/contacts'), data }),
  update: (workspaceId, id, data) => apiRequest({ method: 'patch', url: wsV1(workspaceId, `/contacts/${id}`), data }),
  remove: (workspaceId, id) => apiRequest({ method: 'delete', url: wsV1(workspaceId, `/contacts/${id}`) }),
};

export const employeesApi = {
  list: (workspaceId, params, signal) => apiRequest({ method: 'get', url: wsV1(workspaceId, '/employees'), params, signal }),
  create: (workspaceId, data) => apiRequest({ method: 'post', url: wsV1(workspaceId, '/employees'), data }),
  get: (workspaceId, id, signal) => apiRequest({ method: 'get', url: wsV1(workspaceId, `/employees/${id}`), signal }),
  update: (workspaceId, id, data) => apiRequest({ method: 'patch', url: wsV1(workspaceId, `/employees/${id}`), data }),
  remove: (workspaceId, id) => apiRequest({ method: 'delete', url: wsV1(workspaceId, `/employees/${id}`) }),
  timeline: (workspaceId, id, params, signal) =>
    apiRequest({ method: 'get', url: wsV1(workspaceId, `/employees/${id}/timeline`), params, signal }),
  timeLogs: (workspaceId, id, params, signal) =>
    apiRequest({ method: 'get', url: wsV1(workspaceId, `/employees/${id}/time-logs`), params, signal }),
  performance: (workspaceId, id, params, signal) =>
    apiRequest({ method: 'get', url: wsV1(workspaceId, `/employees/${id}/performance`), params, signal }),
  myTimeSummary: (workspaceId, params, signal) =>
    apiRequest({ method: 'get', url: wsV1(workspaceId, '/employees/my-tasks/time-summary'), params, signal }),
};

export const analyticsApi = {
  list: (workspaceId, params, signal) => apiRequest({ method: 'get', url: wsV1(workspaceId, '/analytics'), params, signal }),
  overview: (workspaceId, params, signal) => apiRequest({ method: 'get', url: wsV1(workspaceId, '/analytics/overview'), params, signal }),
  projectHealth: (workspaceId, params, signal) => apiRequest({ method: 'get', url: wsV1(workspaceId, '/analytics/project-health'), params, signal }),
  export: (workspaceId, params) =>
    axiosClient.get(wsV1(workspaceId, '/analytics/export'), {
      params,
      responseType: 'blob',
      withCredentials: true,
    }),
  create: (workspaceId, data) => apiRequest({ method: 'post', url: wsV1(workspaceId, '/analytics'), data }),
  update: (workspaceId, id, data) => apiRequest({ method: 'patch', url: wsV1(workspaceId, `/analytics/${id}`), data }),
};

export const activityApi = {
  list: (workspaceId, params, signal) => apiRequest({ method: 'get', url: wsV1(workspaceId, '/activity'), params, signal }),
  feed: (workspaceId, params, signal) => apiRequest({ method: 'get', url: wsV1(workspaceId, '/activity/feed'), params, signal }),
};

export const searchApi = {
  search: (workspaceId, params, signal) => apiRequest({ method: 'get', url: wsV1(workspaceId, '/search'), params, signal }),
};

export const settingsApi = {
  getProfile: (workspaceId, signal) => apiRequest({ method: 'get', url: wsV1(workspaceId, '/settings/profile'), signal }),
  updateProfile: (workspaceId, data) => apiRequest({ method: 'patch', url: wsV1(workspaceId, '/settings/profile'), data }),
  getPreferences: (workspaceId, signal) => apiRequest({ method: 'get', url: wsV1(workspaceId, '/settings/preferences'), signal }),
  updatePreferences: (workspaceId, data) => apiRequest({ method: 'patch', url: wsV1(workspaceId, '/settings/preferences'), data }),
  getWorkspace: (workspaceId, signal) => apiRequest({ method: 'get', url: wsV1(workspaceId, '/settings/workspace'), signal }),
  updateWorkspace: (workspaceId, data) => apiRequest({ method: 'patch', url: wsV1(workspaceId, '/settings/workspace'), data }),
  listSessions: (workspaceId, params, signal) => apiRequest({ method: 'get', url: wsV1(workspaceId, '/settings/sessions'), params, signal }),
  updateSession: (workspaceId, id, data) => apiRequest({ method: 'patch', url: wsV1(workspaceId, `/settings/sessions/${id}`), data }),
  listApiKeys: (workspaceId, params, signal) => apiRequest({ method: 'get', url: wsV1(workspaceId, '/settings/api-keys'), params, signal }),
  createApiKey: (workspaceId, data) => apiRequest({ method: 'post', url: wsV1(workspaceId, '/settings/api-keys'), data }),
  updateApiKey: (workspaceId, id, data) => apiRequest({ method: 'patch', url: wsV1(workspaceId, `/settings/api-keys/${id}`), data }),
  removeApiKey: (workspaceId, id) => apiRequest({ method: 'delete', url: wsV1(workspaceId, `/settings/api-keys/${id}`) }),
};

export const invitesApi = {
  list: (workspaceId, params, signal) => apiRequest({ method: 'get', url: wsV1(workspaceId, '/invites'), params, signal }),
  create: (workspaceId, data) => apiRequest({ method: 'post', url: wsV1(workspaceId, '/invites'), data }),
  revoke: (workspaceId, inviteId) => apiRequest({ method: 'delete', url: wsV1(workspaceId, `/invites/${inviteId}`) }),
};

export const systemApi = {
  seed: (workspaceId) => apiRequest({ method: 'post', url: wsV1(workspaceId, '/seed') }),
  health: () => apiRequest({ method: 'get', url: '/health' }),
};

// Backward-compatible aggregate API used by older contexts/pages.
export const api = {
  seedWorkspace: systemApi.seed,
  getDashboard: (workspaceId, signal) => dashboardApi.get(workspaceId, { view: 'workspace' }, signal).then((payload) => payload.data),
  getBoard: (workspaceId, projectId, signal) => projectsApi.board(workspaceId, projectId, undefined, signal).then((payload) => payload.data),
  updateTaskStatus: (workspaceId, taskId, status) => tasksApi.updateStatus(workspaceId, taskId, status).then((payload) => payload.data),
  getTask: (workspaceId, taskId, signal) => tasksApi.get(workspaceId, taskId, signal).then((payload) => payload.data),
  getTaskComments: (workspaceId, taskId, signal) => commentsApi.listByTask(workspaceId, taskId, signal).then((payload) => payload.data),
  postTaskComment: (workspaceId, taskId, body, authorId) =>
    commentsApi.createForTask(workspaceId, taskId, { body, authorId }).then((payload) => payload.data),
};
