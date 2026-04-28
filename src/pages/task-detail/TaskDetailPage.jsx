import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { contactsApi, employeesApi, tasksApi, usersApi } from '../../api';
import { useTasks } from '../../hooks/useTasks';
import { useMyTasks } from '../../hooks/useMyTasks';
import { useTimeTracker } from '../../hooks/useTimeTracker';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import CommentThread from '../../components/comments/CommentThread';
import Icon from '../../components/ui/Icon';

const DEFAULT_STATUSES = ['todo', 'in_progress', 'in_review', 'completed'];
const ACTIVITY_PAGE_SIZE = 50;
const FINAL_STATUS_KEYS = new Set(['completed', 'done', 'closed']);
const COMPLETED_STATUS_KEY = 'completed';
const LOCKED_STATUS_MESSAGE = 'Completed task cannot be moved back';

function normalizeStatusKey(value) {
  return String(value || '').trim().toLowerCase();
}

function isCompletedReopenBlocked(fromStatus, toStatus) {
  const from = normalizeStatusKey(fromStatus);
  const to = normalizeStatusKey(toStatus);
  return from === COMPLETED_STATUS_KEY && to && !FINAL_STATUS_KEYS.has(to);
}

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
    <div className="sv-taskdetail-activity-row">
      <p className="sv-taskdetail-meta-label">{String(item?.field || 'updated').replace('_', ' ')}</p>
      <p className="sv-taskdetail-activity-time">{relative}</p>
      <p className="sv-taskdetail-activity-text">{payload?.title || payload?.message || payload?.status || 'Task updated'}</p>
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
  const activeTaskStatus = normalizeStatusKey(activeTask?.status);

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
        const link = new URL(`${import.meta.env.BASE_URL}tasks/${taskId}`, window.location.origin).toString();
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
      <main className="sv-taskdetail-page min-h-screen">
        <div className="sv-taskdetail-stack">
          <div className="sv-taskdetail-skeleton sv-taskdetail-skeleton-header" />
          <div className="sv-taskdetail-skeleton sv-taskdetail-skeleton-body" />
        </div>
      </main>
    );
  }

  if (error || routeTaskError) {
    return <p className="sv-taskdetail-feedback is-error">{routeTaskError || error}</p>;
  }

  if (!activeTask) {
    return <p className="sv-taskdetail-feedback">No task available.</p>;
  }

  const active = isTimerActive(taskId);
  const paused = isTimerPaused(taskId);
  const elapsed = getTaskElapsedSeconds(taskId);
  const totalTrackedSeconds = Math.max(0, Number(trackedSecondsFromLogs || 0), Number(elapsed || 0));

  return (
    <main className="sv-taskdetail-page min-h-screen">
      <div className="sv-taskdetail-stack">
        <section className="sv-card sv-taskdetail-card sv-taskdetail-section">
          <div className="sv-taskdetail-head">
            <div className="sv-taskdetail-head-main">
              <div className="sv-taskdetail-title-row">
                <h1 className="sv-taskdetail-title sv-heading">{activeTask.title}</h1>
                <div className="sv-taskdetail-pill-group">
                  <span className="sv-taskdetail-pill-code">{formatClock(elapsed)}</span>
                  <span className={`sv-taskdetail-pill ${active ? 'is-running' : paused ? 'is-paused' : 'is-stopped'}`}>
                    {active ? 'Running' : paused ? 'Paused' : 'Stopped'}
                  </span>
                </div>
                <div className="sv-taskdetail-pill-group">
                  <span className="sv-taskdetail-pill-label">Total</span>
                  <span className="sv-taskdetail-pill-code">{formatClock(totalTrackedSeconds)}</span>
                </div>
              </div>
              <p className="sv-taskdetail-description">{activeTask.description || 'No description'}</p>
            </div>
            <div className="sv-taskdetail-head-actions">
              <button type="button" onClick={exportProjectTasks} className="btn btn-sm btn-outline-secondary sv-ctl-btn sv-taskdetail-btn">
                Export CSV
              </button>
            </div>
          </div>

          <div className="sv-taskdetail-status-row">
            {statusKeys.map((status) => {
              const blocked = isCompletedReopenBlocked(activeTaskStatus, status);
              const statusLabel = String(status).replace('_', ' ');
              return (
              <button
                key={status}
                type="button"
                onClick={() => {
                  if (blocked) {
                    setActionMessage(LOCKED_STATUS_MESSAGE);
                    return;
                  }
                  updateStatus(taskId, status);
                }}
                className={`sv-taskdetail-status-btn ${activeTask.status === status ? 'is-active' : ''}`}
                title={blocked ? LOCKED_STATUS_MESSAGE : statusLabel}
                disabled={blocked}
              >
                {blocked ? <Icon name="block" className="text-[12px] me-1 text-danger" /> : null}
                {statusLabel}
              </button>
              );
            })}
          </div>

          <div className="sv-taskdetail-estimate-row">
            <label className="sv-taskdetail-label">
              Estimate (minutes)
              <input
                type="number"
                min={0}
                value={estimateMinutes}
                onChange={(event) => setEstimateMinutes(event.target.value)}
                className="form-control form-control-sm sv-ctl-input sv-taskdetail-estimate-input"
              />
            </label>
            <button
              type="button"
              onClick={saveEstimate}
              disabled={estimateSaving}
              className="btn btn-sm btn-primary sv-ctl-btn sv-taskdetail-btn"
            >
              {estimateSaving ? 'Saving...' : 'Save estimate'}
            </button>
            <p className="sv-taskdetail-shortcuts">Shortcuts: Cmd/Ctrl+L copy link, Cmd/Ctrl+D duplicate</p>
          </div>
          {actionMessage ? <p className="sv-taskdetail-message">{actionMessage}</p> : null}
        </section>

        <section className="sv-card sv-taskdetail-card sv-taskdetail-section">
          <h2 className="sv-taskdetail-section-title sv-heading">Comments</h2>
          <CommentThread entityType="task" entityId={taskId} />
        </section>

        <section className="sv-card sv-taskdetail-card sv-taskdetail-section">
          <h2 className="sv-taskdetail-section-title sv-heading">Issue + Assignment</h2>
          <div className="sv-taskdetail-grid">
            <label className="sv-taskdetail-label">
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
                className="form-select form-select-sm sv-ctl-select sv-taskdetail-field"
              >
                <option value="epic">Epic</option>
                <option value="task">Task</option>
                <option value="subtask">Subtask</option>
              </select>
            </label>

            <label className="sv-taskdetail-label">
              Parent
              <select
                value={editDraft.parentTaskId}
                onChange={(event) => setEditDraft((current) => ({ ...current, parentTaskId: event.target.value }))}
                disabled={editDraft.issueType === 'epic'}
                className="form-select form-select-sm sv-ctl-select sv-taskdetail-field"
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

          <div className="sv-taskdetail-block">
            <p className="sv-taskdetail-label">Primary Assignee</p>
            <select
              value={editDraft.primaryAssigneeId}
              onChange={(event) => setEditDraft((current) => ({ ...current, primaryAssigneeId: event.target.value }))}
              className="form-select form-select-sm sv-ctl-select sv-taskdetail-field"
            >
              <option value="">Unassigned</option>
              {users.map((user) => (
                <option key={user._id} value={user._id}>
                  {user.displayName}
                </option>
              ))}
            </select>
          </div>

          <div className="sv-taskdetail-block">
            <p className="sv-taskdetail-label">Contributors</p>
            <div className="sv-taskdetail-chip-list">
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
                    className={`sv-taskdetail-chip ${active ? 'is-active' : ''}`}
                  >
                    {user.displayName}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="sv-taskdetail-block sv-taskdetail-grid">
            <div>
              <p className="sv-taskdetail-label">External Contacts</p>
              <div className="sv-taskdetail-chip-list">
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
                      className={`sv-taskdetail-chip ${active ? 'is-active' : ''}`}
                    >
                      {contact.name || 'Contact'}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <p className="sv-taskdetail-label">External Employees</p>
              <div className="sv-taskdetail-chip-list">
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
                      className={`sv-taskdetail-chip ${active ? 'is-active' : ''}`}
                    >
                      {employee.name || 'Employee'}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="sv-taskdetail-block">
            <button
              type="button"
              onClick={saveCollaborators}
              disabled={savingCollaborators}
              className="btn btn-sm btn-primary sv-ctl-btn sv-taskdetail-btn"
            >
              {savingCollaborators ? 'Saving...' : 'Save Assignment Details'}
            </button>
          </div>
        </section>

        <section className="sv-card sv-taskdetail-card sv-taskdetail-section">
          <div className="sv-taskdetail-section-head">
            <h2 className="sv-taskdetail-section-title sv-heading">Activity</h2>
            <span className="sv-taskdetail-subtle">Showing latest {ACTIVITY_PAGE_SIZE}</span>
          </div>
          {activityError ? <p className="sv-taskdetail-feedback is-error">{activityError}</p> : null}
          <div className="sv-taskdetail-activity-list">
            {activity.map((item, index) => (
              <ActivityRow key={`${item.timestamp || 'ts'}-${index}`} item={item} />
            ))}
            {!activity.length && !activityLoading ? <p className="sv-taskdetail-feedback">No activity yet.</p> : null}
          </div>
        </section>
      </div>
    </main>
  );
}

export default TaskDetailPage;

