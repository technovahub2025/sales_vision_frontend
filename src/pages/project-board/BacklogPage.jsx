import { useMemo, useState } from 'react';
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useNavigate } from 'react-router-dom';
import { useBacklog } from '../../hooks/useBacklog';
import { useSprints } from '../../hooks/useSprints';
import { useProjectRouteSync } from '../../hooks/useProjectRouteSync';
import ProjectTabs from './ProjectTabs';
import SelectDropdown from '../../components/ui/SelectDropdown';

function priorityDotClass(priority) {
  switch (String(priority || '').toLowerCase()) {
    case 'critical':
      return 'bg-red-600';
    case 'high':
      return 'bg-orange-500';
    case 'medium':
      return 'bg-blue-500';
    default:
      return 'bg-slate-400';
  }
}

function SortableRow({ task, rowStyle, selected, onToggle, onOpen, showCheckbox, containerId, parentTitleMap = new Map() }) {
  const taskId = String(task._id || task.id);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `task:${taskId}`,
    data: { type: 'task', taskId, containerId },
  });

  const baseTransform = rowStyle?.transform || '';
  const dragTransform = CSS.Transform.toString(transform);
  const style = {
    ...rowStyle,
    transform: [baseTransform, dragTransform].filter(Boolean).join(' '),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`sv-backlog-row grid min-h-[44px] grid-cols-[32px_12px_1fr_140px_120px_120px] items-center gap-2 px-4 py-2.5 ${isDragging ? 'opacity-60' : ''} ${selected.has(taskId) ? 'is-selected' : ''}`}
      {...attributes}
      {...listeners}
    >
      {showCheckbox ? (
        <input
          className="sv-backlog-checkbox"
          type="checkbox"
          checked={selected.has(String(task._id || task.id))}
          onChange={(event) => onToggle(task, event.target.checked)}
        />
      ) : (
        <span />
      )}
      <span className={`h-2.5 w-2.5 rounded-full ${priorityDotClass(task.priority)}`} />
      <button type="button" onClick={() => onOpen(task)} className="sv-backlog-title-btn text-left">
        <div className="sv-backlog-title-stack">
          <div className="sv-backlog-title-meta">
            <span className="sv-backlog-type-chip rounded bg-surface-container px-1.5 py-0.5 text-[10px] font-semibold uppercase text-on-surface-variant">
              {String(task.issueType || 'task')}
            </span>
            {task.parentTaskId ? (
              <span className="sv-backlog-parent-chip text-[11px] font-medium text-on-surface-variant">
                Parent: {parentTitleMap.get(String(task.parentTaskId)) || 'Parent'}
              </span>
            ) : null}
          </div>
          <span className="sv-backlog-title-text truncate text-sm font-semibold text-on-surface hover:text-primary">
            {task.title}
          </span>
        </div>
      </button>
      <span className="sv-backlog-assignee truncate text-xs text-on-surface-variant" data-label="Assignee">
        {task.assigneeName || 'Unassigned'}
      </span>
      <span className="sv-backlog-points text-xs text-on-surface-variant" data-label="Story Points">
        {task.points || 0}
      </span>
      <span className="sv-backlog-priority text-xs uppercase text-on-surface-variant" data-label="Priority">
        {task.priority || '-'}
      </span>
    </div>
  );
}

function DroppableContainer({ id, children, className }) {
  const { setNodeRef, isOver } = useDroppable({ id, data: { containerId: id } });
  return (
    <div ref={setNodeRef} className={`${className} ${isOver ? 'ring-2 ring-primary/40' : ''}`}>
      {children}
    </div>
  );
}

