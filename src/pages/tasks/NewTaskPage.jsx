import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/ui/Icon';
import DeniedActionButton from '../../components/ui/DeniedActionButton';
import { useNewTask } from '../../hooks/useNewTask';
import { usePermission } from '../../hooks/usePermission';
import { projectRoute } from '../../routes/routePaths';

const ISSUE_TYPES = [
  { value: 'task', label: 'Task' },
  { value: 'bug', label: 'Bug' },
  { value: 'story', label: 'Story' },
  { value: 'epic', label: 'Epic' },
  { value: 'subtask', label: 'Sub Task' },
];

const PRIORITIES = ['low', 'medium', 'high', 'critical'];

function getDisplayName(item, fallback = 'Unknown') {
  return String(item?.displayName || item?.name || item?.email || fallback);
}

function SearchableSinglePicker({
  label,
  placeholder,
  search,
  onSearch,
  options,
  value,
  onChange,
  onLoadMore,
  meta,
}) {
  const selectedLabel = useMemo(() => {
    const selected = (options || []).find((item) => String(item?._id) === String(value || ''));
    return selected ? getDisplayName(selected) : 'Unassigned';
  }, [options, value]);

  return (
    <div className="sv-newtask-picker">
      <p className="sv-newtask-section-label text-uppercase fw-semibold small mb-1">{label}</p>
      <div className="sv-newtask-picker-selected">{selectedLabel}</div>
      <input
        type="text"
        value={search}
        onChange={(event) => onSearch(event.target.value)}
        placeholder={placeholder}
        className="form-control sv-ctl-input sv-newtask-field sv-newtask-picker-search"
      />
      <div className="sv-newtask-picker-list">
        {(options || []).map((item) => {
          const itemId = String(item?._id || '');
          const active = String(value || '') === itemId;
          return (
            <button
              key={`assignee-${itemId}`}
              type="button"
              className={`sv-newtask-picker-item ${active ? 'is-active' : ''}`}
              onClick={() => onChange(itemId)}
            >
              <span className="sv-newtask-picker-radio">{active ? '?' : '?'}</span>
              <span className="text-truncate">{getDisplayName(item, 'User')}</span>
            </button>
          );
        })}
        {!options?.length && !meta?.loading ? <p className="sv-newtask-picker-empty">No matches found.</p> : null}
      </div>
      {meta?.hasMore ? (
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary sv-ctl-btn sv-newtask-picker-more"
          onClick={onLoadMore}
          disabled={meta?.loadingMore}
        >
          {meta?.loadingMore ? 'Loading...' : 'Load more'}
        </button>
      ) : null}
    </div>
  );
}

function SearchableMultiPicker({
  label,
  placeholder,
  search,
  onSearch,
  options,
  selected,
  onToggle,
  onLoadMore,
  meta,
}) {
  return (
    <div className="sv-newtask-picker">
      <p className="sv-newtask-section-label text-uppercase fw-semibold small mb-1">{label}</p>
      <input
        type="text"
        value={search}
        onChange={(event) => onSearch(event.target.value)}
        placeholder={placeholder}
        className="form-control sv-ctl-input sv-newtask-field sv-newtask-picker-search"
      />
      <div className="sv-newtask-picker-list">
        {(options || []).map((item) => {
          const itemId = String(item?._id || '');
          const active = selected.has(itemId);
          return (
            <label key={`${label}-${itemId}`} className={`sv-newtask-picker-item ${active ? 'is-active' : ''}`}>
              <input
                type="checkbox"
                className="form-check-input"
                checked={active}
                onChange={() => onToggle(item)}
              />
              <span className="text-truncate">{getDisplayName(item, label)}</span>
            </label>
          );
        })}
        {!options?.length && !meta?.loading ? <p className="sv-newtask-picker-empty">No matches found.</p> : null}
      </div>
      {meta?.hasMore ? (
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary sv-ctl-btn sv-newtask-picker-more"
          onClick={onLoadMore}
          disabled={meta?.loadingMore}
        >
          {meta?.loadingMore ? 'Loading...' : 'Load more'}
        </button>
      ) : null}
    </div>
  );
}

