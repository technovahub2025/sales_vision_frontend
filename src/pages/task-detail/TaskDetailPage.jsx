import { useCallback, useEffect, useMemo, useState, useLayoutEffect, memo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { contactsApi, employeesApi, tasksApi, usersApi } from '../../api';
import { useTasks } from '../../hooks/useTasks';
import { useMyTasks } from '../../hooks/useMyTasks';
import { useTimeTracker } from '../../hooks/useTimeTracker';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import CommentThread from '../../components/comments/CommentThread';
import Icon from '../../components/ui/Icon';
import { ChevronDown } from 'lucide-react';

const DEFAULT_STATUSES = ['todo', 'in_progress', 'in_review', 'completed'];
const ACTIVITY_PAGE_SIZE = 50;
const FINAL_STATUS_KEYS = new Set(['completed', 'done', 'closed']);
const COMPLETED_STATUS_KEY = 'completed';
const LOCKED_STATUS_MESSAGE = 'Completed task cannot be moved back';
const MAX_COMPLETION_IMAGES = 3;
const ALLOWED_COMPLETION_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const ALLOWED_COMPLETION_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

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

function formatMinutesLabel(minutes) {
  const total = Math.max(0, Number(minutes || 0));
  const hours = Math.floor(total / 60);
  const mins = Math.round(total % 60);
  if (hours && mins) return `${hours}h ${mins}m`;
  if (hours) return `${hours}h`;
  return `${mins}m`;
}

function isAllowedCompletionImage(file) {
  const type = String(file?.type || '').toLowerCase();
  const name = String(file?.name || '').toLowerCase();
  if (type && ALLOWED_COMPLETION_IMAGE_TYPES.has(type)) return true;
  return ALLOWED_COMPLETION_IMAGE_EXTENSIONS.some((extension) => name.endsWith(extension));
}

function formatTaskCompletionError(error) {
  const primaryMessage = String(error?.message || '').trim();
  const validationMessages = Array.isArray(error?.errors) ? error.errors : [];
  const detailMessages = validationMessages
    .map((item) => {
      if (!item) return '';
      if (typeof item === 'string') return item;
      const segments = [];
      const path = String(item.path || item.field || '').trim();
      const message = String(item.message || '').trim();
      const detail = item.details;
      if (path) segments.push(path);
      if (message) segments.push(message);
      if (!message && detail && typeof detail === 'string') segments.push(detail);
      if (!message && detail && typeof detail === 'object') {
        if (detail.message) segments.push(String(detail.message));
        if (detail.reason) segments.push(String(detail.reason));
      }
      return segments.filter(Boolean).join(': ');
    })
    .filter(Boolean);

  return [primaryMessage, ...detailMessages].filter(Boolean).join(' ').trim() || 'Failed to complete task';
}

function ActivityRow({ item }) {
  const relative = item?.timestamp ? formatDistanceToNow(new Date(item.timestamp), { addSuffix: true }) : 'just now';
  const payload = item?.newValue || {};

  return (
    <div className="sv-taskdetail-activity-row">
      <div className="sv-taskdetail-activity-top">
        <p className="sv-taskdetail-meta-label">{String(item?.field || 'updated').replace('_', ' ')}</p>
        <p className="sv-taskdetail-activity-time">{relative}</p>
      </div>
      <p className="sv-taskdetail-activity-text">{payload?.title || payload?.message || payload?.status || 'Task updated'}</p>
    </div>
  );
}

const DetailDropdown = memo(function DetailDropdown({
  value,
  options,
  onChange,
  disabled = false,
  className = '',
  triggerClassName = '',
  menuClassName = '',
  renderValue,
}) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  const selectedOption = useMemo(
    () => (options || []).find((option) => String(option.value) === String(value)) || null,
    [options, value],
  );

  const resolvedValue = selectedOption ? (renderValue ? renderValue(selectedOption) : selectedOption.label) : value;

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const viewportPadding = 12;
    const estimatedWidth = Math.max(rect.width, 220);
    const estimatedHeight = Math.min(280, Math.max(176, (options?.length || 0) * 40));
    const fitsBelow = rect.bottom + estimatedHeight + 12 <= window.innerHeight;
    const top = fitsBelow ? rect.bottom + 6 : Math.max(viewportPadding, rect.top - estimatedHeight - 6);
    const left = Math.min(
      Math.max(viewportPadding, rect.left),
      window.innerWidth - estimatedWidth - viewportPadding,
    );

    setMenuStyle({
      position: 'fixed',
      top,
      left,
      width: Math.min(estimatedWidth, window.innerWidth - viewportPadding * 2),
      zIndex: 1200,
    });
  }, [options?.length]);

  useLayoutEffect(() => {
    if (!open) return undefined;
    updateMenuPosition();
    const handleResize = () => updateMenuPosition();
    const handleScroll = () => updateMenuPosition();
    const handlePointerDown = (event) => {
      if (triggerRef.current?.contains(event.target)) return;
      if (menuRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll, true);
    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll, true);
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, updateMenuPosition]);

  return (
    <div className={`sv-detail-dropdown ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        className={`sv-detail-dropdown__trigger ${triggerClassName} ${open ? 'is-open' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="sv-detail-dropdown__value">{resolvedValue}</span>
        <ChevronDown size={14} strokeWidth={2.5} className="sv-detail-dropdown__chevron" />
      </button>

      {open && typeof document !== 'undefined'
        ? createPortal(
          <div
            ref={menuRef}
            className={`sv-detail-dropdown__menu ${menuClassName}`}
            style={menuStyle || undefined}
            role="listbox"
          >
            {(options || []).map((option) => {
              const selected = String(option.value) === String(value);
              return (
                <button
                  key={option.value}
                  type="button"
                  className={`sv-detail-dropdown__option ${selected ? 'is-selected' : ''}`}
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                >
                  <span className="sv-detail-dropdown__option-check">{selected ? <Icon name="check" /> : null}</span>
                  <span className="sv-detail-dropdown__option-label">{option.label}</span>
                </button>
              );
            })}
          </div>,
          document.body,
        )
        : null}
    </div>
  );
});

