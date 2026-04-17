import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { contactsApi, employeesApi, tasksApi, usersApi } from '../../api';
import { useTasks } from '../../hooks/useTasks';
import { useMyTasks } from '../../hooks/useMyTasks';
import { useTimeTracker } from '../../hooks/useTimeTracker';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import CommentThread from '../../components/comments/CommentThread';

const DEFAULT_STATUSES = ['todo', 'in_progress', 'in_review', 'completed'];
const ACTIVITY_PAGE_SIZE = 50;

function estimateToMinutes(task) {
  return Math.max(0, Math.round(Number(task?.estimateHours || 0) * 60));
}

function formatClock(seconds) {
  const total = Math.max(0, Number(seconds || 0));
  const hours = String(Math.floor(total / 3600)).padStart(2, '0');
  const mins = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
  const secs = String(total % 60).padStart(2, '0');
  return `${hours}:${mins}:${secs}`;
}

function ActivityRow({ item }) {
  const relative = item?.timestamp ? formatDistanceToNow(new Date(item.timestamp), { addSuffix: true }) : 'just now';
  const payload = item?.newValue || {};

  return (
    <div className="rounded-lg border border-outline-variant/10 bg-surface-container-low px-3 py-2">
      <p className="text-xs font-semibold uppercase text-on-surface-variant">{String(item?.field || 'updated').replace('_', ' ')}</p>
      <p className="mt-1 text-xs text-on-surface-variant">{relative}</p>
      <p className="mt-2 truncate text-sm text-on-surface">{payload?.title || payload?.message || payload?.status || 'Task updated'}</p>
    </div>
  );
}