function NewTaskPage() {
  const navigate = useNavigate();
  const { can, role } = usePermission();
  const canCreateTask = can('task', 'create');
  const {
    projects,
    users,
    contacts,
    employees,
    parentTasks,
    directoryMeta,
    draft,
    loading,
    submitting,
    error,
    setField,
    setDirectoryQuery,
    loadMoreDirectory,
    addTag,
    removeTag,
    setAttachmentFiles,
    submit,
  } = useNewTask();

  const [userSearch, setUserSearch] = useState('');
  const [contactSearch, setContactSearch] = useState('');
  const [employeeSearch, setEmployeeSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDirectoryQuery('users', userSearch);
    }, 250);
    return () => clearTimeout(timer);
  }, [userSearch, setDirectoryQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDirectoryQuery('contacts', contactSearch);
    }, 250);
    return () => clearTimeout(timer);
  }, [contactSearch, setDirectoryQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDirectoryQuery('employees', employeeSearch);
    }, 250);
    return () => clearTimeout(timer);
  }, [employeeSearch, setDirectoryQuery]);

  const contributorSet = useMemo(
    () => new Set((Array.isArray(draft.assigneeIds) ? draft.assigneeIds : []).map((item) => String(item))),
    [draft.assigneeIds],
  );

  const externalContactSet = useMemo(() => {
    const set = new Set();
    (Array.isArray(draft.externalCollaborators) ? draft.externalCollaborators : []).forEach((item) => {
      if (item?.entityType === 'contact') {
        set.add(String(item.entityId));
      }
    });
    return set;
  }, [draft.externalCollaborators]);

  const externalEmployeeSet = useMemo(() => {
    const set = new Set();
    (Array.isArray(draft.externalCollaborators) ? draft.externalCollaborators : []).forEach((item) => {
      if (item?.entityType === 'employee') {
        set.add(String(item.entityId));
      }
    });
    return set;
  }, [draft.externalCollaborators]);

  const selectedContactNames = useMemo(
    () => contacts.filter((item) => externalContactSet.has(String(item?._id || ''))).map((item) => getDisplayName(item, 'Contact')),
    [contacts, externalContactSet],
  );

  const selectedEmployeeNames = useMemo(
    () => employees.filter((item) => externalEmployeeSet.has(String(item?._id || ''))).map((item) => getDisplayName(item, 'Employee')),
    [employees, externalEmployeeSet],
  );

  const selectedContributorNames = useMemo(
    () => users.filter((item) => contributorSet.has(String(item?._id || ''))).map((item) => getDisplayName(item, 'User')),
    [users, contributorSet],
  );

  const onToggleContributor = (user) => {
    const id = String(user?._id || '');
    if (!id) return;
    const current = Array.isArray(draft.assigneeIds) ? draft.assigneeIds : [];
    const next = contributorSet.has(id)
      ? current.filter((item) => String(item) !== id)
      : [...current, id];
    setField('assigneeIds', next);
  };

  const onToggleExternal = (entityType, item) => {
    const id = String(item?._id || '');
    if (!id) return;
    const current = Array.isArray(draft.externalCollaborators) ? draft.externalCollaborators : [];
    const exists = current.some((entry) => entry?.entityType === entityType && String(entry?.entityId) === id);
    const next = exists
      ? current.filter((entry) => !(entry?.entityType === entityType && String(entry?.entityId) === id))
      : [...current, { entityType, entityId: id }];
    setField('externalCollaborators', next);
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    if (!canCreateTask) return;
    const created = await submit();
    if (!created) return;
    const nextProjectId = created?.projectId || draft.projectId;
    navigate(projectRoute('board', nextProjectId));
  };

  if (loading) {
    return <div className="sv-card p-4">Loading new task form...</div>;
  }

  if (!canCreateTask) {
    return (
      <main className="sv-newtask-page" aria-label="Create new task">
        <section className="sv-card p-4">
          <h1 className="h5 mb-2">Create Task</h1>
          <p className="text-secondary mb-3">Your current role can view tasks but cannot create them.</p>
          <DeniedActionButton role={role} actionLabel="create tasks" className="btn btn-primary sv-ctl-btn">
            Create Task
          </DeniedActionButton>
        </section>
      </main>
    );
  }

  return (
    <main className="sv-newtask-page" aria-label="Create new task">
      <form className="sv-newtask-form d-grid" style={{ gridTemplateColumns: 'minmax(0,1fr) 380px', gap: '0.85rem' }} onSubmit={onSubmit}>
        <section className="d-grid" style={{ gap: '0.85rem' }}>
          <article className="sv-card sv-newtask-card">
            <label className="sv-newtask-section-label text-uppercase fw-semibold small" htmlFor="new-task-title">Task title</label>
            <input
              id="new-task-title"
              type="text"
              value={draft.title}
              onChange={(event) => setField('title', event.target.value)}
              className="form-control sv-newtask-title-input border-0 shadow-none px-0"
              placeholder="What needs to be done?"
            />

            <label className="sv-newtask-section-label text-uppercase fw-semibold small" htmlFor="new-task-description">Description</label>
            <div className="sv-newtask-editor rounded-3 border p-3">
              <div className="sv-newtask-editor-toolbar d-flex align-items-center gap-2 mb-2">
                <button type="button" className="btn btn-sm sv-newtask-editor-btn"><strong>B</strong></button>
                <button type="button" className="btn btn-sm sv-newtask-editor-btn"><em>/</em></button>
                <button type="button" className="btn btn-sm sv-newtask-editor-btn"><Icon name="format_list_bulleted" /></button>
                <button type="button" className="btn btn-sm sv-newtask-editor-btn"><Icon name="link" /></button>
              </div>
              <textarea
                id="new-task-description"
                value={draft.description}
                onChange={(event) => setField('description', event.target.value)}
                className="form-control sv-newtask-editor-input border-0 px-0"
                placeholder="Describe the task, requirements, and acceptance criteria..."
              />
            </div>
          </article>

          <article className="sv-card sv-newtask-card">
            <p className="sv-newtask-section-label text-uppercase fw-semibold small mb-2">Attachments</p>
            <label className="sv-newtask-upload d-flex flex-column align-items-center justify-content-center text-center border border-2 border-dashed p-4 w-100" htmlFor="new-task-attachments">
              <span className="sv-newtask-upload-icon rounded-3 d-inline-flex align-items-center justify-content-center mb-3" style={{ width: 46, height: 46 }}>
                <Icon name="upload_file" className="text-primary" />
              </span>
              <p className="sv-newtask-upload-title fw-semibold mb-1">Drop files here or <span className="text-primary">browse</span></p>
              <p className="sv-newtask-upload-subtitle mb-0">Maximum file size: 50MB. Support for PDF, PNG, JPG, and ZIP.</p>
            </label>
            <input
              id="new-task-attachments"
              type="file"
              multiple
              className="d-none"
              onChange={(event) => setAttachmentFiles(event.target.files)}
            />
            {(draft.attachments || []).length ? (
              <div className="mt-3 d-grid" style={{ gap: '0.45rem' }}>
                {draft.attachments.map((attachment, index) => (
                  <div key={`${attachment.fileName || 'file'}-${index}`} className="sv-newtask-attachment-item rounded-3 px-3 py-2 d-flex align-items-center justify-content-between">
                    <span className="text-truncate pe-2">{attachment.fileName || 'Attachment'}</span>
                    <small className="text-muted">{Math.max(1, Math.round((Number(attachment.size || 0) / 1024)))} KB</small>
                  </div>
                ))}
              </div>
            ) : null}
          </article>
        </section>

        <aside className="d-grid" style={{ gap: '0.75rem', alignContent: 'start' }}>
          <article className="sv-card sv-newtask-card">
            <p className="sv-newtask-section-label text-uppercase fw-semibold small mb-2">People</p>

            <SearchableSinglePicker
              label="Primary Assignee"
              placeholder="Search users..."
              search={userSearch}
              onSearch={setUserSearch}
              options={users}
              value={draft.primaryAssigneeId}
              onChange={(id) => setField('primaryAssigneeId', id)}
              onLoadMore={() => loadMoreDirectory('users')}
              meta={directoryMeta.users}
            />

            <SearchableMultiPicker
              label="Contributors"
              placeholder="Search contributors..."
              search={userSearch}
              onSearch={setUserSearch}
              options={users}
              selected={contributorSet}
              onToggle={onToggleContributor}
              onLoadMore={() => loadMoreDirectory('users')}
              meta={directoryMeta.users}
            />
            {selectedContributorNames.length ? (
              <div className="sv-newtask-chip-row">
                {selectedContributorNames.map((name) => (
                  <span key={`contrib-${name}`} className="sv-newtask-chip px-2 py-1">{name}</span>
                ))}
              </div>
            ) : null}

            <SearchableMultiPicker
              label="External Contacts"
              placeholder="Search contacts..."
              search={contactSearch}
              onSearch={setContactSearch}
              options={contacts}
              selected={externalContactSet}
              onToggle={(item) => onToggleExternal('contact', item)}
              onLoadMore={() => loadMoreDirectory('contacts')}
              meta={directoryMeta.contacts}
            />
            {selectedContactNames.length ? (
              <div className="sv-newtask-chip-row">
                {selectedContactNames.map((name) => (
                  <span key={`ext-contact-${name}`} className="sv-newtask-chip px-2 py-1">{name}</span>
                ))}
              </div>
            ) : null}

            <SearchableMultiPicker
              label="External Employees"
              placeholder="Search employees..."
              search={employeeSearch}
              onSearch={setEmployeeSearch}
              options={employees}
              selected={externalEmployeeSet}
              onToggle={(item) => onToggleExternal('employee', item)}
              onLoadMore={() => loadMoreDirectory('employees')}
              meta={directoryMeta.employees}
            />
            {selectedEmployeeNames.length ? (
              <div className="sv-newtask-chip-row">
                {selectedEmployeeNames.map((name) => (
                  <span key={`ext-employee-${name}`} className="sv-newtask-chip px-2 py-1">{name}</span>
                ))}
              </div>
            ) : null}
          </article>

          <article className="sv-card sv-newtask-card">
            <p className="sv-newtask-section-label text-uppercase fw-semibold small mb-2">Timeline</p>
            <input
              type="date"
              value={draft.dueDate || ''}
              onChange={(event) => setField('dueDate', event.target.value)}
              className="form-control sv-newtask-field mb-2"
            />

            <p className="sv-newtask-section-label text-uppercase fw-semibold small mb-2">Priority</p>
            <div className="d-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '0.42rem' }}>
              {PRIORITIES.map((priority) => (
                <button
                  key={priority}
                  type="button"
                  onClick={() => setField('priority', priority)}
                  className={`btn sv-newtask-priority text-start ${String(draft.priority) === priority ? 'btn-warning' : 'btn-outline-secondary'}`}
                >
                  {priority}
                </button>
              ))}
            </div>
          </article>

          <article className="sv-card sv-newtask-card">
            <p className="sv-newtask-section-label text-uppercase fw-semibold small mb-1">Project</p>
            <select
              value={draft.projectId || ''}
              onChange={(event) => setField('projectId', event.target.value)}
              className="form-select sv-newtask-field mb-2"
            >
              <option value="">Select project</option>
              {projects.map((project) => (
                <option key={project._id} value={project._id}>{project.name || 'Project'}</option>
              ))}
            </select>

            <p className="sv-newtask-section-label text-uppercase fw-semibold small mb-1">Issue Type</p>
            <select
              value={draft.issueType || 'task'}
              onChange={(event) => setField('issueType', event.target.value)}
              className="form-select sv-newtask-field mb-2"
            >
              {ISSUE_TYPES.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>

            <p className="sv-newtask-section-label text-uppercase fw-semibold small mb-1">Parent</p>
            <select
              value={draft.parentTaskId || ''}
              onChange={(event) => setField('parentTaskId', event.target.value)}
              className="form-select sv-newtask-field mb-2"
            >
              <option value="">No parent</option>
              {parentTasks.map((task) => (
                <option key={task._id} value={task._id}>{task.title || 'Task'}</option>
              ))}
            </select>

            <p className="sv-newtask-section-label text-uppercase fw-semibold small mb-1">Tags</p>
            <div className="sv-newtask-tag-list mb-2">
              {(draft.tags || []).map((tag) => (
                <button key={tag} type="button" className="sv-newtask-tag rounded-pill" onClick={() => removeTag(tag)}>
                  {tag} <span aria-hidden="true">×</span>
                </button>
              ))}
            </div>
            <div className="d-flex gap-2">
              <input
                value={draft.tagsInput || ''}
                onChange={(event) => setField('tagsInput', event.target.value)}
                className="form-control sv-newtask-field"
                placeholder="Add tag"
              />
              <button type="button" className="btn btn-outline-secondary sv-ctl-btn" onClick={addTag}>Add</button>
            </div>

            {error ? <p className="sv-newtask-error small mt-2 mb-0">{error}</p> : null}

            <div className="sv-newtask-actions d-grid mt-3" style={{ gridTemplateColumns: '1fr 1fr', gap: '0.55rem' }}>
              <button type="button" className="btn btn-outline-secondary sv-ctl-btn" onClick={() => navigate(-1)}>Cancel</button>
              <button type="submit" className="btn btn-primary sv-ctl-btn" disabled={submitting}>{submitting ? 'Creating...' : 'Create Task'}</button>
            </div>
          </article>
        </aside>
      </form>
    </main>
  );
}

export default NewTaskPage;

