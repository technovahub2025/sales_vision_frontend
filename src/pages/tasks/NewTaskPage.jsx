import { useNavigate } from 'react-router-dom';
import Icon from '../../components/ui/Icon';
import { projectRoute } from '../../routes/routePaths';
import { useNewTask } from '../../hooks/useNewTask';
import { useWorkspace } from '../../contexts/WorkspaceContext';

function chipClass(active, tone) {
  if (!active) return 'border border-outline-variant bg-white text-on-surface';
  if (tone === 'critical') return 'border border-red-500 bg-red-50 text-red-700';
  if (tone === 'high') return 'border border-orange-500 bg-orange-50 text-orange-700';
  if (tone === 'medium') return 'border border-blue-500 bg-blue-50 text-blue-700';
  return 'border border-slate-500 bg-slate-50 text-slate-700';
}

export default function NewTaskPage() {
  const navigate = useNavigate();
  const { setProjectId } = useWorkspace();
  const {
    projects,
    users,
    contacts,
    employees,
    parentTasks,
    draft,
    loading,
    submitting,
    error,
    setField,
    addTag,
    removeTag,
    setAttachmentFiles,
    submit,
  } = useNewTask();

  if (loading) {
    return <p className="text-sm text-on-surface-variant">Loading new task form...</p>;
  }

  const onSubmit = async (event) => {
    event.preventDefault();
    const created = await submit();
    if (created) {
      const nextProjectId = String(draft.projectId || created.projectId || '');
      if (nextProjectId) {
        setProjectId(nextProjectId);
        window.localStorage.setItem('salevision:projectId', nextProjectId);
      }
      navigate(projectRoute('board', nextProjectId));
    }
  };

  return (
    <main className="min-h-screen">
      <form onSubmit={onSubmit} className="mx-auto grid max-w-[1500px] grid-cols-1 gap-6 xl:grid-cols-[1fr_420px]">
        <section className="space-y-6">
          <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-8">
            <p className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-on-surface">Task Title</p>
            <input
              value={draft.title}
              onChange={(e) => setField('title', e.target.value)}
              placeholder="What needs to be done?"
              className="w-full border-none bg-transparent text-5xl font-black text-on-surface placeholder:text-slate-300 focus:outline-none"
            />

            <p className="mb-3 mt-8 text-xs font-black uppercase tracking-[0.2em] text-on-surface">Description</p>
            <div className="rounded-xl border border-outline-variant bg-surface p-4">
              <div className="mb-3 flex items-center justify-between border-b border-outline-variant pb-3 text-slate-500">
                <div className="flex items-center gap-3">
                  <button type="button" className="rounded px-2 py-1 text-sm font-bold">B</button>
                  <button type="button" className="rounded px-2 py-1 text-sm italic">I</button>
                  <button type="button" className="rounded px-2 py-1 text-sm">
                    <Icon name="format_list_bulleted" className="text-[16px]" />
                  </button>
                  <button type="button" className="rounded px-2 py-1 text-sm">
                    <Icon name="link" className="text-[16px]" />
                  </button>
                </div>
                <button type="button">
                  <Icon name="code" className="text-[18px]" />
                </button>
              </div>
              <textarea
                rows={9}
                value={draft.description}
                onChange={(e) => setField('description', e.target.value)}
                placeholder="Describe the task, requirements, and acceptance criteria..."
                className="w-full resize-none border-none bg-transparent text-base text-on-surface-variant placeholder:text-slate-400 focus:outline-none"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-8">
            <p className="mb-4 text-xs font-black uppercase tracking-[0.2em] text-on-surface">Attachments</p>
            <label className="flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-outline-variant bg-surface p-6 text-center">
              <span className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-primary">
                <Icon name="cloud_upload" className="text-[26px]" />
              </span>
              <p className="text-2xl font-bold text-on-surface">
                Drop files here or <span className="text-primary">browse</span>
              </p>
              <p className="mt-2 text-sm text-on-surface-variant">
                Maximum file size: 50MB. Support for PDF, PNG, JPG, and ZIP.
              </p>
              <input
                type="file"
                multiple
                className="hidden"
                onChange={(e) => setAttachmentFiles(e.target.files)}
              />
            </label>
            {draft.attachments.length ? (
              <div className="mt-4 space-y-2">
                {draft.attachments.map((item) => (
                  <div key={`${item.fileName}-${item.size}`} className="flex items-center justify-between rounded-lg bg-slate-100 px-3 py-2 text-sm">
                    <span className="font-semibold text-on-surface">{item.fileName}</span>
                    <span className="text-on-surface-variant">{Math.round(item.size / 1024)} KB</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </section>

        <aside className="space-y-6">
          <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-6">
            <p className="mb-4 text-xs font-black uppercase tracking-[0.2em] text-on-surface">People</p>
            <label className="mb-2 block text-sm font-semibold text-on-surface-variant">Primary Assignee</label>
            <select
              value={draft.primaryAssigneeId}
              onChange={(e) => setField('primaryAssigneeId', e.target.value)}
              className="mb-4 w-full rounded-lg border border-outline-variant bg-white px-3 py-3 text-sm font-semibold"
            >
              {users.map((user) => (
                <option key={user._id} value={user._id}>
                  {user.displayName}
                </option>
              ))}
            </select>

            <label className="mb-2 block text-sm font-semibold text-on-surface-variant">Contributors</label>
            <div className="flex flex-wrap gap-2">
              {users.map((user) => {
                const active = draft.assigneeIds.includes(user._id);
                return (
                  <button
                    key={user._id}
                    type="button"
                    onClick={() => {
                      const next = active
                        ? draft.assigneeIds.filter((id) => id !== user._id)
                        : [...draft.assigneeIds, user._id];
                      setField('assigneeIds', next);
                    }}
                    className={`rounded-full px-3 py-2 text-xs font-bold ${active ? 'bg-primary text-white' : 'bg-slate-100 text-slate-700'}`}
                  >
                    {user.displayName}
                  </button>
                );
              })}
            </div>

            <label className="mb-2 mt-4 block text-sm font-semibold text-on-surface-variant">External Collaborators</label>
            <div className="space-y-3">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-on-surface-variant">Contacts</p>
                <div className="flex flex-wrap gap-2">
                  {(contacts || []).map((contact) => {
                    const active = (draft.externalCollaborators || []).some(
                      (item) => item.entityType === 'contact' && String(item.entityId) === String(contact._id),
                    );
                    return (
                      <button
                        key={`contact-${contact._id}`}
                        type="button"
                        onClick={() => {
                          const current = Array.isArray(draft.externalCollaborators) ? draft.externalCollaborators : [];
                          const next = active
                            ? current.filter((item) => !(item.entityType === 'contact' && String(item.entityId) === String(contact._id)))
                            : [...current, { entityType: 'contact', entityId: String(contact._id) }];
                          setField('externalCollaborators', next);
                        }}
                        className={`rounded-full px-3 py-2 text-xs font-bold ${active ? 'bg-primary text-white' : 'bg-slate-100 text-slate-700'}`}
                      >
                        {contact.name || 'Contact'}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-on-surface-variant">Employees</p>
                <div className="flex flex-wrap gap-2">
                  {(employees || []).map((employee) => {
                    const active = (draft.externalCollaborators || []).some(
                      (item) => item.entityType === 'employee' && String(item.entityId) === String(employee._id),
                    );
                    return (
                      <button
                        key={`employee-${employee._id}`}
                        type="button"
                        onClick={() => {
                          const current = Array.isArray(draft.externalCollaborators) ? draft.externalCollaborators : [];
                          const next = active
                            ? current.filter((item) => !(item.entityType === 'employee' && String(item.entityId) === String(employee._id)))
                            : [...current, { entityType: 'employee', entityId: String(employee._id) }];
                          setField('externalCollaborators', next);
                        }}
                        className={`rounded-full px-3 py-2 text-xs font-bold ${active ? 'bg-primary text-white' : 'bg-slate-100 text-slate-700'}`}
                      >
                        {employee.name || 'Employee'}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-6">
            <p className="mb-4 text-xs font-black uppercase tracking-[0.2em] text-on-surface">Timeline</p>
            <input
              type="date"
              value={draft.dueDate}
              onChange={(e) => setField('dueDate', e.target.value)}
              className="mb-6 w-full rounded-lg border border-outline-variant bg-white px-3 py-3 text-sm font-semibold"
            />

            <p className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-on-surface">Priority</p>
            <div className="grid grid-cols-2 gap-2">
              {['low', 'medium', 'high', 'critical'].map((priority) => (
                <button
                  key={priority}
                  type="button"
                  onClick={() => setField('priority', priority)}
                  className={`rounded-lg px-3 py-2 text-left text-sm font-bold capitalize ${chipClass(draft.priority === priority, priority)}`}
                >
                  {priority}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-6">
            <p className="mb-4 text-xs font-black uppercase tracking-[0.2em] text-on-surface">Project</p>
            <select
              value={draft.projectId}
              onChange={(e) => setField('projectId', e.target.value)}
              className="mb-6 w-full rounded-lg border border-outline-variant bg-white px-3 py-3 text-sm font-semibold"
            >
              {projects.map((project) => (
                <option key={project._id} value={project._id}>
                  {project.name}
                </option>
              ))}
            </select>

            <p className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-on-surface">Issue Type</p>
            <select
              value={draft.issueType}
              onChange={(e) => {
                const nextType = e.target.value;
                setField('issueType', nextType);
                if (nextType === 'epic') {
                  setField('parentTaskId', '');
                }
              }}
              className="mb-6 w-full rounded-lg border border-outline-variant bg-white px-3 py-3 text-sm font-semibold"
            >
              <option value="epic">Epic</option>
              <option value="task">Task</option>
              <option value="subtask">Subtask</option>
            </select>

            {draft.issueType !== 'epic' ? (
              <>
                <p className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-on-surface">Parent</p>
                <select
                  value={draft.parentTaskId}
                  onChange={(e) => setField('parentTaskId', e.target.value)}
                  className="mb-6 w-full rounded-lg border border-outline-variant bg-white px-3 py-3 text-sm font-semibold"
                >
                  <option value="">No parent</option>
                  {(parentTasks || [])
                    .filter((task) => {
                      if (String(task.projectId) !== String(draft.projectId)) return false;
                      const issueType = String(task.issueType || 'task');
                      if (draft.issueType === 'task') return issueType === 'epic';
                      return issueType === 'task';
                    })
                    .map((task) => (
                      <option key={task._id} value={task._id}>
                        {task.title}
                      </option>
                    ))}
                </select>
              </>
            ) : null}

            <p className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-on-surface">Tags</p>
            <div className="mb-3 flex flex-wrap gap-2">
              {draft.tags.map((tag) => (
                <button
                  type="button"
                  key={tag}
                  onClick={() => removeTag(tag)}
                  className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold uppercase text-blue-700"
                >
                  {tag} x
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={draft.tagsInput}
                onChange={(e) => setField('tagsInput', e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTag();
                  }
                }}
                placeholder="Add tag"
                className="flex-1 rounded-lg border border-outline-variant bg-white px-3 py-2 text-sm"
              />
              <button type="button" onClick={addTag} className="rounded-lg border border-outline-variant px-3 py-2 text-sm font-semibold">
                Add
              </button>
            </div>
          </div>

          {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-70"
          >
            {submitting ? 'Creating Task...' : 'Create Task'}
          </button>
        </aside>
      </form>
    </main>
  );
}