function TaskDetailPage() {
  const { taskId: routeTaskId } = useParams();
  const { workspaceId } = useWorkspace();
  const { task, loading, error, taskStatuses, updateStatus, hydrate } = useTasks();
  const { isTimerActive, isTimerPaused, getTaskElapsedSeconds } = useMyTasks();
  const [routeTask, setRouteTask] = useState(null);
  const [routeTaskLoading, setRouteTaskLoading] = useState(false);
  const [routeTaskError, setRouteTaskError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [estimateMinutes, setEstimateMinutes] = useState(0);
  const [estimateSaving, setEstimateSaving] = useState(false);
  const [activity, setActivity] = useState([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState('');
  const [users, setUsers] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [parentTasks, setParentTasks] = useState([]);
  const [savingCollaborators, setSavingCollaborators] = useState(false);
  const [editDraft, setEditDraft] = useState({
    issueType: 'task',
    parentTaskId: '',
    primaryAssigneeId: '',
    assigneeIds: [],
    externalCollaborators: [],
  });

  const activeTask = routeTask || task;
  const taskId = useMemo(
    () => String(routeTaskId || activeTask?._id || activeTask?.id || ''),
    [routeTaskId, activeTask],
  );
  const { totalSeconds: trackedSecondsFromLogs = 0 } = useTimeTracker(taskId);
  const statusKeys = useMemo(
    () => (taskStatuses.length ? taskStatuses.map((item) => item.key) : DEFAULT_STATUSES),
    [taskStatuses],
  );

  const loadActivity = useCallback(
    async () => {
      if (!workspaceId || !taskId) return;
      setActivityLoading(true);
      setActivityError('');
      try {
        const response = await tasksApi.activity(workspaceId, taskId, { page: 1, limit: ACTIVITY_PAGE_SIZE });
        const rows = Array.isArray(response?.data) ? response.data : [];
        setActivity(rows);
      } catch (err) {
        setActivityError(err.message || 'Failed to load task activity');
      } finally {
        setActivityLoading(false);
      }
    },
    [workspaceId, taskId],
  );

  useEffect(() => {
    setEstimateMinutes(estimateToMinutes(activeTask));
  }, [activeTask]);

  useEffect(() => {
    let mounted = true;
    async function loadRouteTask() {
      if (!workspaceId || !routeTaskId) {
        setRouteTask(null);
        setRouteTaskError('');
        setRouteTaskLoading(false);
        return;
      }
      setRouteTaskLoading(true);
      setRouteTaskError('');
      try {
        const response = await tasksApi.get(workspaceId, routeTaskId);
        if (!mounted) return;
        setRouteTask(response?.data || null);
      } catch (err) {
        if (!mounted) return;
        setRouteTask(null);
        setRouteTaskError(err.message || 'Failed to load task detail');
      } finally {
        if (mounted) setRouteTaskLoading(false);
      }
    }
    loadRouteTask();
    return () => {
      mounted = false;
    };
  }, [workspaceId, routeTaskId]);

  useEffect(() => {
    if (!taskId) return;
    loadActivity();
  }, [taskId, loadActivity]);

  useEffect(() => {
    if (!workspaceId || !activeTask?.projectId) return;
    let mounted = true;
    async function loadEditOptions() {
      try {
        const [usersRes, contactsRes, employeesRes, tasksRes] = await Promise.all([
          usersApi.list(workspaceId, { page: 1, limit: 200 }),
          contactsApi.list(workspaceId, { page: 1, limit: 500 }),
          employeesApi.list(workspaceId, { page: 1, limit: 500 }),
          tasksApi.list(workspaceId, { projectId: activeTask.projectId, page: 1, limit: 500 }),
        ]);
        if (!mounted) return;
        setUsers(usersRes?.data || []);
        setContacts(contactsRes?.data || []);
        setEmployees(employeesRes?.data || []);
        setParentTasks((tasksRes?.data || []).filter((item) => String(item._id) !== String(taskId)));
      } catch (err) {
        if (!mounted) return;
        setActionMessage(err.message || 'Failed to load assignment options');
      }
    }
    loadEditOptions();
    return () => {
      mounted = false;
    };
  }, [workspaceId, activeTask?.projectId, taskId]);

  useEffect(() => {
    if (!activeTask) return;
    setEditDraft({
      issueType: String(activeTask.issueType || 'task'),
      parentTaskId: String(activeTask.parentTaskId || ''),
      primaryAssigneeId: String(activeTask.primaryAssigneeId || ''),
      assigneeIds: Array.isArray(activeTask.assigneeIds) ? activeTask.assigneeIds.map(String) : [],
      externalCollaborators: Array.isArray(activeTask.externalCollaborators) ? activeTask.externalCollaborators : [],
    });
  }, [activeTask]);

  useEffect(() => {
    if (!taskId) return;
    const onKeyDown = async (event) => {
      const key = String(event.key || '').toLowerCase();
      const isMeta = event.metaKey || event.ctrlKey;

      if (isMeta && key === 'l') {
        event.preventDefault();
        const link = `${window.location.origin}/tasks/${taskId}`;
        try {
          await navigator.clipboard.writeText(link);
          setActionMessage('Task link copied');
        } catch {
          setActionMessage('Unable to copy task link');
        }
      }

      if (isMeta && key === 'd') {
        event.preventDefault();
        try {
          const response = await tasksApi.duplicate(workspaceId, taskId);
          const duplicatedId = response?.data?._id || response?.data?.id;
          setActionMessage(duplicatedId ? `Task duplicated (${duplicatedId})` : 'Task duplicated');
          await hydrate();
        } catch (err) {
          setActionMessage(err.message || 'Failed to duplicate task');
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [workspaceId, taskId, hydrate]);

  const saveEstimate = async () => {
    if (!workspaceId || !taskId) return;
    setEstimateSaving(true);
    try {
      await tasksApi.setEstimate(workspaceId, taskId, Math.max(0, Number(estimateMinutes || 0)));
      setActionMessage('Estimate updated');
      await hydrate();
      if (routeTaskId) {
        const response = await tasksApi.get(workspaceId, routeTaskId);
        setRouteTask(response?.data || null);
      }
    } catch (err) {
      setActionMessage(err.message || 'Failed to update estimate');
    } finally {
      setEstimateSaving(false);
    }
  };

  const saveCollaborators = async () => {
    if (!workspaceId || !taskId) return;
    setSavingCollaborators(true);
    setActionMessage('');
    try {
      const assigneeIds = Array.from(new Set([editDraft.primaryAssigneeId, ...(editDraft.assigneeIds || [])].filter(Boolean)));
      await tasksApi.update(workspaceId, taskId, {
        issueType: editDraft.issueType || 'task',
        parentTaskId: editDraft.parentTaskId || null,
        primaryAssigneeId: editDraft.primaryAssigneeId || null,
        assigneeIds,
        externalCollaborators: editDraft.externalCollaborators || [],
      });
      setActionMessage('Task assignment details updated');
      await hydrate();
      if (routeTaskId) {
        const response = await tasksApi.get(workspaceId, routeTaskId);
        setRouteTask(response?.data || null);
      }
    } catch (err) {
      setActionMessage(err.message || 'Failed to update task assignment details');
    } finally {
      setSavingCollaborators(false);
    }
  };

  const exportProjectTasks = async () => {
    if (!workspaceId || !activeTask?.projectId) return;
    try {
      const blob = await tasksApi.exportCsv(workspaceId, { projectId: activeTask.projectId, limit: 500 });
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = href;
      anchor.download = `tasks-${activeTask.projectId}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(href);
      setActionMessage('CSV export started');
    } catch (err) {
      setActionMessage(err.message || 'Failed to export CSV');
    }
  };

  if (loading || routeTaskLoading) {
    return (
      <main className="min-h-screen space-y-4">
        <div className="h-32 animate-pulse rounded-xl bg-surface-container" />
        <div className="h-56 animate-pulse rounded-xl bg-surface-container" />
      </main>
    );
  }

  if (error || routeTaskError) {
    return <p className="text-sm text-error">{routeTaskError || error}</p>;
  }

  if (!activeTask) {
    return <p className="text-sm text-on-surface-variant">No task available.</p>;
  }

  const active = isTimerActive(taskId);
  const paused = isTimerPaused(taskId);
  const elapsed = getTaskElapsedSeconds(taskId);
  const totalTrackedSeconds = Math.max(0, Number(trackedSecondsFromLogs || 0), Number(elapsed || 0));

  return (
    <main className="min-h-screen">
      <div className="space-y-6">
        <div className="rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold text-gray-900">{activeTask.title}</h1>
                <div className="inline-flex items-center gap-1 rounded-md border border-outline-variant px-2 py-1 text-xs font-semibold text-on-surface">
                  <span className="rounded bg-surface-container px-2 py-1 font-mono">{formatClock(elapsed)}</span>
                  <span
                    className={`rounded px-2 py-1 ${
                      active ? 'bg-amber-100 text-amber-700' : paused ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {active ? 'Running' : paused ? 'Paused' : 'Stopped'}
                  </span>
                </div>
                <div className="inline-flex items-center gap-1 rounded-md border border-outline-variant px-2 py-1 text-xs font-semibold text-on-surface">
                  <span className="text-on-surface-variant">Total</span>
                  <span className="rounded bg-surface-container px-2 py-1 font-mono">{formatClock(totalTrackedSeconds)}</span>
                </div>
              </div>
              <p className="mt-2 text-sm text-on-surface-variant">{activeTask.description || 'No description'}</p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={exportProjectTasks} className="rounded-md bg-surface-container px-3 py-1.5 text-xs font-semibold text-on-surface">
                Export CSV
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {statusKeys.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => updateStatus(taskId, status)}
                className={`rounded px-3 py-1 text-xs font-semibold uppercase ${
                  activeTask.status === status ? 'bg-primary text-white' : 'bg-surface-container-low text-on-surface-variant'
                }`}
              >
                {String(status).replace('_', ' ')}
              </button>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap items-end gap-3">
            <label className="flex flex-col text-xs font-medium text-on-surface-variant">
              Estimate (minutes)
              <input
                type="number"
                min={0}
                value={estimateMinutes}
                onChange={(event) => setEstimateMinutes(event.target.value)}
                className="mt-1 w-40 rounded-md border border-outline-variant/20 bg-surface px-3 py-2 text-sm text-on-surface"
              />
            </label>
            <button
              type="button"
              onClick={saveEstimate}
              disabled={estimateSaving}
              className="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
            >
              {estimateSaving ? 'Saving...' : 'Save estimate'}
            </button>
            <p className="text-xs text-on-surface-variant">Shortcuts: Cmd/Ctrl+L copy link, Cmd/Ctrl+D duplicate</p>
          </div>
          {actionMessage ? <p className="mt-3 text-xs text-primary">{actionMessage}</p> : null}
        </div>

        <div className="rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-6">
          <h2 className="mb-3 text-sm font-semibold text-on-surface">Comments</h2>
          <CommentThread entityType="task" entityId={taskId} />
        </div>

        <div className="rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-6">
          <h2 className="mb-4 text-sm font-semibold text-on-surface">Issue + Assignment</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="text-xs font-medium text-on-surface-variant">
              Issue Type
              <select
                value={editDraft.issueType}
                onChange={(event) => {
                  const nextType = event.target.value;
                  setEditDraft((current) => ({
                    ...current,
                    issueType: nextType,
                    parentTaskId: nextType === 'epic' ? '' : current.parentTaskId,
                  }));
                }}
                className="mt-1 w-full rounded-md border border-outline-variant/20 bg-surface px-3 py-2 text-sm text-on-surface"
              >
                <option value="epic">Epic</option>
                <option value="task">Task</option>
                <option value="subtask">Subtask</option>
              </select>
            </label>

            <label className="text-xs font-medium text-on-surface-variant">
              Parent
              <select
                value={editDraft.parentTaskId}
                onChange={(event) => setEditDraft((current) => ({ ...current, parentTaskId: event.target.value }))}
                disabled={editDraft.issueType === 'epic'}
                className="mt-1 w-full rounded-md border border-outline-variant/20 bg-surface px-3 py-2 text-sm text-on-surface disabled:opacity-60"
              >
                <option value="">No parent</option>
                {parentTasks
                  .filter((item) => {
                    const issueType = String(item.issueType || 'task');
                    if (editDraft.issueType === 'task') return issueType === 'epic';
                    if (editDraft.issueType === 'subtask') return issueType === 'task';
                    return false;
                  })
                  .map((item) => (
                    <option key={item._id} value={item._id}>
                      {item.title}
                    </option>
                  ))}
              </select>
            </label>
          </div>

          <div className="mt-4">
            <p className="text-xs font-medium text-on-surface-variant">Primary Assignee</p>
            <select
              value={editDraft.primaryAssigneeId}
              onChange={(event) => setEditDraft((current) => ({ ...current, primaryAssigneeId: event.target.value }))}
              className="mt-1 w-full rounded-md border border-outline-variant/20 bg-surface px-3 py-2 text-sm text-on-surface"
            >
              <option value="">Unassigned</option>
              {users.map((user) => (
                <option key={user._id} value={user._id}>
                  {user.displayName}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-4">
            <p className="mb-2 text-xs font-medium text-on-surface-variant">Contributors</p>
            <div className="flex flex-wrap gap-2">
              {users.map((user) => {
                const active = (editDraft.assigneeIds || []).includes(String(user._id));
                return (
                  <button
                    key={user._id}
                    type="button"
                    onClick={() =>
                      setEditDraft((current) => {
                        const currentIds = Array.isArray(current.assigneeIds) ? current.assigneeIds : [];
                        const next = active
                          ? currentIds.filter((id) => String(id) !== String(user._id))
                          : [...currentIds, String(user._id)];
                        return { ...current, assigneeIds: next };
                      })
                    }
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold ${active ? 'bg-primary text-white' : 'bg-surface-container text-on-surface-variant'}`}
                  >
                    {user.displayName}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-medium text-on-surface-variant">External Contacts</p>
              <div className="flex flex-wrap gap-2">
                {contacts.map((contact) => {
                  const active = (editDraft.externalCollaborators || []).some(
                    (item) => item.entityType === 'contact' && String(item.entityId) === String(contact._id),
                  );
                  return (
                    <button
                      key={`contact-${contact._id}`}
                      type="button"
                      onClick={() =>
                        setEditDraft((current) => {
                          const curr = Array.isArray(current.externalCollaborators) ? current.externalCollaborators : [];
                          const next = active
                            ? curr.filter((item) => !(item.entityType === 'contact' && String(item.entityId) === String(contact._id)))
                            : [...curr, { entityType: 'contact', entityId: String(contact._id) }];
                          return { ...current, externalCollaborators: next };
                        })
                      }
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold ${active ? 'bg-primary text-white' : 'bg-surface-container text-on-surface-variant'}`}
                    >
                      {contact.name || 'Contact'}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-on-surface-variant">External Employees</p>
              <div className="flex flex-wrap gap-2">
                {employees.map((employee) => {
                  const active = (editDraft.externalCollaborators || []).some(
                    (item) => item.entityType === 'employee' && String(item.entityId) === String(employee._id),
                  );
                  return (
                    <button
                      key={`employee-${employee._id}`}
                      type="button"
                      onClick={() =>
                        setEditDraft((current) => {
                          const curr = Array.isArray(current.externalCollaborators) ? current.externalCollaborators : [];
                          const next = active
                            ? curr.filter((item) => !(item.entityType === 'employee' && String(item.entityId) === String(employee._id)))
                            : [...curr, { entityType: 'employee', entityId: String(employee._id) }];
                          return { ...current, externalCollaborators: next };
                        })
                      }
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold ${active ? 'bg-primary text-white' : 'bg-surface-container text-on-surface-variant'}`}
                    >
                      {employee.name || 'Employee'}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-4">
            <button
              type="button"
              onClick={saveCollaborators}
              disabled={savingCollaborators}
              className="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
            >
              {savingCollaborators ? 'Saving...' : 'Save Assignment Details'}
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-on-surface">Activity</h2>
            <span className="text-xs text-on-surface-variant">Showing latest {ACTIVITY_PAGE_SIZE}</span>
          </div>
          {activityError ? <p className="mb-2 text-xs text-error">{activityError}</p> : null}
          <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
            {activity.map((item, index) => (
              <ActivityRow key={`${item.timestamp || 'ts'}-${index}`} item={item} />
            ))}
            {!activity.length && !activityLoading ? <p className="text-sm text-on-surface-variant">No activity yet.</p> : null}
          </div>
        </div>
      </div>
    </main>
  );
}

export default TaskDetailPage;