function BacklogPage() {
  const navigate = useNavigate();
  const projectId = useProjectRouteSync();
  const { items, loading, error, addToSprint, reorder } = useBacklog(projectId);
  const { sprints } = useSprints(projectId);

  const [selected, setSelected] = useState(new Set());
  const [search, setSearch] = useState('');
  const [issueTypeFilter, setIssueTypeFilter] = useState('all');
  const [epicFilter, setEpicFilter] = useState('all');
  const [moveModal, setMoveModal] = useState({ open: false, sprintId: '' });
  const [isMoving, setIsMoving] = useState(false);
  const [moveError, setMoveError] = useState('');
  const [moveSuccess, setMoveSuccess] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (items || []).filter((item) => {
      if (issueTypeFilter !== 'all' && String(item.issueType || 'task') !== issueTypeFilter) return false;
      if (epicFilter !== 'all') {
        if (String(item.issueType || '') === 'epic') return String(item._id) === epicFilter;
        if (!item.parentTaskId || String(item.parentTaskId) !== epicFilter) return false;
      }
      if (!query) return true;
      return String(item.title || '').toLowerCase().includes(query);
    });
  }, [items, search, issueTypeFilter, epicFilter]);

  const epicOptions = useMemo(
    () => (items || []).filter((item) => String(item.issueType || 'task') === 'epic'),
    [items],
  );
  const parentTitleMap = useMemo(
    () => new Map((items || []).map((item) => [String(item._id || item.id), String(item.title || '')])),
    [items],
  );

  const selectedIds = useMemo(() => Array.from(selected), [selected]);
  const planningSprints = useMemo(() => (sprints || []).filter((sprint) => ['planning', 'active'].includes(String(sprint.status))), [sprints]);
  const backlogCount = filteredItems.length;
  const activeFilterCount = Number(issueTypeFilter !== 'all') + Number(epicFilter !== 'all');
  const totalBacklogItems = (items || []).length;
  const hasActiveFilters = Boolean(search.trim()) || activeFilterCount > 0;

  const backlogIds = filteredItems.map((task) => `task:${task._id || task.id}`);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const runMoveToSprint = async (sprintId) => {
    if (!selectedIds.length) {
      setMoveError('Select at least one backlog task.');
      return;
    }
    if (!sprintId) {
      setMoveError('Choose a sprint to move selected tasks.');
      return;
    }
    setMoveError('');
    setMoveSuccess('');
    setIsMoving(true);
    try {
      const result = await addToSprint(sprintId, selectedIds, undefined, 'backlog');
      const updatedCount = Number(result?.updated || selectedIds.length || 0);
      setMoveSuccess(`${updatedCount} task${updatedCount === 1 ? '' : 's'} moved to sprint.`);
      setMoveModal({ open: false, sprintId: '' });
      setSelected(new Set());
    } catch (err) {
      setMoveError(err?.message || 'Failed to move tasks to sprint.');
    } finally {
      setIsMoving(false);
    }
  };

  const onMoveToSprint = () => {
    if (!selectedIds.length) {
      setMoveError('Select at least one backlog task.');
      return;
    }
    setMoveError('');
    setMoveModal({ open: true, sprintId: '' });
  };

  const clearFilters = () => {
    setSearch('');
    setIssueTypeFilter('all');
    setEpicFilter('all');
    setShowFilters(false);
  };

  const toggleSelected = (task, enabled) => {
    setSelected((current) => {
      const next = new Set(current);
      const id = String(task._id || task.id);
      if (enabled) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const onOpenTask = (task) => navigate(`/tasks/${task._id || task.id}`);

  const onDragEnd = async (event) => {
    const { active, over } = event;
    if (!over) return;
    const activeData = active.data?.current || {};
    if (activeData.type !== 'task') return;

    const taskId = activeData.taskId;
    const fromContainer = activeData.containerId || 'backlog';
    const overContainer = over.data?.current?.containerId || null;

    if (fromContainer !== 'backlog' || overContainer !== 'backlog') return;

    const overTaskId = String(over.id || '').startsWith('task:') ? String(over.id).replace('task:', '') : null;
    const list = filteredItems;
    const oldIndex = list.findIndex((item) => String(item._id || item.id) === String(taskId));
    const newIndex = overTaskId
      ? list.findIndex((item) => String(item._id || item.id) === String(overTaskId))
      : list.length - 1;

    if (oldIndex >= 0 && newIndex >= 0 && oldIndex !== newIndex) {
      await reorder(taskId, newIndex);
    }
  };

  return (
    <main className="sv-backlog-page">
      <ProjectTabs projectId={projectId} />
      <div className="sv-backlog-stack">
        <div className="sv-card sv-backlog-toolbar">
          <div className="sv-backlog-toolbar-head">
            <div className="sv-backlog-toolbar-copy">
              <p className="sv-backlog-eyebrow">Planning workspace</p>
              <h1 className="sv-backlog-title text-2xl font-semibold text-on-surface">Backlog</h1>
              <p className="sv-backlog-subtitle text-sm text-on-surface-variant">
                Intake, refine, and reorder work before it moves into execution.
              </p>
            </div>
            <div className="sv-backlog-summary-row">
              <div className="sv-backlog-summary-chip">
                <strong>{totalBacklogItems}</strong>
                <span>Backlog items</span>
              </div>
              <div className="sv-backlog-summary-chip">
                <strong>{selectedIds.length}</strong>
                <span>Selected</span>
              </div>
              <div className="sv-backlog-summary-chip">
                <strong>{backlogCount}</strong>
                <span>Visible</span>
              </div>
            </div>
          </div>

          <div className="sv-backlog-toolbar-controls">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search backlog"
              className="form-control sv-ctl-input sv-backlog-search"
            />
            <button
              type="button"
              onClick={() => setShowFilters((current) => !current)}
              className={`btn sv-ctl-btn sv-backlog-filter-toggle ${showFilters ? 'btn-primary is-active' : 'btn-light'}`}
            >
              Filters
              {activeFilterCount ? <span className="sv-backlog-filter-badge">{activeFilterCount}</span> : null}
            </button>
            <button
              type="button"
              onClick={onMoveToSprint}
              disabled={isMoving || !selectedIds.length || !planningSprints.length}
              className="btn btn-primary sv-ctl-btn sv-backlog-move-btn"
            >
              {isMoving ? 'Moving...' : 'Move to Sprint'}
            </button>
          </div>

          {showFilters ? (
            <div className="sv-backlog-filter-panel">
              <SelectDropdown
                value={issueTypeFilter}
                onChange={setIssueTypeFilter}
                options={[
                  { value: 'all', label: 'All types' },
                  { value: 'epic', label: 'Epic' },
                  { value: 'task', label: 'Task' },
                  { value: 'subtask', label: 'Subtask' },
                ]}
                className="sv-backlog-filter"
              />
              <SelectDropdown
                value={epicFilter}
                onChange={setEpicFilter}
                options={[
                  { value: 'all', label: 'All epics' },
                  ...epicOptions.map((epic) => ({ value: epic._id, label: epic.title })),
                ]}
                className="sv-backlog-filter"
              />
              {activeFilterCount ? (
                <div className="sv-backlog-filter-state">
                  <span className="sv-backlog-filter-state-label">Active filters</span>
                  <span className="sv-backlog-filter-state-value">{activeFilterCount} applied</span>
                </div>
              ) : (
                <div className="sv-backlog-filter-state is-empty">
                  <span className="sv-backlog-filter-state-label">No filters applied</span>
                  <span className="sv-backlog-filter-state-value">Showing all backlog items</span>
                </div>
              )}
            </div>
          ) : null}

          <div className="sv-backlog-hint-row">
            <div className="sv-backlog-hint-chip">
              <span className="material-symbols-outlined">drag_indicator</span>
              <span>Drag rows to reorder</span>
            </div>
            <div className="sv-backlog-hint-chip">
              <span className="material-symbols-outlined">check_box_outline_blank</span>
              <span>Use checkboxes for bulk move</span>
            </div>
          </div>
        </div>

        {loading ? <p className="sv-backlog-message text-sm text-on-surface-variant">Loading backlog items...</p> : null}
        {error ? <p className="sv-backlog-message is-error text-sm text-error">{error}</p> : null}
        {moveError ? <p className="sv-backlog-message is-error text-sm text-error">{moveError}</p> : null}
        {moveSuccess ? <p className="sv-backlog-message is-success text-sm text-emerald-600">{moveSuccess}</p> : null}

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <div className="sv-backlog-layout">
            <DroppableContainer id="backlog" className="sv-card sv-backlog-table overflow-hidden">
              <div className="sv-backlog-table-head grid grid-cols-[32px_12px_1fr_140px_120px_120px] gap-2 bg-surface-container-low/40 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant">
                <span>Select</span>
                <span />
                <span>Title</span>
                <span>Assignee</span>
                <span>Story Points</span>
                <span>Priority</span>
              </div>
              <SortableContext items={backlogIds} strategy={verticalListSortingStrategy}>
                {filteredItems.map((item) => (
                  <SortableRow
                    key={item._id || item.id}
                    task={item}
                    selected={selected}
                    onToggle={toggleSelected}
                    onOpen={onOpenTask}
                    showCheckbox
                    containerId="backlog"
                    parentTitleMap={parentTitleMap}
                  />
                ))}
              </SortableContext>
              {!filteredItems.length ? (
                <div className="sv-backlog-empty px-4 py-10 text-center text-sm text-on-surface-variant">
                  <div className="sv-backlog-empty-icon">
                    <span className="material-symbols-outlined">inventory_2</span>
                  </div>
                  <p className="sv-backlog-empty-title">No backlog items</p>
                  <p className="sv-backlog-empty-text">
                    {hasActiveFilters
                      ? 'Try clearing the search or filters to see all items.'
                      : 'Work items will appear here when they are added to the project.'}
                  </p>
                  {hasActiveFilters ? (
                    <button type="button" onClick={clearFilters} className="btn btn-light sv-ctl-btn sv-backlog-empty-action">
                      Clear filters
                    </button>
                  ) : null}
                </div>
              ) : null}
            </DroppableContainer>
          </div>
        </DndContext>
      </div>

      {moveModal.open ? (
        <div className="sv-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="sv-card sv-backlog-modal w-full max-w-md">
            <div className="sv-backlog-modal-head">
              <div>
                <p className="sv-backlog-modal-eyebrow">Bulk move</p>
                <h3 className="sv-backlog-modal-title text-lg font-semibold text-on-surface">Choose Sprint</h3>
                <p className="sv-backlog-modal-subtitle mt-2 text-sm text-on-surface-variant">
                  Select target sprint for {selectedIds.length} selected task{selectedIds.length === 1 ? '' : 's'}.
                </p>
              </div>
            </div>
            {planningSprints.length ? (
              <SelectDropdown
                value={moveModal.sprintId}
                onChange={(nextValue) => setMoveModal((current) => ({ ...current, sprintId: nextValue }))}
                options={[
                  { value: '', label: 'Select sprint' },
                  ...planningSprints.map((sprint) => ({ value: sprint._id, label: `${sprint.name} (${sprint.status})` })),
                ]}
                className="mt-4 w-full"
              />
            ) : (
              <div className="sv-backlog-modal-empty mt-4 rounded-md border border-dashed border-outline-variant/40 px-3 py-4 text-sm text-on-surface-variant">
                No planning or active sprints are available. Open the Sprints page to create one first.
              </div>
            )}
            <div className="sv-backlog-modal-actions mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setMoveModal({ open: false, sprintId: '' })}
                className="btn btn-light sv-ctl-btn"
                disabled={isMoving}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => runMoveToSprint(moveModal.sprintId)}
                className="btn btn-primary sv-ctl-btn"
                disabled={isMoving || !moveModal.sprintId || !planningSprints.length}
              >
                {isMoving ? 'Moving...' : 'Move'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

export default BacklogPage;
