import { useMemo, useState, useEffect, useCallback } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { projectsApi, usersApi, teamsApi, clientsApi } from '../../api';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useSocket } from '../../contexts/SocketContext';
import Icon from '../../components/ui/Icon';
import { EVENTS } from '../../socket/events';
import { toRealtimeEvent } from '../../socket/realtime';

export default function ProjectsPage() {
  const navigate = useNavigate();
  const { workspaceId, setProjectId } = useWorkspace();
  const { socket, joinWorkspace, leaveWorkspace } = useSocket();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [columns, setColumns] = useState(3);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [name, setName] = useState('');
  const [status, setStatus] = useState('active');
  const [progress, setProgress] = useState(0);
  const [ownerId, setOwnerId] = useState('');
  const [leadId, setLeadId] = useState('');
  const [teamId, setTeamId] = useState('');
  const [clientId, setClientId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [metadata, setMetadata] = useState('');
  const [error, setError] = useState('');
  const [menuOpenProjectId, setMenuOpenProjectId] = useState(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState(null);
  const [editProjectData, setEditProjectData] = useState({
    name: '',
    status: 'active',
    progress: 0,
    ownerId: '',
    leadId: '',
    teamId: '',
    clientId: '',
    startDate: '',
    endDate: '',
    metadata: '',
  });
  const [isUpdatingProject, setIsUpdatingProject] = useState(false);
  const [editProjectError, setEditProjectError] = useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingProjectId, setDeletingProjectId] = useState(null);
  const [isDeletingProject, setIsDeletingProject] = useState(false);
  const [deleteProjectError, setDeleteProjectError] = useState('');

  const projectsQuery = useQuery({
    queryKey: ['projects', workspaceId],
    queryFn: () => projectsApi.list(workspaceId, { page: 1, limit: 50 }).then((payload) => payload.data || []),
    enabled: Boolean(workspaceId),
    staleTime: 30_000,
  });
  const refetchProjects = projectsQuery.refetch;

  const usersQuery = useQuery({
    queryKey: ['users', workspaceId],
    queryFn: () => usersApi.list(workspaceId, { page: 1, limit: 100 }).then((payload) => payload.data || []),
    enabled: Boolean(workspaceId),
    staleTime: 60_000,
  });

  const teamsQuery = useQuery({
    queryKey: ['teams', workspaceId],
    queryFn: () => teamsApi.list(workspaceId, { page: 1, limit: 100 }).then((payload) => payload.data || []),
    enabled: Boolean(workspaceId),
    staleTime: 60_000,
  });

  const clientsQuery = useQuery({
    queryKey: ['clients', workspaceId],
    queryFn: () => clientsApi.list(workspaceId, { page: 1, limit: 100 }).then((payload) => payload.data || []),
    enabled: Boolean(workspaceId),
    staleTime: 60_000,
  });

  const createMutation = useMutation({
    mutationFn: (values) => projectsApi.create(workspaceId, values),
    onSuccess: (response) => {
      const createdId = String(response?.data?._id || response?.data?.id || '');
      if (createdId) {
        setProjectId(createdId);
        resetForm();
        setShowCreateForm(false);
        navigate(`/projects/${createdId}/board`);
      }
    },
    onError: (err) => {
      setError(err.message || 'Failed to create project');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ projectId, values }) => projectsApi.update(workspaceId, projectId, values),
    onMutate: () => {
      setIsUpdatingProject(true);
    },
    onSuccess: () => {
      projectsQuery.refetch();
      handleCloseEditModal();
    },
    onError: (err) => {
      setEditProjectError(err.message || 'Failed to update project');
    },
    onSettled: () => {
      setIsUpdatingProject(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (projectId) => projectsApi.delete(workspaceId, projectId),
    onMutate: () => {
      setIsDeletingProject(true);
    },
    onSuccess: () => {
      projectsQuery.refetch();
      handleCloseDeleteConfirm();
    },
    onError: (err) => {
      setDeleteProjectError(err.message || 'Failed to delete project');
    },
    onSettled: () => {
      setIsDeletingProject(false);
    },
  });

  const resetForm = useCallback(() => {
    setName('');
    setStatus('active');
    setProgress(0);
    setOwnerId('');
    setLeadId('');
    setTeamId('');
    setClientId('');
    setStartDate('');
    setEndDate('');
    setMetadata('');
    setError('');
  }, []);

  // Close project menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuOpenProjectId && !event.target.closest('.project-menu-container')) {
        setMenuOpenProjectId(null);
      }
    };

    if (menuOpenProjectId) {
      document.addEventListener('click', handleClickOutside);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [menuOpenProjectId]);

  // Close modals on Escape key press
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setEditModalOpen(false);
        setDeleteConfirmOpen(false);
        setMenuOpenProjectId(null);
        if (showCreateForm) {
          resetForm();
          setShowCreateForm(false);
        }
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showCreateForm, resetForm]);

  useEffect(() => {
    if (!socket || !workspaceId) return undefined;
    const joinPayload = { workspaceId, modules: ['projects'] };
    joinWorkspace(joinPayload);

    const refreshProjects = () => refetchProjects();
    const onRealtime = (raw) => {
      const evt = toRealtimeEvent(raw);
      if (String(evt.workspaceId || '') !== String(workspaceId)) return;
      if (evt.entity !== 'project') return;
      refreshProjects();
    };

    socket.on('project:created', refreshProjects);
    socket.on(EVENTS.PROJECT_UPDATED, refreshProjects);
    socket.on('project:deleted', refreshProjects);
    socket.on(EVENTS.REALTIME_EVENT, onRealtime);

    return () => {
      leaveWorkspace(joinPayload);
      socket.off('project:created', refreshProjects);
      socket.off(EVENTS.PROJECT_UPDATED, refreshProjects);
      socket.off('project:deleted', refreshProjects);
      socket.off(EVENTS.REALTIME_EVENT, onRealtime);
    };
  }, [socket, workspaceId, joinWorkspace, leaveWorkspace, refetchProjects]);

  const projects = useMemo(() => projectsQuery.data || [], [projectsQuery.data]);
  const users = usersQuery.data || [];
  const teams = teamsQuery.data || [];
  const clients = clientsQuery.data || [];

  const filteredProjects = useMemo(() => {
    return projects.filter((project) => {
      const matchesSearch = !searchQuery || 
        (project.name || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = filterStatus === 'all' || 
        (project.status || 'active') === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [projects, searchQuery, filterStatus]);

  const canCreate = useMemo(() => name.trim().length >= 2 && ownerId, [name, ownerId]);

  function getStatusBadge(status) {
    const statusMap = {
      active: { label: 'Active', className: 'bg-green-100 text-green-700 border-green-200' },
      archived: { label: 'Archived', className: 'bg-slate-100 text-slate-700 border-slate-200' },
      on_hold: { label: 'On Hold', className: 'bg-amber-100 text-amber-700 border-amber-200' },
      planned: { label: 'Planned', className: 'bg-blue-100 text-blue-700 border-blue-200' },
    };
    return statusMap[status] || statusMap.active;
  }

  function parseMetadata(metadataString) {
    if (!metadataString || !metadataString.trim()) return {};
    const metadataObj = {};
    const pairs = metadataString.split(',').map((p) => p.trim()).filter(Boolean);
    pairs.forEach((pair) => {
      const [key, ...valueParts] = pair.split(':');
      if (key && valueParts.length) {
        metadataObj[key.trim()] = valueParts.join(':').trim();
      }
    });
    return metadataObj;
  }

  function handleCreate(event) {
    event.preventDefault();
    setError('');
    if (!canCreate) {
      setError('Project name and owner are required');
      return;
    }
    const payload = {
      name: name.trim(),
      status,
      progress: Number(progress),
      ownerId,
      ...(leadId && { leadId }),
      ...(teamId && { teamId }),
      ...(clientId && { clientId }),
      ...(startDate && { startDate }),
      ...(endDate && { endDate }),
      ...(metadata.trim() && { metadata: parseMetadata(metadata) }),
    };
    createMutation.mutate(payload);
  }

  function handleOpenEditModal(project) {
    setEditingProjectId(project._id);
    setEditProjectData({
      name: project.name || '',
      status: project.status || 'active',
      progress: project.progress || 0,
      ownerId: project.ownerId || '',
      leadId: project.leadId || '',
      teamId: project.teamId || '',
      clientId: project.clientId || '',
      startDate: project.startDate ? new Date(project.startDate).toISOString().split('T')[0] : '',
      endDate: project.endDate ? new Date(project.endDate).toISOString().split('T')[0] : '',
      metadata: project.metadata ? JSON.stringify(project.metadata).replace(/[{}"]/g, '').replace(/,/g, ', ') : '',
    });
    setEditProjectError('');
    setEditModalOpen(true);
    setMenuOpenProjectId(null);
  }

  function handleCloseEditModal() {
    setEditModalOpen(false);
    setEditingProjectId(null);
    setEditProjectData({
      name: '',
      status: 'active',
      progress: 0,
      ownerId: '',
      leadId: '',
      teamId: '',
      clientId: '',
      startDate: '',
      endDate: '',
      metadata: '',
    });
    setEditProjectError('');
  }

  function handleUpdateProject(event) {
    event.preventDefault();
    setEditProjectError('');
    if (!editProjectData.name.trim() || !editProjectData.ownerId) {
      setEditProjectError('Project name and owner are required');
      return;
    }
    const payload = {
      name: editProjectData.name.trim(),
      status: editProjectData.status,
      progress: Number(editProjectData.progress),
      ownerId: editProjectData.ownerId,
      ...(editProjectData.leadId && { leadId: editProjectData.leadId }),
      ...(editProjectData.teamId && { teamId: editProjectData.teamId }),
      ...(editProjectData.clientId && { clientId: editProjectData.clientId }),
      ...(editProjectData.startDate && { startDate: editProjectData.startDate }),
      ...(editProjectData.endDate && { endDate: editProjectData.endDate }),
      ...(editProjectData.metadata.trim() && { metadata: parseMetadata(editProjectData.metadata) }),
    };
    updateMutation.mutate({ projectId: editingProjectId, values: payload });
  }

  function handleOpenDeleteConfirm(projectId) {
    setDeletingProjectId(projectId);
    setDeleteProjectError('');
    setDeleteConfirmOpen(true);
    setMenuOpenProjectId(null);
  }

  function handleCloseDeleteConfirm() {
    setDeleteConfirmOpen(false);
    setDeletingProjectId(null);
    setDeleteProjectError('');
  }

  function handleConfirmDelete() {
    setDeleteProjectError('');
    deleteMutation.mutate(deletingProjectId);
  }

  if (!workspaceId) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <Icon name="folder_off" className="text-3xl" />
          </div>
          <p className="text-sm text-on-surface-variant">Select a workspace to view projects.</p>
        </div>
      </div>
    );
  }

  if (projectsQuery.isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-on-surface-variant">Loading projects...</p>
        </div>
      </div>
    );
  }

  if (projectsQuery.error) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="rounded-xl border border-error/20 bg-error/5 p-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-error/10 text-error">
            <Icon name="error_outline" className="text-2xl" />
          </div>
          <p className="text-sm text-error">{projectsQuery.error.message || 'Failed to load projects.'}</p>
        </div>
      </div>
    );
  }

  return (
    <section className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon name="folder" className="text-2xl" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-on-surface">Projects</h1>
            <p className="text-sm text-on-surface-variant">
              {filteredProjects.length} of {projects.length} {projects.length === 1 ? 'project' : 'projects'}
              {searchQuery || filterStatus !== 'all' ? ' (filtered)' : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-lg bg-surface-container-lowest p-1">
            <button
              type="button"
              className={`rounded-md p-2 transition-all ${columns === 2 ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-container'}`}
              onClick={() => setColumns(2)}
              title="2 columns"
            >
              <Icon name="view_column" className="text-lg" />
            </button>
            <button
              type="button"
              className={`rounded-md p-2 transition-all ${columns === 3 ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-container'}`}
              onClick={() => setColumns(3)}
              title="3 columns"
            >
              <Icon name="view_module" className="text-lg" />
            </button>
          </div>
          <button
            type="button"
            className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary shadow-lg shadow-primary/25 transition-all hover:bg-primary/90 hover:shadow-primary/30"
            onClick={() => {
              resetForm();
              setShowCreateForm(true);
            }}
          >
            <Icon name="add" className="text-lg" />
            Create Project
          </button>
        </div>
      </header>

      {projects.length > 0 && (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-on-surface-variant" />
            <input
              type="text"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest pl-10 pr-4 py-2.5 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="flex items-center gap-3">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-sm font-semibold transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
              <option value="on_hold">On Hold</option>
              <option value="planned">Planned</option>
            </select>
          </div>
        </div>
      )}

      {showCreateForm && (
        <div className="overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-sm transition-all">
          <div className="flex items-center justify-between border-b border-outline-variant/50 bg-surface-container-low px-6 py-4">
            <h2 className="text-lg font-semibold text-on-surface">Create New Project</h2>
            <button
              type="button"
              className="rounded-lg p-2 text-on-surface-variant transition hover:bg-surface-container hover:text-on-surface"
              onClick={() => {
                resetForm();
                setShowCreateForm(false);
              }}
            >
              <Icon name="close" className="text-xl" />
            </button>
          </div>
          <form onSubmit={handleCreate} className="max-w-4xl space-y-5 p-6">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-semibold text-on-surface-variant">
                  Project Name <span className="text-error">*</span>
                </label>
                <input
                  className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-3 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                  placeholder="Enter project name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-on-surface-variant">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full rounded-xl border border-outline-variant bg-white px-4 py-3 text-sm font-semibold transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                >
                  <option value="active">Active</option>
                  <option value="archived">Archived</option>
                  <option value="on_hold">On Hold</option>
                  <option value="planned">Planned</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-on-surface-variant">
                  Progress ({progress}%)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={progress}
                    onChange={(e) => setProgress(Number(e.target.value))}
                    className="flex-1 accent-primary"
                  />
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={progress}
                    onChange={(e) => setProgress(Math.min(100, Math.max(0, Number(e.target.value))))}
                    className="w-20 rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-center text-sm transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-on-surface-variant">
                  Owner <span className="text-error">*</span>
                </label>
                <select
                  value={ownerId}
                  onChange={(e) => setOwnerId(e.target.value)}
                  className="w-full rounded-xl border border-outline-variant bg-white px-4 py-3 text-sm font-semibold transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                  disabled={usersQuery.isLoading}
                >
                  <option value="">Select owner</option>
                  {users.map((u) => (
                    <option key={u._id} value={u._id}>
                      {u.displayName || u.email || 'Unknown'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-on-surface-variant">Lead (Optional)</label>
                <select
                  value={leadId}
                  onChange={(e) => setLeadId(e.target.value)}
                  className="w-full rounded-xl border border-outline-variant bg-white px-4 py-3 text-sm font-semibold transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                  disabled={usersQuery.isLoading}
                >
                  <option value="">Select lead</option>
                  {users.map((u) => (
                    <option key={u._id} value={u._id}>
                      {u.displayName || u.email || 'Unknown'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-on-surface-variant">Team (Optional)</label>
                <select
                  value={teamId}
                  onChange={(e) => setTeamId(e.target.value)}
                  className="w-full rounded-xl border border-outline-variant bg-white px-4 py-3 text-sm font-semibold transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                  disabled={teamsQuery.isLoading}
                >
                  <option value="">Select team</option>
                  {teams.map((t) => (
                    <option key={t._id} value={t._id}>
                      {t.name || 'Unknown Team'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-on-surface-variant">Client (Optional)</label>
                <select
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="w-full rounded-xl border border-outline-variant bg-white px-4 py-3 text-sm font-semibold transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                  disabled={clientsQuery.isLoading}
                >
                  <option value="">Select client</option>
                  {clients.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name || 'Unknown Client'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-on-surface-variant">Start Date (Optional)</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-3 text-sm transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-on-surface-variant">End Date (Optional)</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-3 text-sm transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-semibold text-on-surface-variant">
                  Metadata (Optional)
                </label>
                <p className="mb-2 text-xs text-on-surface-variant">
                  Format: key1:value1, key2:value2
                </p>
                <textarea
                  value={metadata}
                  onChange={(e) => setMetadata(e.target.value)}
                  placeholder="e.g., priority:high, category:marketing"
                  className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-3 text-sm transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                  rows={3}
                />
              </div>
            </div>

            {error ? (
              <div className="rounded-lg bg-error/5 border border-error/20 px-4 py-3 text-sm text-error">
                {error}
              </div>
            ) : null}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                className="flex-1 rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-3 text-sm font-semibold text-on-surface transition-all hover:bg-surface-container"
                onClick={() => {
                  resetForm();
                  setShowCreateForm(false);
                }}
                disabled={createMutation.isPending}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-on-primary shadow-lg shadow-primary/25 transition-all hover:bg-primary/90 hover:shadow-primary/30 disabled:opacity-60 disabled:shadow-none"
                disabled={!canCreate || createMutation.isPending}
              >
                {createMutation.isPending ? 'Creating...' : 'Create Project'}
              </button>
            </div>
          </form>
        </div>
      )}

      {!projects.length ? (
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-primary/5 text-primary">
              <Icon name="folder_open" className="text-5xl" />
            </div>
            <h3 className="mb-2 text-xl font-semibold text-on-surface">No projects yet</h3>
            <p className="mb-6 text-sm text-on-surface-variant">Create your first project to get started with planning.</p>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary shadow-lg shadow-primary/25 transition-all hover:bg-primary/90 hover:shadow-primary/30"
              onClick={() => {
                resetForm();
                setShowCreateForm(true);
              }}
            >
              <Icon name="add" className="text-lg" />
              Create Your First Project
            </button>
          </div>
        </div>
      ) : !filteredProjects.length ? (
        <div className="flex min-h-[300px] items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <Icon name="search_off" className="text-3xl" />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-on-surface">No projects found</h3>
            <p className="text-sm text-on-surface-variant">Try adjusting your search or filter</p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <ul className={`grid gap-5 ${columns === 2 ? 'md:grid-cols-2' : 'md:grid-cols-2 xl:grid-cols-3'}`}>
            {filteredProjects.map((project) => {
              const id = String(project._id || project.id || '');
              const statusBadge = getStatusBadge(project.status);
              return (
                <li
                  key={id}
                  className="group overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-sm transition-all hover:shadow-md hover:border-primary/30"
                >
                  <div className="p-6">
                    <div className="mb-4 flex items-start justify-between">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-on-primary">
                        <Icon name="folder" className="text-2xl" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusBadge.className}`}>
                          {statusBadge.label}
                        </span>
                        <div className="relative project-menu-container">
                          <button
                            type="button"
                            onClick={() => setMenuOpenProjectId(menuOpenProjectId === id ? null : id)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-surface-container-low hover:text-on-surface transition-all"
                            title="Project options"
                          >
                            <Icon name="more_vert" className="text-lg" />
                          </button>
                          {menuOpenProjectId === id && (
                            <div className="absolute right-0 top-full z-20 min-w-32 rounded-xl border border-outline-variant/50 bg-surface-container-low/80 p-1 shadow-lg backdrop-blur-sm animate-in slide-in-from-top-2 duration-200">
                              <button
                                type="button"
                                onClick={() => handleOpenEditModal(project)}
                                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-on-surface hover:bg-surface-container transition-colors"
                              >
                                <Icon name="edit" className="text-sm" />
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenDeleteConfirm(id)}
                                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors"
                              >
                                <Icon name="delete" className="text-sm" />
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <h3 className="mb-2 text-lg font-semibold text-on-surface transition-colors group-hover:text-primary">
                      {project.name || 'Untitled project'}
                    </h3>
                    <div className="mb-4 flex items-center gap-4 text-xs text-on-surface-variant">
                      <div className="flex items-center gap-1">
                        <Icon name="people" className="text-sm" />
                        <span>{project.memberCount || 0} members</span>
                      </div>
                      {project.clientName ? (
                        <div className="flex items-center gap-1">
                          <Icon name="business" className="text-sm" />
                          <span>{project.clientName}</span>
                        </div>
                      ) : null}
                    </div>
                    <button
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-surface-container px-4 py-2.5 text-sm font-semibold text-on-surface transition-all hover:bg-primary hover:text-on-primary"
                      onClick={() => {
                        if (!id) return;
                        setProjectId(id);
                        navigate(`/projects/${id}/board`);
                      }}
                    >
                      <Icon name="open_in_new" className="text-base" />
                      Open board
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Edit Project Modal */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border border-outline-variant/50 bg-surface-container-lowest p-6 shadow-2xl backdrop-blur-sm animate-in slide-in-from-bottom-8 duration-300">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-on-surface">Edit Project</h2>
              <button
                type="button"
                onClick={handleCloseEditModal}
                className="rounded-lg p-2 text-on-surface-variant transition hover:bg-surface-container hover:text-on-surface"
              >
                <Icon name="close" className="text-xl" />
              </button>
            </div>
            <form onSubmit={handleUpdateProject} className="space-y-5">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-semibold text-on-surface-variant">
                    Project Name <span className="text-error">*</span>
                  </label>
                  <input
                    className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-3 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                    value={editProjectData.name}
                    onChange={(event) => setEditProjectData((current) => ({ ...current, name: event.target.value }))}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-on-surface-variant">Status</label>
                  <select
                    value={editProjectData.status}
                    onChange={(e) => setEditProjectData((current) => ({ ...current, status: e.target.value }))}
                    className="w-full rounded-xl border border-outline-variant bg-white px-4 py-3 text-sm font-semibold transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="active">Active</option>
                    <option value="archived">Archived</option>
                    <option value="on_hold">On Hold</option>
                    <option value="planned">Planned</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-on-surface-variant">
                    Progress ({editProjectData.progress}%)
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={editProjectData.progress}
                      onChange={(e) => setEditProjectData((current) => ({ ...current, progress: Number(e.target.value) }))}
                      className="flex-1 accent-primary"
                    />
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={editProjectData.progress}
                      onChange={(e) => setEditProjectData((current) => ({ ...current, progress: Math.min(100, Math.max(0, Number(e.target.value))) }))}
                      className="w-20 rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-center text-sm transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-on-surface-variant">
                    Owner <span className="text-error">*</span>
                  </label>
                  <select
                    value={editProjectData.ownerId}
                    onChange={(e) => setEditProjectData((current) => ({ ...current, ownerId: e.target.value }))}
                    className="w-full rounded-xl border border-outline-variant bg-white px-4 py-3 text-sm font-semibold transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                    disabled={usersQuery.isLoading}
                  >
                    <option value="">Select owner</option>
                    {users.map((u) => (
                      <option key={u._id} value={u._id}>
                        {u.displayName || u.email || 'Unknown'}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-on-surface-variant">Lead (Optional)</label>
                  <select
                    value={editProjectData.leadId}
                    onChange={(e) => setEditProjectData((current) => ({ ...current, leadId: e.target.value }))}
                    className="w-full rounded-xl border border-outline-variant bg-white px-4 py-3 text-sm font-semibold transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                    disabled={usersQuery.isLoading}
                  >
                    <option value="">Select lead</option>
                    {users.map((u) => (
                      <option key={u._id} value={u._id}>
                        {u.displayName || u.email || 'Unknown'}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-on-surface-variant">Team (Optional)</label>
                  <select
                    value={editProjectData.teamId}
                    onChange={(e) => setEditProjectData((current) => ({ ...current, teamId: e.target.value }))}
                    className="w-full rounded-xl border border-outline-variant bg-white px-4 py-3 text-sm font-semibold transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                    disabled={teamsQuery.isLoading}
                  >
                    <option value="">Select team</option>
                    {teams.map((t) => (
                      <option key={t._id} value={t._id}>
                        {t.name || 'Unknown Team'}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-on-surface-variant">Client (Optional)</label>
                  <select
                    value={editProjectData.clientId}
                    onChange={(e) => setEditProjectData((current) => ({ ...current, clientId: e.target.value }))}
                    className="w-full rounded-xl border border-outline-variant bg-white px-4 py-3 text-sm font-semibold transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                    disabled={clientsQuery.isLoading}
                  >
                    <option value="">Select client</option>
                    {clients.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name || 'Unknown Client'}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-on-surface-variant">Start Date (Optional)</label>
                  <input
                    type="date"
                    value={editProjectData.startDate}
                    onChange={(e) => setEditProjectData((current) => ({ ...current, startDate: e.target.value }))}
                    className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-3 text-sm transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-on-surface-variant">End Date (Optional)</label>
                  <input
                    type="date"
                    value={editProjectData.endDate}
                    onChange={(e) => setEditProjectData((current) => ({ ...current, endDate: e.target.value }))}
                    className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-3 text-sm transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-semibold text-on-surface-variant">
                    Metadata (Optional)
                  </label>
                  <p className="mb-2 text-xs text-on-surface-variant">
                    Format: key1:value1, key2:value2
                  </p>
                  <textarea
                    value={editProjectData.metadata}
                    onChange={(e) => setEditProjectData((current) => ({ ...current, metadata: e.target.value }))}
                    placeholder="e.g., priority:high, category:marketing"
                    className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-3 text-sm transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                    rows={3}
                  />
                </div>
              </div>

              {editProjectError ? (
                <div className="rounded-lg bg-error/5 border border-error/20 px-4 py-3 text-sm text-error">
                  {editProjectError}
                </div>
              ) : null}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  className="flex-1 rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-3 text-sm font-semibold text-on-surface transition-all hover:bg-surface-container"
                  onClick={handleCloseEditModal}
                  disabled={isUpdatingProject}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-on-primary shadow-lg shadow-primary/25 transition-all hover:bg-primary/90 hover:shadow-primary/30 disabled:opacity-60 disabled:shadow-none"
                  disabled={isUpdatingProject || !editProjectData.name.trim() || !editProjectData.ownerId}
                >
                  {isUpdatingProject ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl border border-outline-variant/50 bg-surface-container-lowest p-6 shadow-2xl backdrop-blur-sm animate-in slide-in-from-bottom-8 duration-300">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
              <Icon name="warning" className="text-2xl" />
            </div>
            <h2 className="mb-2 text-xl font-bold text-on-surface">Delete Project?</h2>
            <p className="mb-4 text-sm text-on-surface-variant">
              This action cannot be undone. All tasks, members, and data associated with this project will be permanently deleted.
            </p>
            {deleteProjectError && (
              <p className="mb-4 text-sm text-error">{deleteProjectError}</p>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleCloseDeleteConfirm}
                disabled={isDeletingProject}
                className="flex-1 rounded-xl border border-outline-variant/50 bg-surface-container-low/80 px-4 py-2.5 text-sm font-semibold text-on-surface transition-all hover:bg-surface-container backdrop-blur-sm disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeletingProject}
                className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-red-600/30 transition-all hover:bg-red-700 hover:shadow-red-700/40 active:scale-95 disabled:opacity-60 disabled:shadow-none"
              >
                {isDeletingProject ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