function TaskDetailPage() {
  const { taskId: routeTaskId } = useParams();
  const { workspaceId } = useWorkspace();
  const queryClient = useQueryClient();
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
  const [completionFlowOpen, setCompletionFlowOpen] = useState(false);
  const [completionFiles, setCompletionFiles] = useState([]);
  const [completionUploadDone, setCompletionUploadDone] = useState(true);
  const [completionUploading, setCompletionUploading] = useState(false);
  const [completionCompleting, setCompletionCompleting] = useState(false);
  const [completionError, setCompletionError] = useState('');
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
  const completedImageCount = completionUploadDone ? completionFiles.length : 0;
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
    setCompletionFlowOpen(false);
    setCompletionFiles([]);
    setCompletionUploadDone(true);
    setCompletionUploading(false);
    setCompletionCompleting(false);
    setCompletionError('');
  }, [taskId]);

  const onCompletionFilesChange = useCallback((fileList) => {
    const incomingFiles = Array.from(fileList || []).filter(Boolean);
    if (!incomingFiles.length) {
      setCompletionFiles([]);
      setCompletionUploadDone(true);
      setCompletionError('');
      return;
    }

    const invalidFiles = incomingFiles.filter((file) => !isAllowedCompletionImage(file));
    if (invalidFiles.length) {
      setCompletionFiles([]);
      setCompletionUploadDone(true);
      setCompletionError('Only jpg, jpeg, png, gif, and webp files are allowed.');
      return;
    }

    if (incomingFiles.length > MAX_COMPLETION_IMAGES) {
      setCompletionFiles(incomingFiles.slice(0, MAX_COMPLETION_IMAGES));
      setCompletionUploadDone(false);
      setCompletionError(`You can upload up to ${MAX_COMPLETION_IMAGES} images.`);
      return;
    }

    setCompletionFiles(incomingFiles);
    setCompletionUploadDone(false);
    setCompletionError('');
  }, []);

  const removeCompletionFile = useCallback((index) => {
    setCompletionFiles((current) => {
      const next = current.filter((_, currentIndex) => currentIndex !== index);
      setCompletionUploadDone(next.length === 0 ? true : false);
      return next;
    });
    setCompletionError('');
  }, []);

  const submitTaskCompletion = useCallback(async () => {
    if (!workspaceId || !taskId || completionUploading || completionCompleting) return;
    if (completionError && !completionFiles.length) return;

    setCompletionError('');
    setActionMessage('');
    try {
      if (!completionUploadDone && completionFiles.length) {
        setCompletionUploading(true);
        await tasksApi.uploadAttachments(workspaceId, taskId, completionFiles);
        setCompletionUploadDone(true);
      }

      setCompletionUploading(false);
      setCompletionCompleting(true);
      await tasksApi.updateStatus(workspaceId, taskId, 'completed');
      setActionMessage(`Task completed${completionFiles.length ? ` with ${completionFiles.length} image${completionFiles.length === 1 ? '' : 's'}` : ''}`);
      setCompletionFlowOpen(false);
      setCompletionFiles([]);
      setCompletionUploadDone(true);
      await Promise.all([
        hydrate(),
        queryClient.invalidateQueries({ queryKey: ['attachments', 'task', taskId] }),
      ]);
      if (routeTaskId) {
        const response = await tasksApi.get(workspaceId, routeTaskId);
        setRouteTask(response?.data || null);
      }
    } catch (err) {
      setCompletionError(formatTaskCompletionError(err));
      setActionMessage(err.message || 'Failed to complete task');
    } finally {
      setCompletionUploading(false);
      setCompletionCompleting(false);
    }
  }, [
    completionCompleting,
    completionFiles,
    completionError,
    completionUploadDone,
    completionUploading,
    hydrate,
    queryClient,
    routeTaskId,
    taskId,
    workspaceId,
  ]);

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
  const estimateSeconds = Math.max(0, Number(estimateMinutes || 0) * 60);
  const trackedProgress = estimateSeconds ? Math.min(100, Math.round((totalTrackedSeconds / estimateSeconds) * 100)) : 0;
  const activeStatusLabel = String(activeTask.status || 'todo').replace('_', ' ');
  const primaryAssignee = users.find((user) => String(user._id) === String(editDraft.primaryAssigneeId));
  const contributorCount = new Set([editDraft.primaryAssigneeId, ...(editDraft.assigneeIds || [])].filter(Boolean)).size;
  const externalCount = Array.isArray(editDraft.externalCollaborators) ? editDraft.externalCollaborators.length : 0;

  return (
    <main className="sv-taskdetail-page min-h-screen">
      <div className="sv-taskdetail-stack">
        <section className="sv-card sv-taskdetail-card sv-taskdetail-section sv-taskdetail-hero">
          <div className="sv-taskdetail-head">
            <div className="sv-taskdetail-head-main">
              <span className="sv-taskdetail-eyebrow">{activeTask.projectName || activeTask.project?.name || 'Task detail'}</span>
              <div className="sv-taskdetail-title-row">
                <h1 className="sv-taskdetail-title sv-heading">{activeTask.title}</h1>
              </div>
              <p className="sv-taskdetail-description">{activeTask.description || 'No description'}</p>
            </div>
            <div className="sv-taskdetail-head-actions">
              <button type="button" onClick={exportProjectTasks} className="btn btn-sm btn-outline-secondary sv-ctl-btn sv-taskdetail-btn">
                Export CSV
              </button>
            </div>
          </div>

          <div className="sv-taskdetail-hero-grid">
            <article className="sv-taskdetail-time-card">
              <div>
                <span className={`sv-taskdetail-live-dot ${active ? 'is-running' : paused ? 'is-paused' : ''}`} />
                <p>{active ? 'Timer running' : paused ? 'Timer paused' : 'Timer stopped'}</p>
              </div>
              <strong>{formatClock(elapsed)}</strong>
              <span>Total tracked {formatClock(totalTrackedSeconds)}</span>
              <div className="sv-taskdetail-time-progress">
                <span style={{ width: `${trackedProgress}%` }} />
              </div>
            </article>
            <article className="sv-taskdetail-summary-card">
              <span>Status</span>
              <strong>{activeStatusLabel}</strong>
            </article>
            <article className="sv-taskdetail-summary-card">
              <span>Estimate</span>
              <strong>{formatMinutesLabel(estimateMinutes)}</strong>
            </article>
            <article className="sv-taskdetail-summary-card">
              <span>People</span>
              <strong>{contributorCount + externalCount}</strong>
            </article>
          </div>

          <div className="sv-taskdetail-status-row" aria-label="Task status">
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
                  if (normalizeStatusKey(status) === COMPLETED_STATUS_KEY) {
                    setCompletionFlowOpen(true);
                    setCompletionError('');
                    setActionMessage('');
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

          {completionFlowOpen ? (
            <div className="rounded-3xl border border-outline-variant/10 bg-surface-container-lowest p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.24em] text-on-surface-variant">Task completion</p>
                  <h2 className="mt-1 text-base font-semibold text-on-surface">Upload up to 3 images before finishing</h2>
                  <p className="mt-1 text-sm text-on-surface-variant">
                    Allowed formats: jpg, jpeg, png, gif, webp.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCompletionFlowOpen(false);
                    setCompletionError('');
                  }}
                  className="rounded-full px-2 py-1 text-sm font-semibold text-on-surface-variant hover:bg-surface-container"
                >
                  <X size={14} strokeWidth={2.5} />
                </button>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-outline-variant/30 px-4 py-6 text-center transition hover:border-primary hover:bg-primary/5">
                  <Icon name="upload_file" className="text-2xl text-primary" />
                  <span className="mt-2 text-sm font-semibold text-on-surface">Choose images</span>
                  <span className="mt-1 text-xs text-on-surface-variant">Select up to {MAX_COMPLETION_IMAGES} image files</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp,.jpg,.jpeg,.png,.gif,.webp"
                    multiple
                    onChange={(event) => onCompletionFilesChange(event.target.files)}
                    disabled={completionUploading || completionCompleting}
                    className="sr-only"
                  />
                </label>

                <div className="space-y-3">
                  <div className="rounded-2xl bg-surface-container px-4 py-3">
                    <p className="text-xs font-black uppercase tracking-[0.22em] text-on-surface-variant">
                      {completedImageCount}/{MAX_COMPLETION_IMAGES} images uploaded
                    </p>
                    <p className="mt-1 text-sm text-on-surface-variant">
                      {completionFiles.length
                        ? `${completionFiles.length} image${completionFiles.length === 1 ? '' : 's'} selected`
                        : 'No images selected yet'}
                    </p>
                  </div>

                  {completionFiles.length ? (
                    <div className="space-y-2">
                      {completionFiles.map((file, index) => (
                        <div
                          key={`${file.name}-${index}`}
                          className="flex items-center justify-between gap-3 rounded-2xl border border-outline-variant/10 bg-surface-container-low p-3"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-on-surface">{file.name}</p>
                            <p className="text-xs text-on-surface-variant">{file.type || 'image file'}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeCompletionFile(index)}
                            disabled={completionUploading || completionCompleting}
                            className="text-xs font-semibold text-error"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {completionError ? <p className="text-sm text-error">{completionError}</p> : null}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCompletionFlowOpen(false);
                    setCompletionError('');
                  }}
                  className="btn btn-sm btn-outline-secondary sv-ctl-btn"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitTaskCompletion}
                  disabled={completionUploading || completionCompleting || (Boolean(completionError) && !completionFiles.length)}
                  className="btn btn-sm btn-primary sv-ctl-btn"
                >
                  {completionUploading
                    ? 'Uploading images...'
                    : completionCompleting
                      ? 'Completing task...'
                      : completionFiles.length
                        ? 'Upload & complete task'
                        : 'Complete task'}
                </button>
              </div>
            </div>
          ) : null}

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

        <div className="sv-taskdetail-work-grid">
          <section className="sv-card sv-taskdetail-card sv-taskdetail-section">
            <h2 className="sv-taskdetail-section-title sv-heading">Comments</h2>
            <CommentThread entityType="task" entityId={taskId} />
          </section>

          <section className="sv-card sv-taskdetail-card sv-taskdetail-section">
            <div className="sv-taskdetail-section-head">
              <div>
                <h2 className="sv-taskdetail-section-title sv-heading">Issue + Assignment</h2>
                <p className="sv-taskdetail-subtle">Owner: {primaryAssignee?.displayName || 'Unassigned'}</p>
              </div>
            </div>
            <div className="sv-taskdetail-grid">
              <label className="sv-taskdetail-label">
                Issue Type
                <DetailDropdown
                  value={editDraft.issueType}
                  options={[
                    { value: 'epic', label: 'Epic' },
                    { value: 'task', label: 'Task' },
                    { value: 'subtask', label: 'Subtask' },
                  ]}
                  onChange={(nextType) => {
                    setEditDraft((current) => ({
                      ...current,
                      issueType: nextType,
                      parentTaskId: nextType === 'epic' ? '' : current.parentTaskId,
                    }));
                  }}
                  className="sv-taskdetail-field-wrap"
                  triggerClassName="sv-taskdetail-field sv-taskdetail-dropdown-trigger"
                />
              </label>

              <label className="sv-taskdetail-label">
                Parent
                <DetailDropdown
                  value={editDraft.parentTaskId}
                  onChange={(nextValue) => setEditDraft((current) => ({ ...current, parentTaskId: nextValue }))}
                  disabled={editDraft.issueType === 'epic'}
                  options={[
                    { value: '', label: 'No parent' },
                    ...parentTasks
                      .filter((item) => {
                        const issueType = String(item.issueType || 'task');
                        if (editDraft.issueType === 'task') return issueType === 'epic';
                        if (editDraft.issueType === 'subtask') return issueType === 'task';
                        return false;
                      })
                      .map((item) => ({ value: item._id, label: item.title })),
                  ]}
                  className="sv-taskdetail-field-wrap"
                  triggerClassName="sv-taskdetail-field sv-taskdetail-dropdown-trigger"
                />
              </label>
            </div>

            <div className="sv-taskdetail-block">
              <p className="sv-taskdetail-label">Primary Assignee</p>
              <DetailDropdown
                value={editDraft.primaryAssigneeId}
                onChange={(nextValue) => setEditDraft((current) => ({ ...current, primaryAssigneeId: nextValue }))}
                options={[
                  { value: '', label: 'Unassigned' },
                  ...users.map((user) => ({ value: user._id, label: user.displayName })),
                ]}
                className="sv-taskdetail-field-wrap"
                triggerClassName="sv-taskdetail-field sv-taskdetail-dropdown-trigger"
              />
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
        </div>

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

