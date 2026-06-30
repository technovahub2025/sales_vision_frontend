import { memo, useMemo, useState, useEffect, useCallback } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { projectsApi, usersApi, teamsApi, clientsApi } from '../../api';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useSocket } from '../../contexts/SocketContext';
import Icon from '../../components/ui/Icon';
import DeniedActionButton from '../../components/ui/DeniedActionButton';
import ExportMenu from '../../components/ui/ExportMenu';
import { usePermission } from '../../hooks/usePermission';
import { EVENTS } from '../../socket/events';
import { toRealtimeEvent } from '../../socket/realtime';
import DatePicker from '../../components/ui/DatePicker';
import { exportRows } from '../../lib/exportData';

const PROJECT_PAGE_SIZE = 24;

const PROJECT_STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'planned', label: 'Planned' },
];

const PROJECT_FILTER_OPTIONS = [{ value: 'all', label: 'All Status' }, ...PROJECT_STATUS_OPTIONS];

const fmtShortDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

function ProjectDropdown({ value, options, onChange, className = '', disabled = false }) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    if (!open) return undefined;
    const close = () => setOpen(false);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [open]);

  return (
    <div className={`sv-page-dropdown sv-projects-dropdown ${className}`}>
      <button
        type="button"
        className={`sv-page-dropdown__trigger ${open ? 'is-open' : ''}`}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={selected?.label ? `Selected ${selected.label}` : 'Select option'}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setOpen(false);
          }
          if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span className="sv-page-dropdown__value">{selected?.label || 'Select'}</span>
        <Icon name="expand_more" className="sv-page-dropdown__chevron" />
      </button>
      {open ? (
        <div className="sv-page-dropdown__menu" role="listbox" onClick={(event) => event.stopPropagation()}>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`sv-page-dropdown__option ${option.value === value ? 'is-selected' : ''}`}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              <span className="sv-page-dropdown__option-check">{option.value === value ? <Icon name="check" /> : null}</span>
              <span className="sv-page-dropdown__option-label">{option.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ProjectDatePicker({ value, onChange, className = '' }) {
  return (
    <DatePicker
      value={value}
      onChange={onChange}
      className={`sv-projects-date ${className}`}
      triggerClassName="sv-projects-field"
    />
  );
}

const ProjectListRow = memo(function ProjectListRow({
  project,
  statusBadge,
  menuOpen,
  canUpdateProject,
  canDeleteProject,
  role,
  onToggleMenu,
  onEdit,
  onDelete,
  onOpenBoard,
}) {
  const id = String(project._id || project.id || '');
  const progress = Math.max(0, Math.min(100, Number(project.progress || 0)));
  const projectName = project.name || 'Untitled project';
  const clientName = project.clientName || 'No client';
  const startDate = fmtShortDate(project.startDate);
  const endDate = fmtShortDate(project.endDate);

  return (
    <li className="sv-projects-row">
      <div className="sv-projects-cell sv-projects-cell-project">
        <div className="sv-projects-row-icon">
          <Icon name="folder" className="text-lg" />
        </div>
        <div className="sv-projects-row-copy">
          <button
            type="button"
            className="sv-projects-row-title"
            title={`Open ${projectName}`}
            aria-label={`Open ${projectName}`}
            onClick={() => onOpenBoard(id)}
          >
            {projectName}
          </button>
          <p className="sv-projects-row-subtitle">
            {endDate ? `Due ${endDate}` : startDate ? `Started ${startDate}` : 'Project workspace'}
          </p>
          <div className="sv-projects-row-tags" aria-label={`${projectName} context`}>
            <span><Icon name="calendar_today" className="text-xs" />{endDate || startDate || 'No timeline'}</span>
            <span><Icon name="trending_up" className="text-xs" />{progress}% complete</span>
          </div>
        </div>
      </div>

      <div className="sv-projects-cell sv-projects-cell-members" data-label="Members">
        <Icon name="people" className="text-sm" />
        <span>{project.memberCount || 0} members</span>
      </div>

      <div className="sv-projects-cell sv-projects-cell-client" data-label="Client" title={clientName}>
        <Icon name="business" className="text-sm" />
        <span>{clientName}</span>
      </div>

      <div className="sv-projects-cell sv-projects-cell-status" data-label="Status">
        <span className={`sv-projects-status-chip ${statusBadge.className}`}>{statusBadge.label}</span>
      </div>

      <div className="sv-projects-cell sv-projects-cell-progress" data-label="Progress">
        <div className="sv-projects-progress-meter" aria-label={`${progress}% complete`}>
          <span style={{ width: `${progress}%` }} />
        </div>
        <strong>{progress}%</strong>
        <small>{progress >= 90 ? 'Nearly done' : progress >= 50 ? 'In progress' : progress > 0 ? 'Started' : 'Not started'}</small>
      </div>

      <div className="sv-projects-cell sv-projects-cell-actions">
        <div className="relative project-menu-container">
          <button
            type="button"
            onClick={() => onToggleMenu(id)}
            className="sv-projects-menu-btn"
            title="Project options"
          >
            <Icon name="more_vert" className="text-lg" />
          </button>
          {menuOpen ? (
            <div className="sv-projects-menu-popover">
              <button type="button" onClick={() => onOpenBoard(id)} className="sv-projects-menu-item">
                <Icon name="folder_open" className="text-sm" />
                Open
              </button>
              {canUpdateProject ? (
                <button type="button" onClick={() => onEdit(project)} className="sv-projects-menu-item">
                  <Icon name="description" className="text-sm" />
                  Edit
                </button>
              ) : (
                <DeniedActionButton role={role} actionLabel="edit projects" className="sv-projects-menu-item">
                  Edit
                </DeniedActionButton>
              )}
              {canDeleteProject ? (
                <button type="button" onClick={() => onDelete(id)} className="sv-projects-menu-item is-danger">
                  <Icon name="delete_outline" className="text-sm" />
                  Delete
                </button>
              ) : (
                <DeniedActionButton role={role} actionLabel="delete projects" className="sv-projects-menu-item is-danger">
                  Delete
                </DeniedActionButton>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </li>
  );
});

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
  const [projectPage, setProjectPage] = useState(1);
  const [projectPages, setProjectPages] = useState([]);
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
  const projectSearchParam = searchQuery.trim();
  const hasActiveFilters = Boolean(projectSearchParam || filterStatus !== 'all');

  const projectsQuery = useQuery({
    queryKey: ['projects', workspaceId, projectPage, projectSearchParam, filterStatus],
    queryFn: () => projectsApi.list(workspaceId, {
      page: projectPage,
      limit: PROJECT_PAGE_SIZE,
      ...(projectSearchParam && { search: projectSearchParam }),
      ...(filterStatus !== 'all' && { status: filterStatus }),
    }),
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
      setProjectPages([]);
      setProjectPage(1);
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
      setProjectPages([]);
      setProjectPage(1);
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

  useEffect(() => {
    // Reset paging when the workspace or filters change so the list reloads from page 1.
    setProjectPage(1);
    setProjectPages([]);
    setMenuOpenProjectId(null);
  }, [workspaceId, projectSearchParam, filterStatus]);

  useEffect(() => {
    if (!projectsQuery.data) return;
    const incomingProjects = projectsQuery.data.data || [];
    // Keep the cached page buffer in sync with the latest fetched page.
    setProjectPages((current) => {
      if (projectPage === 1) return [incomingProjects];
      const next = current.slice(0, projectPage - 1);
      next[projectPage - 1] = incomingProjects;
      return next;
    });
  }, [projectPage, projectsQuery.data]);

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

    const refreshProjects = () => {
      setProjectPages([]);
      setProjectPage(1);
      refetchProjects();
    };
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

  const loadedProjects = useMemo(() => projectPages.flat(), [projectPages]);
  const projectsMeta = projectsQuery.data?.meta || {};
  const projectsTotal = Number(projectsMeta.total ?? loadedProjects.length);
  const currentPageItems = projectsQuery.data?.data || [];
  const hasMoreProjects = projectsTotal > loadedProjects.length || (!projectsMeta.total && currentPageItems.length === PROJECT_PAGE_SIZE);
  const users = useMemo(() => usersQuery.data || [], [usersQuery.data]);
  const teams = useMemo(() => teamsQuery.data || [], [teamsQuery.data]);
  const clients = useMemo(() => clientsQuery.data || [], [clientsQuery.data]);

  const filteredProjects = useMemo(() => {
    return loadedProjects.filter((project) => {
      const matchesSearch = !searchQuery || 
        (project.name || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = filterStatus === 'all' || 
        (project.status || 'active') === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [loadedProjects, searchQuery, filterStatus]);

  const canCreate = useMemo(() => name.trim().length >= 2 && ownerId, [name, ownerId]);

  const userOptions = useMemo(
    () => users.map((u) => ({ value: u._id, label: u.displayName || u.email || 'Unknown' })),
    [users]
  );
  const optionalUserOptions = useMemo(() => [{ value: '', label: 'Select user' }, ...userOptions], [userOptions]);
  const ownerOptions = useMemo(() => [{ value: '', label: 'Select owner' }, ...userOptions], [userOptions]);
  const teamOptions = useMemo(
    () => [{ value: '', label: 'Select team' }, ...teams.map((t) => ({ value: t._id, label: t.name || 'Unknown Team' }))],
    [teams]
  );
  const clientOptions = useMemo(
    () => [{ value: '', label: 'Select client' }, ...clients.map((c) => ({ value: c._id, label: c.name || 'Unknown Client' }))],
    [clients]
  );
  const summaryCards = useMemo(() => {
    const counts = loadedProjects.reduce((acc, project) => {
      const key = project.status || 'active';
      acc[key] = (acc[key] || 0) + 1;
      acc.progress += Math.max(0, Math.min(100, Number(project.progress || 0)));
      if (project.clientId || project.clientName) acc.withClient += 1;
      if (project.endDate) acc.withTimeline += 1;
      return acc;
    }, { active: 0, archived: 0, on_hold: 0, planned: 0, progress: 0, withClient: 0, withTimeline: 0 });
    const total = loadedProjects.length || 0;
    const averageProgress = total ? Math.round(counts.progress / total) : 0;

    return [
      { label: 'Total', value: String(total), hint: total === 1 ? 'project loaded' : 'projects loaded', tone: 'blue' },
      { label: 'Active', value: String(counts.active || 0), hint: 'in motion', tone: 'green' },
      { label: 'Clients', value: String(counts.withClient || 0), hint: 'linked accounts', tone: 'amber' },
      { label: 'Average', value: `${averageProgress}%`, hint: 'completion', tone: 'red' },
    ];
  }, [loadedProjects]);
  const projectPulse = useMemo(() => {
    const total = loadedProjects.length || 0;
    const average = total
      ? Math.round(loadedProjects.reduce((sum, project) => sum + Math.max(0, Math.min(100, Number(project.progress || 0))), 0) / total)
      : 0;
    const readyCount = loadedProjects.filter((project) => Number(project.progress || 0) >= 90).length;
    const plannedCount = loadedProjects.filter((project) => (project.status || 'active') === 'planned').length;
    return {
      average,
      readyCount,
      plannedCount,
      label: average >= 75 ? 'Strong delivery motion' : average >= 35 ? 'Delivery in motion' : 'Early delivery stage',
    };
  }, [loadedProjects]);

  const handleSearchQueryChange = useCallback((event) => {
    setSearchQuery(event.target.value);
    setProjectPage(1);
    setProjectPages([]);
  }, []);

  const handleFilterStatusChange = useCallback((nextStatus) => {
    setFilterStatus(nextStatus);
    setProjectPage(1);
    setProjectPages([]);
  }, []);

  const handleClearFilters = useCallback(() => {
    setSearchQuery('');
    setFilterStatus('all');
    setProjectPage(1);
    setProjectPages([]);
  }, []);

  const handleToggleProjectMenu = useCallback((projectId) => {
    setMenuOpenProjectId((current) => (current === projectId ? null : projectId));
  }, []);

  const handleOpenBoard = useCallback((projectId) => {
    if (!projectId) return;
    setProjectId(projectId);
    navigate(`/projects/${projectId}/board`);
  }, [navigate, setProjectId]);

  const loadMoreProjects = useCallback(() => {
    if (projectsQuery.isFetching || !hasMoreProjects) return;
    setProjectPage((current) => current + 1);
  }, [hasMoreProjects, projectsQuery.isFetching]);

  const handleExportProjects = useCallback((format) => {
    exportRows({
      rows: filteredProjects,
      format,
      filename: `projects-${new Date().toISOString().slice(0, 10)}`,
      title: 'Projects Export',
      columns: [
        { header: 'Project', value: (row) => row.name || 'Untitled project' },
        { header: 'Status', value: (row) => row.status || 'active' },
        { header: 'Client', value: (row) => row.clientName || 'No client' },
        { header: 'Members', value: (row) => row.memberCount || 0 },
        { header: 'Progress', value: (row) => `${Math.max(0, Math.min(100, Number(row.progress || 0)))}%` },
        { header: 'Start Date', value: (row) => fmtShortDate(row.startDate) || '-' },
        { header: 'End Date', value: (row) => fmtShortDate(row.endDate) || '-' },
      ],
    });
  }, [filteredProjects]);

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

  if (projectsQuery.isLoading && !loadedProjects.length) {
    return (
      <div className="sv-projects-page sv-projects-state-wrap">
        <div className="sv-card sv-projects-state-card">
          <div className="sv-projects-state-icon sv-projects-state-icon--loading">
            <div className="sv-projects-spinner" />
          </div>
          <h2 className="sv-projects-state-title sv-heading">Loading projects</h2>
          <p className="sv-projects-state-text">Fetching the latest workspace projects and access data.</p>
        </div>
      </div>
    );
  }

  if (projectsQuery.error) {
    return (
      <div className="sv-projects-page sv-projects-state-wrap">
        <div className="sv-card sv-projects-state-card sv-projects-state-card-error">
          <div className="sv-projects-state-icon sv-projects-state-icon-error">
            <Icon name="error_outline" className="text-2xl" />
          </div>
          <h2 className="sv-projects-state-title sv-heading">Could not load projects</h2>
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
            <div className="sv-projects-hero-icon" aria-hidden="true">
              <Icon name="folder_managed" className="text-2xl" />
            </div>
            <div className="sv-projects-hero-copy">
              <span className="sv-projects-eyebrow"><Icon name="hub" className="text-sm" /> Workspace hub</span>
              <h1 className="sv-projects-title sv-heading">Projects</h1>
              <p className="sv-projects-subtitle">
                {filteredProjects.length} shown of {projectsTotal || filteredProjects.length} {projectsTotal === 1 ? 'project' : 'projects'}
                {hasActiveFilters ? ' with active filters applied' : ' across the current workspace'}
              </p>
              <div className="sv-projects-summary-chips" aria-label="Project summary">
                {summaryCards.map((item) => (
                  <div key={item.label} className={`sv-projects-summary-chip is-${item.tone}`}>
                    <strong>{item.value}</strong>
                    <span>
                      <em>{item.label}</em>
                      {item.hint ? <small>{item.hint}</small> : null}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="sv-projects-pulse-card">
            <span>Delivery Pulse</span>
            <strong>{projectPulse.average}%</strong>
            <p>{projectPulse.label}</p>
            <div>
              <small>{projectPulse.readyCount} near completion</small>
              <small>{projectPulse.plannedCount} planned</small>
            </div>
          </div>
          <div className="sv-projects-actions">
            <ExportMenu onExport={handleExportProjects} label="Export" disabled={!filteredProjects.length} />
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

        {(loadedProjects.length > 0 || projectSearchParam || filterStatus !== 'all') && (
          <div className="sv-card sv-projects-toolbar">
            <div className="sv-projects-toolbar-main">
              <div className="sv-projects-search-wrap">
                <Icon name="search" className="sv-projects-search-icon" />
                <input
                  type="text"
                  placeholder="Search projects..."
                  value={searchQuery}
                  onChange={handleSearchQueryChange}
                  className="form-control form-control-sm sv-ctl-input sv-projects-search-input"
                  aria-label="Search projects"
                />
              </div>
              <div className="sv-projects-filter-wrap">
                <ProjectDropdown
                  value={filterStatus}
                  options={PROJECT_FILTER_OPTIONS}
                  onChange={handleFilterStatusChange}
                  className="sv-projects-dropdown--filter"
                />
              </div>
            </div>
          </div>
        )}

        {!loadedProjects.length && !projectSearchParam && filterStatus === 'all' && !projectsQuery.isFetching ? (
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
        ) : !filteredProjects.length && !projectsQuery.isFetching ? (
          <div className="sv-card sv-projects-empty-card">
            <div className="sv-projects-state-icon">
              <Icon name="search_off" className="text-3xl" />
            </div>
            <h3 className="sv-projects-empty-title">No projects found</h3>
            <p className="sv-projects-empty-text">Try adjusting your search or clearing the active filters.</p>
            {hasActiveFilters ? (
              <button type="button" className="btn btn-outline-primary btn-sm sv-ctl-btn sv-projects-create-btn" onClick={handleClearFilters}>
                Reset view
              </button>
            ) : null}
          </div>
        ) : (
          <div className="sv-card sv-projects-table-panel">
            <div className="sv-projects-table-head" aria-hidden="true">
              <span>Project</span>
              <span>Members</span>
              <span>Client</span>
              <span>Status</span>
              <span>Progress</span>
              <span>Actions</span>
            </div>
            <div className="sv-projects-table-body">
              <ul className="sv-projects-rows">
                {filteredProjects.map((project) => {
                  const id = String(project._id || project.id || '');
                  const statusBadge = getStatusBadge(project.status);
                  return (
                    <ProjectListRow
                      key={id}
                      project={project}
                      statusBadge={statusBadge}
                      menuOpen={menuOpenProjectId === id}
                      canUpdateProject={canUpdateProject}
                      canDeleteProject={canDeleteProject}
                      role={role}
                      onToggleMenu={handleToggleProjectMenu}
                      onEdit={handleOpenEditModal}
                      onDelete={handleOpenDeleteConfirm}
                      onOpenBoard={handleOpenBoard}
                    />
                  );
                })}
                {hasMoreProjects ? (
                  <li className="sv-projects-load-more-row">
                    <button
                      type="button"
                      className="btn btn-outline-primary btn-sm sv-ctl-btn sv-projects-load-more-btn"
                      onClick={loadMoreProjects}
                      disabled={projectsQuery.isFetching}
                    >
                      {projectsQuery.isFetching ? 'Loading...' : `Load More (${loadedProjects.length}/${projectsTotal || 'more'})`}
                    </button>
                  </li>
                ) : null}
              </ul>
            </div>
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
              <p className="sv-projects-form-intro">Start with a clear name and owner, then add optional delivery details.</p>

              <section className="sv-projects-form-section">
                <div className="sv-projects-form-section-head">
                  <h3>Core details</h3>
                  <span>Required fields first</span>
                </div>
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
                    <ProjectDropdown
                      value={status}
                      options={PROJECT_STATUS_OPTIONS}
                      onChange={setStatus}
                      className="sv-projects-dropdown--form"
                    />
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
                </div>
              </section>

              <section className="sv-projects-form-section">
                <div className="sv-projects-form-section-head">
                  <h3>Assignment</h3>
                  <span>Ownership and collaboration</span>
                </div>
                <div className="sv-projects-form-grid">
                  <div>
                    <label className="sv-projects-label">
                      Owner <span className="text-error">*</span>
                    </label>
                    <ProjectDropdown
                      value={ownerId}
                      options={ownerOptions}
                      onChange={setOwnerId}
                      className="sv-projects-dropdown--form"
                      disabled={usersQuery.isLoading}
                    />
                  </div>

                  <div>
                    <label className="sv-projects-label">Lead (Optional)</label>
                    <ProjectDropdown
                      value={leadId}
                      options={optionalUserOptions}
                      onChange={setLeadId}
                      className="sv-projects-dropdown--form"
                      disabled={usersQuery.isLoading}
                    />
                  </div>

                  <div>
                    <label className="sv-projects-label">Team (Optional)</label>
                    <ProjectDropdown
                      value={teamId}
                      options={teamOptions}
                      onChange={setTeamId}
                      className="sv-projects-dropdown--form"
                      disabled={teamsQuery.isLoading}
                    />
                  </div>

                  <div>
                    <label className="sv-projects-label">Client (Optional)</label>
                    <ProjectDropdown
                      value={clientId}
                      options={clientOptions}
                      onChange={setClientId}
                      className="sv-projects-dropdown--form"
                      disabled={clientsQuery.isLoading}
                    />
                  </div>
                </div>
              </section>

              <section className="sv-projects-form-section">
                <div className="sv-projects-form-section-head">
                  <h3>Timeline and details</h3>
                  <span>Optional planning context</span>
                </div>
                <div className="sv-projects-form-grid">
                  <div>
                    <label className="sv-projects-label">Start Date (Optional)</label>
                    <ProjectDatePicker
                      value={startDate}
                      onChange={setStartDate}
                      className="sv-projects-date--form"
                    />
                  </div>

                  <div>
                    <label className="sv-projects-label">End Date (Optional)</label>
                    <ProjectDatePicker
                      value={endDate}
                      onChange={setEndDate}
                      className="sv-projects-date--form"
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
              </section>

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
              <p className="sv-projects-form-intro">Update the project without losing the key ownership and schedule details.</p>

              <section className="sv-projects-form-section">
                <div className="sv-projects-form-section-head">
                  <h3>Core details</h3>
                  <span>Required fields first</span>
                </div>
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
                    <ProjectDropdown
                      value={editProjectData.status}
                      options={PROJECT_STATUS_OPTIONS}
                      onChange={(nextStatus) => setEditProjectData((current) => ({ ...current, status: nextStatus }))}
                      className="sv-projects-dropdown--form"
                    />
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
                </div>
              </section>

              <section className="sv-projects-form-section">
                <div className="sv-projects-form-section-head">
                  <h3>Assignment</h3>
                  <span>Ownership and collaboration</span>
                </div>
                <div className="sv-projects-form-grid">
                  <div>
                    <label className="sv-projects-label">
                      Owner <span className="text-error">*</span>
                    </label>
                    <ProjectDropdown
                      value={editProjectData.ownerId}
                      options={ownerOptions}
                      onChange={(nextOwnerId) => setEditProjectData((current) => ({ ...current, ownerId: nextOwnerId }))}
                      className="sv-projects-dropdown--form"
                      disabled={usersQuery.isLoading}
                    />
                  </div>

                  <div>
                    <label className="sv-projects-label">Lead (Optional)</label>
                    <ProjectDropdown
                      value={editProjectData.leadId}
                      options={optionalUserOptions}
                      onChange={(nextLeadId) => setEditProjectData((current) => ({ ...current, leadId: nextLeadId }))}
                      className="sv-projects-dropdown--form"
                      disabled={usersQuery.isLoading}
                    />
                  </div>

                  <div>
                    <label className="sv-projects-label">Team (Optional)</label>
                    <ProjectDropdown
                      value={editProjectData.teamId}
                      options={teamOptions}
                      onChange={(nextTeamId) => setEditProjectData((current) => ({ ...current, teamId: nextTeamId }))}
                      className="sv-projects-dropdown--form"
                      disabled={teamsQuery.isLoading}
                    />
                  </div>

                  <div>
                    <label className="sv-projects-label">Client (Optional)</label>
                    <ProjectDropdown
                      value={editProjectData.clientId}
                      options={clientOptions}
                      onChange={(nextClientId) => setEditProjectData((current) => ({ ...current, clientId: nextClientId }))}
                      className="sv-projects-dropdown--form"
                      disabled={clientsQuery.isLoading}
                    />
                  </div>
                </div>
              </section>

              <section className="sv-projects-form-section">
                <div className="sv-projects-form-section-head">
                  <h3>Timeline and details</h3>
                  <span>Optional planning context</span>
                </div>
                <div className="sv-projects-form-grid">
                  <div>
                    <label className="sv-projects-label">Start Date (Optional)</label>
                    <ProjectDatePicker
                      value={editProjectData.startDate}
                      onChange={(nextStartDate) => setEditProjectData((current) => ({ ...current, startDate: nextStartDate }))}
                      className="sv-projects-date--form"
                    />
                  </div>

                  <div>
                    <label className="sv-projects-label">End Date (Optional)</label>
                    <ProjectDatePicker
                      value={editProjectData.endDate}
                      onChange={(nextEndDate) => setEditProjectData((current) => ({ ...current, endDate: nextEndDate }))}
                      className="sv-projects-date--form"
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
              </section>

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
