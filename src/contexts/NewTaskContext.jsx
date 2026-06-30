import { EVENTS } from '../socket/events';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { contactsApi, employeesApi, projectsApi, tasksApi, usersApi, workflowApi } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { useWorkspace } from '../contexts/WorkspaceContext';

const NewTaskContext = createContext(null);
const DIRECTORY_LIMIT = 25;

function isCanceledError(error) {
  return error?.code === 'ERR_CANCELED' || /canceled/i.test(String(error?.message || ''));
}

function createRequestId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `task-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function emptyDirectoryState() {
  return {
    query: '',
    page: 1,
    hasMore: true,
    loading: false,
    loadingMore: false,
    error: '',
  };
}

function resolveHasMore(response, rows, page, limit) {
  const meta = response?.meta || {};
  if (typeof meta.hasMore === 'boolean') return meta.hasMore;
  if (meta.nextCursor) return true;
  const totalPages = Number(meta.totalPages || 0);
  if (totalPages > 0) return page < totalPages;
  const total = Number(meta.total || 0);
  if (total > 0) return page * limit < total;
  return (rows || []).length >= limit;
}

function mergeUniqueById(previous, incoming) {
  const map = new Map();
  (previous || []).forEach((item) => map.set(String(item?._id || item?.id || ''), item));
  (incoming || []).forEach((item) => map.set(String(item?._id || item?.id || ''), item));
  return Array.from(map.values());
}

function createDirectoryParams(page, query) {
  const trimmed = String(query || '').trim();
  return {
    page,
    limit: DIRECTORY_LIMIT,
    ...(trimmed ? { search: trimmed, q: trimmed } : {}),
  };
}

const DEFAULT_DRAFT = {
  title: '',
  description: '',
  issueType: 'task',
  parentTaskId: '',
  priority: 'high',
  dueDate: '',
  projectId: '',
  primaryAssigneeId: '',
  assigneeIds: [],
  externalCollaborators: [],
  tagsInput: '',
  tags: ['api', 'security'],
  attachments: [],
  workflowId: '',
  statusId: '',
  status: 'todo',
};

export function NewTaskProvider({ children }) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { workspaceId, projectId: defaultProjectId } = useWorkspace();
  const { socket, joinWorkspace } = useSocket();
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [parentTasks, setParentTasks] = useState([]);
  const [directoryMeta, setDirectoryMeta] = useState({
    users: emptyDirectoryState(),
    contacts: emptyDirectoryState(),
    employees: emptyDirectoryState(),
  });
  const [draft, setDraft] = useState(DEFAULT_DRAFT);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [lastCreatedTask, setLastCreatedTask] = useState(null);
  const [workflowStatuses, setWorkflowStatuses] = useState([]);
  const pendingRequestIdRef = useRef('');
  const directoryRequestIdRef = useRef({
    users: 0,
    contacts: 0,
    employees: 0,
  });

  const listDirectory = useCallback(
    async (entity, page = 1, query = '') => {
      if (!isAuthenticated || !workspaceId) {
        return { data: [], meta: { hasMore: false } };
      }
      const params = createDirectoryParams(page, query);
      if (entity === 'users') return usersApi.list(workspaceId, params);
      if (entity === 'contacts') return contactsApi.list(workspaceId, params);
      return employeesApi.list(workspaceId, params);
    },
    [isAuthenticated, workspaceId],
  );

  const applyDirectoryRows = useCallback((entity, rows, append) => {
    if (entity === 'users') {
      setUsers((previous) => (append ? mergeUniqueById(previous, rows) : rows));
      return;
    }
    if (entity === 'contacts') {
      setContacts((previous) => (append ? mergeUniqueById(previous, rows) : rows));
      return;
    }
    setEmployees((previous) => (append ? mergeUniqueById(previous, rows) : rows));
  }, []);

  const loadDirectory = useCallback(
    async (entity, options = {}) => {
      if (!isAuthenticated || !workspaceId) return { rows: [], hasMore: false };
      const nextQuery = String(options.query ?? '').trim();
      const nextPage = Number(options.page || 1);
      const append = Boolean(options.append && nextPage > 1);
      const requestId = (directoryRequestIdRef.current[entity] || 0) + 1;
      directoryRequestIdRef.current[entity] = requestId;

      setDirectoryMeta((current) => ({
        ...current,
        [entity]: {
          ...current[entity],
          query: nextQuery,
          page: nextPage,
          error: '',
          loading: !append,
          loadingMore: append,
        },
      }));

      try {
        const response = await listDirectory(entity, nextPage, nextQuery);
        if (directoryRequestIdRef.current[entity] !== requestId) return;
        const rows = response?.data || [];
        applyDirectoryRows(entity, rows, append);
        const hasMore = resolveHasMore(response, rows, nextPage, DIRECTORY_LIMIT);
        setDirectoryMeta((current) => ({
          ...current,
          [entity]: {
            ...current[entity],
            query: nextQuery,
            page: nextPage,
            hasMore,
            error: '',
            loading: false,
            loadingMore: false,
          },
        }));
        return { rows, hasMore };
      } catch (loadError) {
        if (isCanceledError(loadError)) return;
        if (directoryRequestIdRef.current[entity] !== requestId) return;
        setDirectoryMeta((current) => ({
          ...current,
          [entity]: {
            ...current[entity],
            loading: false,
            loadingMore: false,
            error: loadError.message || `Failed to load ${entity}`,
          },
        }));
        return { rows: [], hasMore: false };
      }
    },
    [isAuthenticated, workspaceId, listDirectory, applyDirectoryRows],
  );

  const setDirectoryQuery = useCallback(
    (entity, query) => {
      loadDirectory(entity, { page: 1, query, append: false });
    },
    [loadDirectory],
  );

  const loadMoreDirectory = useCallback(
    (entity) => {
      const meta = directoryMeta[entity] || emptyDirectoryState();
      if (meta.loading || meta.loadingMore || !meta.hasMore) return;
      loadDirectory(entity, { page: Number(meta.page || 1) + 1, query: meta.query || '', append: true });
    },
    [directoryMeta, loadDirectory],
  );

  const hydrate = useCallback(async () => {
    if (authLoading) return;
    if (!isAuthenticated || !workspaceId) {
      setProjects([]);
      setUsers([]);
      setContacts([]);
      setEmployees([]);
      setParentTasks([]);
      setWorkflowStatuses([]);
      setError('');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    const projectController = new AbortController();
    const parentTasksController = new AbortController();
    const workflowController = new AbortController();
    try {
      const [projectsResult, parentTasksResult] = await Promise.allSettled([
        projectsApi.list(workspaceId, { page: 1, limit: 100 }, projectController.signal),
        tasksApi.list(workspaceId, { page: 1, limit: 100 }, parentTasksController.signal),
      ]);

      if (projectsResult.status === 'rejected') {
        console.warn('[NewTaskContext] partial failure:', projectsResult.reason);
        setProjects([]);
      }
      if (parentTasksResult.status === 'rejected') {
        console.warn('[NewTaskContext] partial failure:', parentTasksResult.reason);
        setParentTasks([]);
      }

      const projectsData = projectsResult.status === 'fulfilled' ? projectsResult.value?.data || [] : [];
      const parentTasksData = parentTasksResult.status === 'fulfilled' ? parentTasksResult.value?.data || [] : [];
      if (projectsResult.status === 'fulfilled') {
        setProjects(projectsData);
      }
      if (parentTasksResult.status === 'fulfilled') {
        setParentTasks(parentTasksData);
      }

      const [usersResult] = await Promise.all([
        loadDirectory('users', { page: 1, query: '', append: false }),
        loadDirectory('contacts', { page: 1, query: '', append: false }),
        loadDirectory('employees', { page: 1, query: '', append: false }),
      ]);

      let defaultWorkflow = null;
      let statuses = [];
      try {
        await workflowApi.ensureDefault(workspaceId);
        const workflowsRes = await workflowApi.list(
          workspaceId,
          { entityType: 'task' },
          workflowController.signal,
        );
        defaultWorkflow = (workflowsRes.data || [])[0] || null;
        if (defaultWorkflow?._id) {
          const statusesRes = await workflowApi.listStatuses(
            workspaceId,
            defaultWorkflow._id,
            workflowController.signal,
          );
          statuses = statusesRes.data || [];
        }
        setWorkflowStatuses(statuses);
      } catch (workflowError) {
        console.warn('[NewTaskContext] partial failure:', workflowError);
        setWorkflowStatuses([]);
      }

      const defaultPrimaryAssigneeId = String(usersResult?.rows?.[0]?._id || '');
      const defaultStatus = statuses[0] || null;
      setDraft((current) => ({
        ...current,
        projectId: current.projectId || String(defaultProjectId || projectsData[0]?._id || ''),
        primaryAssigneeId: current.primaryAssigneeId || defaultPrimaryAssigneeId,
        workflowId: String(defaultWorkflow?._id || current.workflowId || ''),
        statusId: String(defaultStatus?._id || current.statusId || ''),
        status: String(defaultStatus?.key || current.status || 'todo'),
      }));
    } catch (err) {
      if (!isCanceledError(err)) {
        setError(err.message || 'Failed to load task form');
      }
    } finally {
      setLoading(false);
    }
  }, [authLoading, isAuthenticated, workspaceId, defaultProjectId, loadDirectory]);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!socket || !workspaceId) return;
    joinWorkspace({ workspaceId, modules: ['tasks', 'board', 'dashboard'] });
    const onTaskCreated = (payload) => {
      const created = payload?.data;
      if (!created) return;
      if (pendingRequestIdRef.current && created.clientRequestId === pendingRequestIdRef.current) {
        setLastCreatedTask(created);
      }
    };
    socket.on(EVENTS.TASK_CREATED, onTaskCreated);
    return () => socket.off(EVENTS.TASK_CREATED, onTaskCreated);
  }, [socket, workspaceId, joinWorkspace]);

  const setField = useCallback((field, value) => {
    setDraft((current) => ({ ...current, [field]: value }));
  }, []);

  const addTag = useCallback(() => {
    setDraft((current) => {
      const tag = String(current.tagsInput || '').trim().toLowerCase();
      if (!tag || current.tags.includes(tag)) return current;
      return { ...current, tags: [...current.tags, tag], tagsInput: '' };
    });
  }, []);

  const removeTag = useCallback((tag) => {
    setDraft((current) => ({ ...current, tags: current.tags.filter((item) => item !== tag) }));
  }, []);

  const setAttachmentFiles = useCallback((files) => {
    const attachmentItems = Array.from(files || []).map((file) => ({
      file,
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      size: Number(file.size || 0),
    }));
    setDraft((current) => ({ ...current, attachments: attachmentItems }));
  }, []);

  const submit = useCallback(async () => {
    if (!workspaceId || submitting) return null;
    if (!draft.title.trim()) {
      setError('Task title is required');
      return null;
    }
    if (!draft.projectId) {
      setError('Project is required');
      return null;
    }

    setSubmitting(true);
    setError('');
    const clientRequestId = createRequestId();
    pendingRequestIdRef.current = clientRequestId;
    try {
      const assigneeIds = Array.from(new Set([draft.primaryAssigneeId, ...draft.assigneeIds].filter(Boolean)));
      const createRes = await tasksApi.create(workspaceId, {
        title: draft.title.trim(),
        description: draft.description,
        issueType: draft.issueType || 'task',
        parentTaskId: draft.parentTaskId || undefined,
        priority: draft.priority,
        dueDate: draft.dueDate || undefined,
        projectId: draft.projectId,
        primaryAssigneeId: draft.primaryAssigneeId || undefined,
        assigneeIds,
        externalCollaborators: draft.externalCollaborators || [],
        tags: draft.tags,
        workflowId: draft.workflowId || undefined,
        statusId: draft.statusId || undefined,
        status: draft.status || undefined,
        clientRequestId,
      });

      const task = createRes.data;
      if (draft.attachments.length) {
        await Promise.all(
          draft.attachments.map((attachment) => {
            const formData = new FormData();
            if (attachment.file) {
              formData.append('files', attachment.file);
            }
            return tasksApi.createAttachment(workspaceId, task._id || task.id, formData);
          }),
        );
      }

      setLastCreatedTask(task);
      setDraft({
        ...DEFAULT_DRAFT,
        projectId: draft.projectId,
        primaryAssigneeId: draft.primaryAssigneeId,
        issueType: draft.issueType || 'task',
        workflowId: draft.workflowId,
        statusId: draft.statusId,
        status: draft.status,
      });
      return task;
    } catch (err) {
      if (!isCanceledError(err)) {
        setError(err.message || 'Failed to create task');
      }
      return null;
    } finally {
      setSubmitting(false);
      pendingRequestIdRef.current = '';
    }
  }, [workspaceId, draft, submitting]);

  const value = useMemo(
    () => ({
      projects,
      users,
      contacts,
      employees,
      directoryMeta,
      parentTasks,
      draft,
      loading,
      submitting,
      error,
      lastCreatedTask,
      workflowStatuses,
      setField,
      setDirectoryQuery,
      loadMoreDirectory,
      addTag,
      removeTag,
      setAttachmentFiles,
      submit,
      hydrate,
    }),
    [
      projects,
      users,
      contacts,
      employees,
      directoryMeta,
      parentTasks,
      draft,
      loading,
      submitting,
      error,
      lastCreatedTask,
      workflowStatuses,
      setField,
      setDirectoryQuery,
      loadMoreDirectory,
      addTag,
      removeTag,
      setAttachmentFiles,
      submit,
      hydrate,
    ],
  );

  return <NewTaskContext.Provider value={value}>{children}</NewTaskContext.Provider>;
}

export function useNewTaskContext() {
  const context = useContext(NewTaskContext);
  if (!context) {
    throw new Error('useNewTaskContext must be used within NewTaskProvider');
  }
  return context;
}
