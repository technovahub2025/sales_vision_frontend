import { EVENTS } from '../socket/events';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { contactsApi, employeesApi, projectsApi, tasksApi, usersApi, workflowApi } from '../api';
import { useSocket } from '../contexts/SocketContext';
import { useWorkspace } from '../contexts/WorkspaceContext';

const NewTaskContext = createContext(null);

function isCanceledError(error) {
  return error?.code === 'ERR_CANCELED' || /canceled/i.test(String(error?.message || ''));
}

function createRequestId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `task-${Date.now()}-${Math.random().toString(16).slice(2)}`;
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
  const { workspaceId, projectId: defaultProjectId } = useWorkspace();
  const { socket, joinWorkspace } = useSocket();
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [parentTasks, setParentTasks] = useState([]);
  const [draft, setDraft] = useState(DEFAULT_DRAFT);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [lastCreatedTask, setLastCreatedTask] = useState(null);
  const [workflowStatuses, setWorkflowStatuses] = useState([]);
  const pendingRequestIdRef = useRef('');

  const hydrate = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    setError('');
    const projectController = new AbortController();
    const usersController = new AbortController();
    const contactsController = new AbortController();
    const employeesController = new AbortController();
    const parentTasksController = new AbortController();
    const workflowController = new AbortController();
    try {
      const results = await Promise.allSettled([
        projectsApi.list(workspaceId, { page: 1, limit: 100 }, projectController.signal),
        usersApi.list(workspaceId, { page: 1, limit: 100 }, usersController.signal),
        contactsApi.list(workspaceId, { page: 1, limit: 100 }, contactsController.signal),
        employeesApi.list(workspaceId, { page: 1, limit: 100 }, employeesController.signal),
        tasksApi.list(workspaceId, { page: 1, limit: 100 }, parentTasksController.signal),
      ]);
      const [projectsResult, usersResult, contactsResult, employeesResult, parentTasksResult] = results;
      if (projectsResult.status === 'rejected') {
        console.warn('[NewTaskContext] partial failure:', projectsResult.reason);
        setProjects([]);
      }
      if (usersResult.status === 'rejected') {
        console.warn('[NewTaskContext] partial failure:', usersResult.reason);
        setUsers([]);
      }
      if (contactsResult.status === 'rejected') {
        console.warn('[NewTaskContext] partial failure:', contactsResult.reason);
        setContacts([]);
      }
      if (employeesResult.status === 'rejected') {
        console.warn('[NewTaskContext] partial failure:', employeesResult.reason);
        setEmployees([]);
      }
      if (parentTasksResult.status === 'rejected') {
        console.warn('[NewTaskContext] partial failure:', parentTasksResult.reason);
        setParentTasks([]);
      }

      const projectsData = projectsResult.status === 'fulfilled' ? projectsResult.value?.data || [] : [];
      const usersData = usersResult.status === 'fulfilled' ? usersResult.value?.data || [] : [];
      const contactsData = contactsResult.status === 'fulfilled' ? contactsResult.value?.data || [] : [];
      const employeesData = employeesResult.status === 'fulfilled' ? employeesResult.value?.data || [] : [];
      const parentTasksData = parentTasksResult.status === 'fulfilled' ? parentTasksResult.value?.data || [] : [];
      if (projectsResult.status === 'fulfilled') {
        setProjects(projectsData);
      }
      if (usersResult.status === 'fulfilled') {
        setUsers(usersData);
      }
      if (contactsResult.status === 'fulfilled') {
        setContacts(contactsData);
      }
      if (employeesResult.status === 'fulfilled') {
        setEmployees(employeesData);
      }
      if (parentTasksResult.status === 'fulfilled') {
        setParentTasks(parentTasksData);
      }

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
      const defaultStatus = statuses[0] || null;
      setDraft((current) => ({
        ...current,
        projectId: current.projectId || String(defaultProjectId || projectsData[0]?._id || ''),
        primaryAssigneeId: current.primaryAssigneeId || String(usersData[0]?._id || ''),
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
  }, [workspaceId, defaultProjectId]);

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
      parentTasks,
      draft,
      loading,
      submitting,
      error,
      lastCreatedTask,
      workflowStatuses,
      setField,
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
      parentTasks,
      draft,
      loading,
      submitting,
      error,
      lastCreatedTask,
      workflowStatuses,
      setField,
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



