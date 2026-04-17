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
import { useQueries } from '@tanstack/react-query';
import { sprintItemsQueryKey, useBacklog } from '../../hooks/useBacklog';
import { useSprints } from '../../hooks/useSprints';
import { useProjectRouteSync } from '../../hooks/useProjectRouteSync';
import { sprintsApi, tasksApi } from '../../api';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import ProjectTabs from './ProjectTabs';

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
      className={`grid min-h-[44px] grid-cols-[32px_12px_1fr_140px_120px_120px] items-center gap-2 px-4 py-2.5 ${isDragging ? 'opacity-60' : ''}`}
      {...attributes}
      {...listeners}
    >
      {showCheckbox ? (
        <input
          type="checkbox"
          checked={selected.has(String(task._id || task.id))}
          onChange={(event) => onToggle(task, event.target.checked)}
        />
      ) : (
        <span />
      )}
      <span className={`h-2.5 w-2.5 rounded-full ${priorityDotClass(task.priority)}`} />
      <button type="button" onClick={() => onOpen(task)} className="truncate text-left text-sm font-semibold text-on-surface hover:text-primary">
        <span className="mr-2 rounded bg-surface-container px-1.5 py-0.5 text-[10px] font-semibold uppercase text-on-surface-variant">
          {String(task.issueType || 'task')}
        </span>
        <span className={`${String(task.issueType || '') === 'subtask' ? 'ml-3' : ''}`}>{task.title}</span>
        {task.parentTaskId ? (
          <span className="ml-2 text-[11px] font-normal text-on-surface-variant">
            / {parentTitleMap.get(String(task.parentTaskId)) || 'Parent'}
          </span>
        ) : null}
      </button>
      <span className="truncate text-xs text-on-surface-variant">{task.assigneeName || 'Unassigned'}</span>
      <span className="text-xs text-on-surface-variant">{task.points || 0}</span>
      <span className="text-xs uppercase text-on-surface-variant">{task.priority || '-'}</span>
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

function SprintLane({ sprint, items, onOpenTask }) {
  return (
    <div className="rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-3">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-on-surface-variant">{sprint.status}</p>
          <h3 className="text-sm font-bold text-on-surface">{sprint.name}</h3>
        </div>
        <span className="rounded-full bg-surface-container px-2 py-0.5 text-[10px] font-semibold text-on-surface-variant">
          {(items || []).length}
        </span>
      </div>

      <DroppableContainer id={`sprint:${sprint._id}`} className="min-h-[120px] space-y-2 rounded-lg border border-dashed border-outline-variant/40 p-2">
        <SortableContext items={(items || []).map((task) => `task:${task._id || task.id}`)} strategy={verticalListSortingStrategy}>
          {(items || []).map((task) => (
            <SortableRow
              key={task._id || task.id}
              task={task}
              selected={new Set()}
              onToggle={() => {}}
              onOpen={onOpenTask}
              showCheckbox={false}
              containerId={`sprint:${sprint._id}`}
            />
          ))}
        </SortableContext>
        {!items?.length ? <p className="text-center text-xs text-on-surface-variant">Drop tasks here</p> : null}
      </DroppableContainer>
    </div>
  );
}

