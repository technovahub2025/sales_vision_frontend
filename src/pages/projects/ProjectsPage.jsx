import { useMemo, useState, useEffect, useCallback } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { projectsApi, usersApi, teamsApi, clientsApi } from '../../api';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useSocket } from '../../contexts/SocketContext';
import Icon from '../../components/ui/Icon';
import DeniedActionButton from '../../components/ui/DeniedActionButton';
import { usePermission } from '../../hooks/usePermission';
import { EVENTS } from '../../socket/events';
import { toRealtimeEvent } from '../../socket/realtime';

export default function ProjectsPage() {
  const navigate = useNavigate();
  const { workspaceId, setProjectId } = useWorkspace();
  const { socket, joinWorkspace, leaveWorkspace } = useSocket();
  const { can, role } = usePermission();
  const canCreateProject = can('project', 'create');
  const canUpdateProject = can('project', 'update');
  const canDeleteProject = can('project', 'delete');
  const [showCreateForm, setShowCreateForm] = useState(false);
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

  function openCreateModal() {
    if (!canCreateProject) return;
    resetForm();
    setShowCreateForm(true);
  }

  function closeCreateModal() {
    if (createMutation.isPending) return;
    resetForm();
    setShowCreateForm(false);
  }

  function getStatusBadge(status) {
    const statusMap = {
      active: { label: 'Active', className: 'is-active' },
      archived: { label: 'Archived', className: 'is-archived' },
      on_hold: { label: 'On Hold', className: 'is-onhold' },
      planned: { label: 'Planned', className: 'is-planned' },
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
    if (!canCreateProject) {
      setError(`${role} cannot create projects`);
      return;
    }
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
    if (!canUpdateProject) return;
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
    if (!canUpdateProject) {
      setEditProjectError(`${role} cannot update projects`);
      return;
    }
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
    if (!canDeleteProject) return;
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
    if (!canDeleteProject) {
      setDeleteProjectError(`${role} cannot delete projects`);
      return;
    }
    deleteMutation.mutate(deletingProjectId);
  }

  if (!workspaceId) {
    return (
      <div className="sv-projects-page sv-projects-state-wrap">
        <div className="sv-projects-state-card">
          <div className="sv-projects-state-icon">
            <Icon name="folder_off" className="text-3xl" />
          </div>
          <p className="sv-projects-state-text">Select a workspace to view projects.</p>
        </div>
      </div>
    );
  }

  if (projectsQuery.isLoading) {
    return (
      <div className="sv-projects-page sv-projects-state-wrap">
        <div className="sv-projects-state-card">
          <div className="sv-projects-spinner" />
          <p className="sv-projects-state-text">Loading projects...</p>
        </div>
      </div>
    );
  }

  if (projectsQuery.error) {
    return (
      <div className="sv-projects-page sv-projects-state-wrap">
        <div className="sv-projects-state-card sv-projects-state-card-error">
          <div className="sv-projects-state-icon sv-projects-state-icon-error">
            <Icon name="error_outline" className="text-2xl" />
          </div>
          <p className="sv-projects-error-text">{projectsQuery.error.message || 'Failed to load projects.'}</p>
        </div>
      </div>
    );
  }

  return (
    <section className="sv-projects-page">
      <div className="sv-projects-stack">
        <header className="sv-card sv-projects-header">
          <div className="sv-projects-header-main">
            <div className="sv-mytasks-icon-chip d-inline-flex align-items-center justify-content-center rounded-3">
              <Icon name="folder" className="text-2xl" />
            </div>
            <div>
              <h1 className="sv-projects-title sv-heading">Projects</h1>
              <p className="sv-projects-subtitle">
                {filteredProjects.length} of {projects.length} {projects.length === 1 ? 'project' : 'projects'}
                {searchQuery || filterStatus !== 'all' ? ' (filtered)' : ''}
              </p>
            </div>
          </div>
          <div className="sv-projects-actions">
            {canCreateProject ? (
              <button
                type="button"
                className="btn btn-primary btn-sm sv-ctl-btn sv-projects-create-btn"
                onClick={openCreateModal}
              >
                <Icon name="add" className="text-lg" />
                Create Project
              </button>
            ) : (
              <DeniedActionButton role={role} actionLabel="create projects" className="btn btn-primary btn-sm sv-ctl-btn sv-projects-create-btn">
                Create Project
              </DeniedActionButton>
            )}
          </div>
        </header>

        {projects.length > 0 && (
          <div className="sv-card sv-projects-toolbar">
            <div className="sv-projects-search-wrap">
              <Icon name="search" className="sv-projects-search-icon" />
              <input
                type="text"
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="form-control form-control-sm sv-ctl-input sv-projects-search-input"
              />
            </div>
            <div className="sv-projects-filter-wrap">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="form-select form-select-sm sv-ctl-select sv-projects-filter-select"
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

        {!projects.length ? (
          <div className="sv-card sv-projects-empty-card">
            <div className="sv-projects-empty-icon">
              <Icon name="folder_open" className="text-5xl" />
            </div>
            <h3 className="sv-projects-empty-title">No projects yet</h3>
            <p className="sv-projects-empty-text">Create your first project to get started with planning.</p>
            {canCreateProject ? (
              <button
                type="button"
                className="btn btn-primary btn-sm sv-ctl-btn sv-projects-create-btn"
                onClick={openCreateModal}
              >
                <Icon name="add" className="text-lg" />
                Create Your First Project
              </button>
            ) : (
              <DeniedActionButton role={role} actionLabel="create projects" className="btn btn-primary btn-sm sv-ctl-btn sv-projects-create-btn">
                Create Your First Project
              </DeniedActionButton>
            )}
          </div>
        ) : !filteredProjects.length ? (
          <div className="sv-card sv-projects-empty-card">
            <div className="sv-projects-state-icon">
              <Icon name="search_off" className="text-3xl" />
            </div>
            <h3 className="sv-projects-empty-title">No projects found</h3>
            <p className="sv-projects-empty-text">Try adjusting your search or filter</p>
          </div>
        ) : (
          <div className="sv-projects-list">
            <ul className="sv-projects-grid is-three-col">
              {filteredProjects.map((project) => {
                const id = String(project._id || project.id || '');
                const statusBadge = getStatusBadge(project.status);
                return (
                  <li key={id} className="sv-card sv-projects-card group">
                    <div className="sv-projects-card-body">
                      <div className="sv-projects-card-top">
                        <div className="sv-projects-card-icon">
                          <Icon name="folder" className="text-2xl" />
                        </div>
                        <div className="sv-projects-card-top-actions">
                          <span className={`sv-projects-status-chip ${statusBadge.className}`}>{statusBadge.label}</span>
                          <div className="relative project-menu-container">
                            <button
                              type="button"
                              onClick={() => setMenuOpenProjectId(menuOpenProjectId === id ? null : id)}
                              className="sv-projects-menu-btn"
                              title="Project options"
                            >
                              <Icon name="more_vert" className="text-lg" />
                            </button>
                            {menuOpenProjectId === id && (
                              <div className="sv-projects-menu-popover">
                                {canUpdateProject ? (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditModal(project)}
                                    className="sv-projects-menu-item"
                                  >
                                    <Icon name="edit" className="text-sm" />
                                    Edit
                                  </button>
                                ) : (
                                  <DeniedActionButton role={role} actionLabel="edit projects" className="sv-projects-menu-item">
                                    Edit
                                  </DeniedActionButton>
                                )}
                                {canDeleteProject ? (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenDeleteConfirm(id)}
                                    className="sv-projects-menu-item is-danger"
                                  >
                                    <Icon name="delete" className="text-sm" />
                                    Delete
                                  </button>
                                ) : (
                                  <DeniedActionButton role={role} actionLabel="delete projects" className="sv-projects-menu-item is-danger">
                                    Delete
                                  </DeniedActionButton>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <h3 className="sv-projects-card-title">{project.name || 'Untitled project'}</h3>
                      <div className="sv-projects-card-meta">
                        <div className="sv-projects-meta-item">
                          <Icon name="people" className="text-sm" />
                          <span>{project.memberCount || 0} members</span>
                        </div>
                        {project.clientName ? (
                          <div className="sv-projects-meta-item">
                            <Icon name="business" className="text-sm" />
                            <span>{project.clientName}</span>
                          </div>
                        ) : null}
                      </div>
                      <button
                        className="btn btn-sm btn-outline-secondary sv-ctl-btn sv-projects-open-btn"
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
      </div>

      {showCreateForm && (
        <div
          className="sv-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-3"
          onClick={(event) => {
            if (event.target === event.currentTarget) closeCreateModal();
          }}
        >
          <div className="sv-card sv-projects-create-modal" role="dialog" aria-modal="true" aria-label="Create Project">
            <div className="sv-projects-create-head">
              <h2 className="sv-projects-create-title sv-heading">Create New Project</h2>
              <button
                type="button"
                className="sv-modal-close-btn"
                onClick={closeCreateModal}
                disabled={createMutation.isPending}
              >
                <Icon name="close" className="text-xl" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="sv-projects-create-form">
              <div className="sv-projects-form-grid">
                <div className="sv-projects-span-2">
                  <label className="sv-projects-label">
                    Project Name <span className="text-error">*</span>
                  </label>
                  <input
                    className="form-control form-control-sm sv-ctl-input sv-projects-field"
                    placeholder="Enter project name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                </div>

                <div>
                  <label className="sv-projects-label">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="form-select form-select-sm sv-ctl-select sv-projects-field"
                  >
                    <option value="active">Active</option>
                    <option value="archived">Archived</option>
                    <option value="on_hold">On Hold</option>
                    <option value="planned">Planned</option>
                  </select>
                </div>

                <div>
                  <label className="sv-projects-label">Progress ({progress}%)</label>
                  <div className="sv-projects-progress-row">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={progress}
                      onChange={(e) => setProgress(Number(e.target.value))}
                      className="sv-projects-progress-slider"
                    />
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={progress}
                      onChange={(e) => setProgress(Math.min(100, Math.max(0, Number(e.target.value))))}
                      className="form-control form-control-sm sv-ctl-input sv-projects-progress-input"
                    />
                  </div>
                </div>

                <div>
                  <label className="sv-projects-label">
                    Owner <span className="text-error">*</span>
                  </label>
                  <select
                    value={ownerId}
                    onChange={(e) => setOwnerId(e.target.value)}
                    className="form-select form-select-sm sv-ctl-select sv-projects-field"
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
                  <label className="sv-projects-label">Lead (Optional)</label>
                  <select
                    value={leadId}
                    onChange={(e) => setLeadId(e.target.value)}
                    className="form-select form-select-sm sv-ctl-select sv-projects-field"
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
                  <label className="sv-projects-label">Team (Optional)</label>
                  <select
                    value={teamId}
                    onChange={(e) => setTeamId(e.target.value)}
                    className="form-select form-select-sm sv-ctl-select sv-projects-field"
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
                  <label className="sv-projects-label">Client (Optional)</label>
                  <select
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    className="form-select form-select-sm sv-ctl-select sv-projects-field"
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
                  <label className="sv-projects-label">Start Date (Optional)</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="form-control form-control-sm sv-ctl-input sv-projects-field"
                  />
                </div>

                <div>
                  <label className="sv-projects-label">End Date (Optional)</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="form-control form-control-sm sv-ctl-input sv-projects-field"
                  />
                </div>

                <div className="sv-projects-span-2">
                  <label className="sv-projects-label">Metadata (Optional)</label>
                  <p className="sv-projects-help-text">Format: key1:value1, key2:value2</p>
                  <textarea
                    value={metadata}
                    onChange={(e) => setMetadata(e.target.value)}
                    placeholder="e.g., priority:high, category:marketing"
                    className="form-control form-control-sm sv-ctl-input sv-projects-field sv-projects-textarea"
                    rows={3}
                  />
                </div>
              </div>

              {error ? <div className="sv-projects-inline-error">{error}</div> : null}

              <div className="sv-projects-form-actions">
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm sv-ctl-btn sv-projects-form-btn"
                  onClick={closeCreateModal}
                  disabled={createMutation.isPending}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm sv-ctl-btn sv-projects-form-btn"
                  disabled={!canCreate || createMutation.isPending}
                >
                  {createMutation.isPending ? 'Creating...' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Project Modal */}
      {editModalOpen && (
        <div className="sv-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-3">
          <div className="sv-card sv-projects-edit-modal">
            <div className="sv-projects-edit-head">
              <h2 className="sv-projects-edit-title sv-heading">Edit Project</h2>
              <button
                type="button"
                onClick={handleCloseEditModal}
                className="sv-modal-close-btn"
              >
                <Icon name="close" className="text-xl" />
              </button>
            </div>
            <form onSubmit={handleUpdateProject} className="sv-projects-edit-form">
              <div className="sv-projects-form-grid">
                <div className="sv-projects-span-2">
                  <label className="sv-projects-label">
                    Project Name <span className="text-error">*</span>
                  </label>
                  <input
                    className="form-control form-control-sm sv-ctl-input sv-projects-field"
                    value={editProjectData.name}
                    onChange={(event) => setEditProjectData((current) => ({ ...current, name: event.target.value }))}
                  />
                </div>

                <div>
                  <label className="sv-projects-label">Status</label>
                  <select
                    value={editProjectData.status}
                    onChange={(e) => setEditProjectData((current) => ({ ...current, status: e.target.value }))}
                    className="form-select form-select-sm sv-ctl-select sv-projects-field"
                  >
                    <option value="active">Active</option>
                    <option value="archived">Archived</option>
                    <option value="on_hold">On Hold</option>
                    <option value="planned">Planned</option>
                  </select>
                </div>

                <div>
                  <label className="sv-projects-label">
                    Progress ({editProjectData.progress}%)
                  </label>
                  <div className="sv-projects-progress-row">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={editProjectData.progress}
                      onChange={(e) => setEditProjectData((current) => ({ ...current, progress: Number(e.target.value) }))}
                      className="sv-projects-progress-slider"
                    />
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={editProjectData.progress}
                      onChange={(e) => setEditProjectData((current) => ({ ...current, progress: Math.min(100, Math.max(0, Number(e.target.value))) }))}
                      className="form-control form-control-sm sv-ctl-input sv-projects-progress-input"
                    />
                  </div>
                </div>

                <div>
                  <label className="sv-projects-label">
                    Owner <span className="text-error">*</span>
                  </label>
                  <select
                    value={editProjectData.ownerId}
                    onChange={(e) => setEditProjectData((current) => ({ ...current, ownerId: e.target.value }))}
                    className="form-select form-select-sm sv-ctl-select sv-projects-field"
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
                  <label className="sv-projects-label">Lead (Optional)</label>
                  <select
                    value={editProjectData.leadId}
                    onChange={(e) => setEditProjectData((current) => ({ ...current, leadId: e.target.value }))}
                    className="form-select form-select-sm sv-ctl-select sv-projects-field"
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
                  <label className="sv-projects-label">Team (Optional)</label>
                  <select
                    value={editProjectData.teamId}
                    onChange={(e) => setEditProjectData((current) => ({ ...current, teamId: e.target.value }))}
                    className="form-select form-select-sm sv-ctl-select sv-projects-field"
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
                  <label className="sv-projects-label">Client (Optional)</label>
                  <select
                    value={editProjectData.clientId}
                    onChange={(e) => setEditProjectData((current) => ({ ...current, clientId: e.target.value }))}
                    className="form-select form-select-sm sv-ctl-select sv-projects-field"
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
                  <label className="sv-projects-label">Start Date (Optional)</label>
                  <input
                    type="date"
                    value={editProjectData.startDate}
                    onChange={(e) => setEditProjectData((current) => ({ ...current, startDate: e.target.value }))}
                    className="form-control form-control-sm sv-ctl-input sv-projects-field"
                  />
                </div>

                <div>
                  <label className="sv-projects-label">End Date (Optional)</label>
                  <input
                    type="date"
                    value={editProjectData.endDate}
                    onChange={(e) => setEditProjectData((current) => ({ ...current, endDate: e.target.value }))}
                    className="form-control form-control-sm sv-ctl-input sv-projects-field"
                  />
                </div>

                <div className="sv-projects-span-2">
                  <label className="sv-projects-label">Metadata (Optional)</label>
                  <p className="sv-projects-help-text">Format: key1:value1, key2:value2</p>
                  <textarea
                    value={editProjectData.metadata}
                    onChange={(e) => setEditProjectData((current) => ({ ...current, metadata: e.target.value }))}
                    placeholder="e.g., priority:high, category:marketing"
                    className="form-control form-control-sm sv-ctl-input sv-projects-field sv-projects-textarea"
                    rows={3}
                  />
                </div>
              </div>

              {editProjectError ? <div className="sv-projects-inline-error">{editProjectError}</div> : null}

              <div className="sv-projects-form-actions">
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm sv-ctl-btn sv-projects-form-btn"
                  onClick={handleCloseEditModal}
                  disabled={isUpdatingProject}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm sv-ctl-btn sv-projects-form-btn"
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
        <div className="sv-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-3">
          <div className="sv-card sv-projects-delete-modal">
            <div className="sv-projects-delete-icon">
              <Icon name="warning" className="text-2xl" />
            </div>
            <h2 className="sv-projects-delete-title sv-heading">Delete Project?</h2>
            <p className="sv-projects-delete-text">
              This action cannot be undone. All tasks, members, and data associated with this project will be permanently deleted.
            </p>
            {deleteProjectError && (
              <p className="sv-projects-error-text sv-projects-delete-error">{deleteProjectError}</p>
            )}
            <div className="sv-projects-form-actions">
              <button
                type="button"
                onClick={handleCloseDeleteConfirm}
                disabled={isDeletingProject}
                className="btn btn-outline-secondary btn-sm sv-ctl-btn sv-projects-form-btn"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeletingProject}
                className="btn btn-sm sv-ctl-btn sv-projects-delete-btn sv-projects-form-btn"
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