function BacklogPage() {
  const navigate = useNavigate();
  const projectId = useProjectRouteSync();
  const { workspaceId } = useWorkspace();
  const { items, loading, error, addToSprint, reorder } = useBacklog(projectId);
  const { sprints, refresh: refreshSprints } = useSprints(projectId);
  const [selected, setSelected] = useState(new Set());
  const [targetSprintId, setTargetSprintId] = useState('');
  const [search, setSearch] = useState('');
  const [issueTypeFilter, setIssueTypeFilter] = useState('all');
  const [epicFilter, setEpicFilter] = useState('all');
  const [completeModal, setCompleteModal] = useState({ open: false, sprint: null, incomplete: [], action: 'backlog', nextSprintId: '' });
  const [moveModal, setMoveModal] = useState({ open: false, sprintId: '' });
  const [isMoving, setIsMoving] = useState(false);
  const [moveError, setMoveError] = useState('');
  const [moveSuccess, setMoveSuccess] = useState('');

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

  const sprintItemQueries = useQueries({
    queries: planningSprints.map((sprint) => ({
      queryKey: sprintItemsQueryKey(workspaceId, sprint._id),
      queryFn: () => sprintsApi.items(workspaceId, sprint._id).then((response) => response.data || []),
      enabled: Boolean(workspaceId && sprint._id),
      staleTime: 30_000,
    })),
  });

  const sprintItemsMap = useMemo(() => {
    const map = new Map();
    planningSprints.forEach((sprint, idx) => {
      map.set(String(sprint._id), sprintItemQueries[idx]?.data || []);
    });
    return map;
  }, [planningSprints, sprintItemQueries]);

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
      setTargetSprintId(sprintId);
      setMoveModal({ open: false, sprintId: '' });
      setSelected(new Set());
    } catch (err) {
      setMoveError(err?.message || 'Failed to move tasks to sprint.');
    } finally {
      setIsMoving(false);
    }
  };

  const onMoveToSprint = async () => {
    if (!selectedIds.length) {
      setMoveError('Select at least one backlog task.');
      return;
    }
    if (!targetSprintId) {
      setMoveError('');
      setMoveModal({ open: true, sprintId: '' });
      return;
    }
    await runMoveToSprint(targetSprintId);
  };

  const onConfirmMoveFromModal = async () => {
    await runMoveToSprint(moveModal.sprintId);
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

  const openCompleteModal = async (sprint) => {
    const response = await sprintsApi.incompleteTasks(workspaceId, sprint._id);
    setCompleteModal({ open: true, sprint, incomplete: response.data || [], action: 'backlog', nextSprintId: '' });
  };

  const completeSprint = async () => {
    const { sprint, action, nextSprintId } = completeModal;
    await sprintsApi.complete(workspaceId, sprint._id, { incompleteTaskAction: action, nextSprintId: nextSprintId || undefined });
    setCompleteModal({ open: false, sprint: null, incomplete: [], action: 'backlog', nextSprintId: '' });
    refreshSprints();
  };

  const backlogIds = filteredItems.map((task) => `task:${task._id || task.id}`);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const findContainerForTask = (taskId) => {
    if (filteredItems.some((item) => String(item._id || item.id) === String(taskId))) return 'backlog';
    for (const [sprintId, list] of sprintItemsMap.entries()) {
      if ((list || []).some((item) => String(item._id || item.id) === String(taskId))) {
        return `sprint:${sprintId}`;
      }
    }
    return null;
  };

  const getContainerTasks = (containerId) => {
    if (containerId === 'backlog') return filteredItems;
    if (containerId?.startsWith('sprint:')) {
      const sprintId = containerId.split(':')[1];
      return sprintItemsMap.get(sprintId) || [];
    }
    return [];
  };

  const onDragEnd = async (event) => {
    const { active, over } = event;
    if (!over) return;
    const activeData = active.data?.current || {};
    if (activeData.type !== 'task') return;

    const taskId = activeData.taskId;
    const fromContainer = activeData.containerId || findContainerForTask(taskId);
    const overContainer = over.data?.current?.containerId || null;

    if (!fromContainer || !overContainer) return;

    const toContainer = overContainer;
    const overTaskId = String(over.id || '').startsWith('task:') ? String(over.id).replace('task:', '') : null;

    if (fromContainer === toContainer) {
      if (fromContainer === 'backlog') {
        const list = getContainerTasks(fromContainer);
        const oldIndex = list.findIndex((item) => String(item._id || item.id) === String(taskId));
        const newIndex = overTaskId
          ? list.findIndex((item) => String(item._id || item.id) === String(overTaskId))
          : list.length - 1;
        if (oldIndex >= 0 && newIndex >= 0 && oldIndex !== newIndex) {
          await reorder(taskId, newIndex);
        }
      } else if (fromContainer.startsWith('sprint:')) {
        const list = getContainerTasks(fromContainer);
        const ordered = list.map((task) => String(task._id || task.id));
        const oldIndex = ordered.indexOf(String(taskId));
        const newIndex = overTaskId ? ordered.indexOf(String(overTaskId)) : ordered.length - 1;
        if (oldIndex >= 0 && newIndex >= 0 && oldIndex !== newIndex) {
          const [moved] = ordered.splice(oldIndex, 1);
          ordered.splice(newIndex, 0, moved);
          const sprintId = fromContainer.split(':')[1];
          await sprintsApi.reorderItems(workspaceId, sprintId, ordered);
        }
      }
      return;
    }

    if (toContainer.startsWith('sprint:')) {
      const sprintId = toContainer.split(':')[1];
      const list = getContainerTasks(toContainer);
      const position = overTaskId
        ? list.findIndex((item) => String(item._id || item.id) === String(overTaskId))
        : list.length;
      await addToSprint(sprintId, [taskId], position, fromContainer?.startsWith('sprint:') ? fromContainer.split(':')[1] : 'backlog');
    } else if (toContainer === 'backlog' && fromContainer.startsWith('sprint:')) {
      await tasksApi.update(workspaceId, taskId, { sprintId: null });
    }
  };

  return (
    <main className="min-h-screen">
      <ProjectTabs projectId={projectId} />
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold text-on-surface">Backlog</h1>
          <div className="flex items-center gap-2">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search backlog"
              className="rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm"
            />
            <select
              value={issueTypeFilter}
              onChange={(event) => setIssueTypeFilter(event.target.value)}
              className="rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm"
            >
              <option value="all">All types</option>
              <option value="epic">Epic</option>
              <option value="task">Task</option>
              <option value="subtask">Subtask</option>
            </select>
            <select
              value={epicFilter}
              onChange={(event) => setEpicFilter(event.target.value)}
              className="rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm"
            >
              <option value="all">All epics</option>
              {epicOptions.map((epic) => (
                <option key={epic._id} value={epic._id}>
                  {epic.title}
                </option>
              ))}
            </select>
            <select
              value={targetSprintId}
              onChange={(event) => setTargetSprintId(event.target.value)}
              className="rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm"
            >
              <option value="">Assign Sprint</option>
              {planningSprints.map((sprint) => (
                <option key={sprint._id} value={sprint._id}>
                  {sprint.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={onMoveToSprint}
              disabled={isMoving || !selectedIds.length}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white"
            >
              {isMoving ? 'Moving...' : 'Move to Sprint'}
            </button>
          </div>
        </div>

        {loading ? <p className="text-sm text-on-surface-variant">Loading backlog...</p> : null}
        {error ? <p className="text-sm text-error">{error}</p> : null}
        {moveError ? <p className="text-sm text-error">{moveError}</p> : null}
        {moveSuccess ? <p className="text-sm text-emerald-600">{moveSuccess}</p> : null}

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.25fr_0.75fr]">
            <DroppableContainer id="backlog" className="overflow-hidden rounded-xl border border-outline-variant/10 bg-surface-container-lowest">
              <div className="grid grid-cols-[32px_12px_1fr_140px_120px_120px] gap-2 bg-surface-container-low/40 px-4 py-3 text-xs font-semibold uppercase text-on-surface-variant">
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
                    key={item._id}
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
                <div className="px-4 py-8 text-center text-sm text-on-surface-variant">No backlog items.</div>
              ) : null}
            </DroppableContainer>

            <div className="space-y-4">
              {planningSprints.map((sprint) => (
                <div key={sprint._id}>
                  <SprintLane
                    sprint={sprint}
                    items={sprintItemsMap.get(String(sprint._id)) || []}
                    onOpenTask={onOpenTask}
                  />
                  {String(sprint.status) === 'active' ? (
                    <button
                      type="button"
                      onClick={() => openCompleteModal(sprint)}
                      className="mt-2 w-full rounded-md border border-outline-variant px-3 py-2 text-xs font-semibold text-on-surface"
                    >
                      Complete Sprint
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </DndContext>
      </div>

      {completeModal.open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6">
            <h3 className="text-lg font-semibold text-on-surface">Complete {completeModal.sprint?.name}</h3>
            <p className="mt-2 text-sm text-on-surface-variant">
              {completeModal.incomplete.length} incomplete tasks found.
            </p>
            <div className="mt-4 space-y-2 text-xs text-on-surface-variant">
              {completeModal.incomplete.map((item) => (
                <div key={item._id} className="flex items-center justify-between rounded-md border border-outline-variant/10 px-2 py-1">
                  <span className="truncate">{item.title}</span>
                  <span className="uppercase">{item.status}</span>
                </div>
              ))}
              {!completeModal.incomplete.length ? <p className="text-xs">All tasks are complete.</p> : null}
            </div>
            <div className="mt-4">
              <select
                value={completeModal.action}
                onChange={(event) => setCompleteModal((current) => ({ ...current, action: event.target.value }))}
                className="w-full rounded-md border border-outline-variant px-3 py-2 text-sm"
              >
                <option value="backlog">Move incomplete tasks to backlog</option>
                <option value="move_to_sprint">Move incomplete tasks to another sprint</option>
              </select>
              {completeModal.action === 'move_to_sprint' ? (
                <select
                  value={completeModal.nextSprintId}
                  onChange={(event) => setCompleteModal((current) => ({ ...current, nextSprintId: event.target.value }))}
                  className="mt-2 w-full rounded-md border border-outline-variant px-3 py-2 text-sm"
                >
                  <option value="">Select next sprint</option>
                  {planningSprints.filter((item) => String(item._id) !== String(completeModal.sprint?._id)).map((sprint) => (
                    <option key={sprint._id} value={sprint._id}>{sprint.name}</option>
                  ))}
                </select>
              ) : null}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCompleteModal({ open: false, sprint: null, incomplete: [], action: 'backlog', nextSprintId: '' })}
                className="rounded-md border border-outline-variant px-3 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={completeSprint}
                className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white"
              >
                Complete Sprint
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {moveModal.open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6">
            <h3 className="text-lg font-semibold text-on-surface">Choose Sprint</h3>
            <p className="mt-2 text-sm text-on-surface-variant">
              Select target sprint for {selectedIds.length} selected task{selectedIds.length === 1 ? '' : 's'}.
            </p>
            <select
              value={moveModal.sprintId}
              onChange={(event) => setMoveModal((current) => ({ ...current, sprintId: event.target.value }))}
              className="mt-4 w-full rounded-md border border-outline-variant px-3 py-2 text-sm"
            >
              <option value="">Select sprint</option>
              {planningSprints.map((sprint) => (
                <option key={sprint._id} value={sprint._id}>
                  {sprint.name} ({sprint.status})
                </option>
              ))}
            </select>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setMoveModal({ open: false, sprintId: '' })}
                className="rounded-md border border-outline-variant px-3 py-2 text-sm"
                disabled={isMoving}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirmMoveFromModal}
                className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white"
                disabled={isMoving || !moveModal.sprintId}
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
