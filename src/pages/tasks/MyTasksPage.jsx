import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useNavigate } from 'react-router-dom';
import { tasksApi } from '../../api';
import { useMyTasks } from '../../hooks/useMyTasks';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useAuth } from '../../contexts/AuthContext';
import Icon from '../../components/ui/Icon';

const GROUP_MODES = [
  { value: 'dueDate', label: 'Due Date' },
  { value: 'status', label: 'Status' },
  { value: 'priority', label: 'Priority' },
  { value: 'project', label: 'Project' },
];

const STATUS_OPTIONS = ['todo', 'in_progress', 'in_review', 'completed'];
const PRIORITY_OPTIONS = ['critical', 'high', 'medium', 'low'];
const KANBAN_COLUMN_PREFIX = 'kanban-column-';
const DEFAULT_VISIBLE_COLUMNS = ['priority', 'title', 'project', 'priorityDropdown', 'dueDate', 'status', 'timer', 'open'];
const ALLOWED_VISIBLE_COLUMNS = new Set(['checkbox', ...DEFAULT_VISIBLE_COLUMNS]);

function sanitizeVisibleColumns(columns) {
  const list = Array.isArray(columns) ? columns : [];
  const filtered = list.filter((key) => ALLOWED_VISIBLE_COLUMNS.has(String(key)));
  return filtered.length ? filtered : DEFAULT_VISIBLE_COLUMNS;
}

function isRenderableKanbanTask(task) {
  if (!task || !task._id) return false;
  return String(task.title || '').trim().length > 0;
}

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

function statusClass(status) {
  switch (String(status || '').toLowerCase()) {
    case 'completed':
      return 'bg-emerald-100 text-emerald-700';
    case 'in_progress':
      return 'bg-blue-100 text-blue-700';
    case 'in_review':
      return 'bg-amber-100 text-amber-700';
    default:
      return 'bg-slate-100 text-slate-700';
  }
}

function toDateInputValue(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDuration(totalSeconds) {
  const safe = Math.max(0, Number(totalSeconds || 0));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function extractDurationSeconds(log) {
  if (!log) return 0;
  if (Number.isFinite(Number(log.durationSecs))) return Math.max(0, Number(log.durationSecs));
  if (Number.isFinite(Number(log.durationSeconds))) return Math.max(0, Number(log.durationSeconds));
  if (Number.isFinite(Number(log.elapsedSeconds))) return Math.max(0, Number(log.elapsedSeconds));
  if (Number.isFinite(Number(log.durationMins))) return Math.max(0, Math.round(Number(log.durationMins) * 60));
  if (log.startTime && log.endTime) {
    const startMs = new Date(log.startTime).getTime();
    const endMs = new Date(log.endTime).getTime();
    if (!Number.isNaN(startMs) && !Number.isNaN(endMs) && endMs > startMs) {
      return Math.max(0, Math.floor((endMs - startMs) / 1000));
    }
  }
  return 0;
}

function SortableTaskRow({
  task,
  rowStyle,
  focusedTaskId,
  onFocusTask,
  selected,
  onToggleSelected,
  onInlinePatch,
  onTimerToggle,
  onTimerStop,
  isTimerActive,
  isTimerPaused,
  timerElapsedSeconds,
  timerState,
  onOpenTask,
  onUnarchiveTask,
  visibleColumns,
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: String(task._id) });

  const baseTransform = rowStyle?.transform || '';
  const dragTransform = CSS.Transform.toString(transform);
  const style = {
    ...rowStyle,
    transform: [baseTransform, dragTransform].filter(Boolean).join(' '),
    transition,
  };

  const isFocused = String(focusedTaskId) === String(task._id);
  const isSelected = selected.has(String(task._id));
  const rowGridTemplate = useMemo(() => {
    const cols = [];
    if (visibleColumns.has('checkbox')) cols.push('22px');
    if (visibleColumns.has('priority')) cols.push('12px');
    if (visibleColumns.has('title')) cols.push('minmax(220px, 1fr)');
    if (visibleColumns.has('project')) cols.push('106px');
    if (visibleColumns.has('priorityDropdown')) cols.push('96px');
    if (visibleColumns.has('dueDate')) cols.push('118px');
    if (visibleColumns.has('status')) cols.push('118px');
    if (visibleColumns.has('timer')) cols.push('168px');
    if (visibleColumns.has('open')) cols.push('92px');
    return cols.length ? cols.join(' ') : '1fr';
  }, [visibleColumns]);

  const issueType = String(task.issueType || 'task');
  const titlePadClass = issueType === 'subtask' ? 'pl-6' : issueType === 'task' && task.parentTaskId ? 'pl-3' : '';

  return (
    <article
      ref={setNodeRef}
      className={`group sv-task-row d-grid align-items-center gap-1 px-2 px-lg-3 py-2 rounded-3 border transition-all ${
        isFocused ? 'sv-task-row-focused' : ''
      } ${isDragging ? 'opacity-75' : ''}`}
      data-checkbox-enabled={visibleColumns.has('checkbox') ? 'true' : 'false'}
      data-priority-enabled={visibleColumns.has('priority') ? 'true' : 'false'}
      data-project-enabled={visibleColumns.has('project') ? 'true' : 'false'}
      data-open-enabled={visibleColumns.has('open') ? 'true' : 'false'}
      style={{ ...style, gridTemplateColumns: rowGridTemplate }}
      onClick={() => onFocusTask(task._id)}
      tabIndex={0}
    >
      {visibleColumns.has('checkbox') && (
        <input
          type="checkbox"
          className="form-check-input mt-0 sv-task-checkbox"
          checked={isSelected}
          onChange={(event) => {
            event.stopPropagation();
            onToggleSelected(task._id);
          }}
        />
      )}

      {visibleColumns.has('priority') && (
        <span className={`h-2.5 w-2.5 rounded-full ${priorityDotClass(task.priority)} shadow-sm`} />
      )}

      {visibleColumns.has('title') && (
        <div className={`flex items-center gap-2 ${titlePadClass}`}>
          <span className="rounded-lg bg-gradient-to-r from-surface-container to-surface-container-low px-2 py-0.5 text-[10px] font-semibold uppercase text-on-surface-variant shadow-sm">
            {issueType}
          </span>
          {task?.archived ? (
            <span className="rounded-lg bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-700">
              archived
            </span>
          ) : null}
          <span className="max-w-[200px] truncate text-sm font-semibold text-on-surface">
            {task.title}
          </span>
        </div>
      )}

      {visibleColumns.has('project') && (
        <p className="mb-0 truncate rounded-full bg-surface-container-low/80 px-2.5 py-1 text-sm font-semibold text-on-surface-variant backdrop-blur-sm border border-outline-variant/10 self-center text-center sv-task-project-pill">
          {task.projectName || '-'}
        </p>
      )}

      {visibleColumns.has('priorityDropdown') && (
        <select
          value={task.priority || 'medium'}
          className="rounded-lg border border-outline-variant/30 bg-surface-container-lowest/80 px-1.5 py-0.5 text-xs font-semibold text-on-surface backdrop-blur-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all self-center sv-task-mini-control"
          onChange={(event) => onInlinePatch(task._id, { priority: event.target.value })}
          onClick={(event) => event.stopPropagation()}
        >
          {PRIORITY_OPTIONS.map((value) => (
            <option key={value} value={value}>{value}</option>
          ))}
        </select>
      )}

      {visibleColumns.has('dueDate') && (
        <input
          type="date"
          defaultValue={toDateInputValue(task.dueDate)}
          className="rounded-lg border border-outline-variant/30 bg-surface-container-lowest/80 px-1.5 py-0.5 text-xs font-semibold text-on-surface backdrop-blur-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all self-center sv-task-date sv-task-mini-control"
          onClick={(event) => event.stopPropagation()}
          onBlur={(event) => onInlinePatch(task._id, { dueDate: event.target.value || null })}
        />
      )}

      {visibleColumns.has('status') && (
        <select
          value={task.status || 'todo'}
          className={`rounded-lg border border-outline-variant/30 backdrop-blur-sm outline-none focus:ring-2 transition-all w-full px-1.5 py-0.5 text-xs font-semibold self-center sv-task-mini-control ${
            task.status === 'completed'
              ? 'bg-emerald-100 text-emerald-700 border-emerald-200 focus:border-emerald-400 focus:ring-emerald-200'
              : task.status === 'in_progress'
              ? 'bg-blue-100 text-blue-700 border-blue-200 focus:border-blue-400 focus:ring-blue-200'
              : task.status === 'in_review'
              ? 'bg-amber-100 text-amber-700 border-amber-200 focus:border-amber-400 focus:ring-amber-200'
              : 'bg-surface-container-lowest/80 text-on-surface focus:border-primary/50 focus:ring-primary/20'
          }`}
          onChange={(event) => onInlinePatch(task._id, { status: event.target.value })}
          onClick={(event) => event.stopPropagation()}
        >
          {STATUS_OPTIONS.map((value) => (
            <option key={value} value={value}>{value.replace('_', ' ')}</option>
          ))}
        </select>
      )}

      {visibleColumns.has('timer') && (
        <div className="flex items-center gap-1 justify-self-end sv-task-timer-cell">
          {Number(timerElapsedSeconds || 0) > 0 ? (
            <span className="rounded-lg bg-slate-100 px-1.5 py-0.25 text-xs font-semibold text-slate-700">
              {formatDuration(timerElapsedSeconds)}
            </span>
          ) : null}
          <button
            type="button"
            disabled={timerState.starting || timerState.pausing || timerState.resuming}
            className={`sv-task-action-btn sv-task-icon-btn inline-flex items-center gap-1 rounded-lg px-1.5 py-0.25 text-xs font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
              isTimerActive
                ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                : isTimerPaused
                ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                : 'bg-primary/10 text-primary hover:bg-primary/20'
            }`}
            onClick={(event) => {
              event.stopPropagation();
              onTimerToggle(task);
            }}
          >
            <Icon name={isTimerActive ? 'pause' : isTimerPaused ? 'play_arrow' : 'play_arrow'} className="sv-row-icon" />
          </button>
          {(isTimerActive || isTimerPaused) && (
            <button
              type="button"
              disabled={timerState.stopping}
              className="sv-task-action-btn sv-task-icon-btn inline-flex items-center gap-1 rounded-lg px-1.5 py-0.25 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={(event) => {
                event.stopPropagation();
                onTimerStop(task);
              }}
            >
              <Icon name="stop" className="sv-row-icon" />
            </button>
          )}
        </div>
      )}

      {visibleColumns.has('open') && (
        <div className="flex items-center gap-1 min-w-[74px] justify-end self-center justify-self-end pe-1 sv-open-cell">
          {task?.archived ? (
            <button
              type="button"
              className="sv-task-action-btn inline-flex items-center gap-1 rounded-lg px-1.5 py-0.25 text-xs font-semibold text-green-700 transition-all hover:bg-green-50"
              onClick={(event) => {
                event.stopPropagation();
                onUnarchiveTask(task);
              }}
            >
              <Icon name="unarchive" className="sv-row-icon" />
              Unarchive
            </button>
          ) : null}
          <button
            type="button"
            className="sv-task-action-btn inline-flex items-center gap-1 rounded-lg px-1.5 py-0.25 text-xs font-semibold text-on-surface-variant transition-all hover:bg-surface-container-low hover:text-primary"
            onClick={(event) => {
              event.stopPropagation();
              onOpenTask(task);
            }}
          >
            <Icon name="open_in_new" className="sv-row-icon" />
            Open
          </button>
        </div>
      )}
    </article>
  );
}

function TaskCard({
  task,
  selected,
  onToggleSelected,
  onInlinePatch,
  onTimerToggle,
  onTimerStop,
  isTimerActive,
  isTimerPaused,
  timerElapsedSeconds,
  timerState,
  onOpenTask,
  onUnarchiveTask,
}) {
  const isSelected = selected.has(String(task._id));

  return (
    <article
      className={`sv-card sv-task-card group overflow-hidden ${isSelected ? 'sv-task-card-selected' : ''}`}
    >
      <div className="sv-task-card-top">
        <div className="sv-task-card-type-wrap">
          <span className={`h-1.5 w-1.5 rounded-full ${priorityDotClass(task.priority)} shadow-sm flex-shrink-0`} />
          <span className="sv-task-card-type-chip">
            {task.issueType || 'task'}
          </span>
          {task?.archived ? (
            <span className="sv-task-card-archived-chip">Archived</span>
          ) : null}
        </div>
        <div className="sv-task-card-actions">
          {Number(timerElapsedSeconds || 0) > 0 ? (
            <span className="sv-task-card-timer">
              {formatDuration(timerElapsedSeconds)}
            </span>
          ) : null}
          <button
            type="button"
            disabled={timerState?.starting || timerState?.pausing || timerState?.resuming}
            onClick={() => onTimerToggle(task)}
            className={`sv-task-action-btn sv-task-icon-btn inline-flex items-center justify-content-center transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
              isTimerActive
                ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                : isTimerPaused
                ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                : 'bg-primary/10 text-primary hover:bg-primary/20'
            }`}
          >
            <Icon name={isTimerActive ? 'pause' : isTimerPaused ? 'play_arrow' : 'play_arrow'} className="sv-row-icon" />
          </button>
          {(isTimerActive || isTimerPaused) && (
            <button
              type="button"
              disabled={timerState?.stopping}
              onClick={() => onTimerStop(task)}
              className="sv-task-action-btn sv-task-icon-btn inline-flex items-center justify-content-center text-red-600 bg-red-50 hover:bg-red-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Icon name="stop" className="sv-row-icon" />
            </button>
          )}
          <button
            type="button"
            onClick={() => onOpenTask(task)}
            className="sv-task-action-btn sv-task-icon-btn inline-flex items-center justify-content-center text-on-surface-variant transition-all hover:bg-surface-container-low hover:text-primary"
            title="Open"
          >
            <Icon name="open_in_new" className="sv-row-icon" />
          </button>
          {task?.archived ? (
            <button
              type="button"
              onClick={() => onUnarchiveTask(task)}
              className="sv-task-action-btn sv-task-icon-btn inline-flex items-center justify-content-center text-green-700 transition-all hover:bg-green-50"
              title="Unarchive"
            >
              <Icon name="unarchive" className="sv-row-icon" />
            </button>
          ) : null}
        </div>
      </div>

      <h3 className="sv-task-card-title">{task.title}</h3>

      <div className="sv-task-card-bottom">
        <div className="sv-task-card-tags">
          <span className={`inline-flex rounded-full px-2 py-0.25 text-xs font-bold uppercase border border-outline-variant/10 ${statusClass(task.status)}`}>
            {String(task.status || 'todo').replace('_', ' ')}
          </span>
          {task.projectName && (
            <span className="sv-task-project-pill">
              {task.projectName}
            </span>
          )}
        </div>

        <div className="sv-task-card-controls">
          <select
            value={task.priority || 'medium'}
            onChange={(event) => onInlinePatch(task._id, { priority: event.target.value })}
            className="sv-task-mini-control sv-task-card-control rounded-lg border border-outline-variant/30 bg-surface-container-lowest/80 px-1.5 py-0.5 text-xs font-semibold text-on-surface backdrop-blur-sm outline-none focus:border-primary/50"
          >
            {PRIORITY_OPTIONS.map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
          <input
            type="date"
            defaultValue={toDateInputValue(task.dueDate)}
            onBlur={(event) => onInlinePatch(task._id, { dueDate: event.target.value || null })}
            className="sv-task-mini-control sv-task-card-control sv-task-date rounded-lg border border-outline-variant/30 bg-surface-container-lowest/80 px-1.5 py-0.5 text-xs font-semibold text-on-surface backdrop-blur-sm outline-none focus:border-primary/50"
          />
          <select
            value={task.status || 'todo'}
            onChange={(event) => onInlinePatch(task._id, { status: event.target.value })}
            className={`sv-task-mini-control sv-task-card-control rounded-lg border border-outline-variant/30 backdrop-blur-sm outline-none focus:ring-2 transition-all px-1.5 py-0.5 text-xs font-semibold ${
              task.status === 'completed'
                ? 'bg-green-100 text-green-700 border-green-200 focus:ring-green-200'
                : task.status === 'in_progress'
                ? 'bg-blue-100 text-blue-700 border-blue-200 focus:ring-blue-200'
                : task.status === 'in_review'
                ? 'bg-amber-100 text-amber-700 border-amber-200 focus:ring-amber-200'
                : 'bg-slate-100 text-slate-700 border-slate-200 focus:ring-slate-200'
            }`}
          >
            {STATUS_OPTIONS.map((value) => (
              <option key={value} value={value}>{value.replace('_', ' ')}</option>
            ))}
          </select>
        </div>
      </div>
    </article>
  );
}

function SortableKanbanTaskCard({
  status,
  task,
  selected,
  onToggleSelected,
  onInlinePatch,
  onTimerToggle,
  onTimerStop,
  isTimerActive,
  isTimerPaused,
  timerElapsedSeconds,
  timerState,
  onOpenTask,
  onUnarchiveTask,
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: String(task._id),
    data: { type: 'task', status },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`sv-task-card-sortable ${isDragging ? 'sv-task-card-dragging' : ''}`}
    >
      <TaskCard
        task={task}
        selected={selected}
        onToggleSelected={onToggleSelected}
        onInlinePatch={onInlinePatch}
        onTimerToggle={onTimerToggle}
        onTimerStop={onTimerStop}
        isTimerActive={isTimerActive}
        isTimerPaused={isTimerPaused}
        timerElapsedSeconds={timerElapsedSeconds}
        timerState={timerState}
        onOpenTask={onOpenTask}
        onUnarchiveTask={onUnarchiveTask}
      />
    </div>
  );
}

function KanbanDropZone({ status, children }) {
  const { setNodeRef, isOver } = useDroppable({ id: `${KANBAN_COLUMN_PREFIX}${status}`, data: { type: 'column', status } });
  return (
    <div ref={setNodeRef} className={`p-3 d-flex flex-column gap-2 sv-kanban-scroll ${isOver ? 'sv-kanban-dropzone-over' : ''}`}>
      {children}
    </div>
  );
}

function GroupSection({
  groupKey,
  title,
  tasks,
  collapsed,
  onToggle,
  focusedTaskId,
  onFocusTask,
  selected,
  onToggleSelected,
  onInlinePatch,
  onTimerToggle,
  onTimerStop,
  isTimerActive,
  isTimerPaused,
  getTaskElapsedSeconds,
  timerState,
  onReorder,
  onOpenTask,
  onUnarchiveTask,
  visibleColumns,
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const itemIds = tasks.map((task) => String(task._id));

  return (
    <section className="sv-card rounded-4 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="d-flex w-100 align-items-center justify-content-between px-3 px-lg-4 py-3 text-start border-0 bg-transparent"
      >
        <div className="flex items-center gap-3">
          <Icon name={collapsed ? 'chevron_right' : 'expand_more'} className="text-on-surface-variant transition-transform flex-shrink-0" />
          <p className="text-sm font-bold text-on-surface m-0">{title}</p>
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold text-primary border border-primary/20 flex-shrink-0">
            {tasks.length}
          </span>
        </div>
        <Icon name={collapsed ? 'expand_more' : 'expand_less'} className="text-on-surface-variant opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>

      {!collapsed ? (
        <div className="sv-task-list-body">
          {tasks.length ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={(event) => {
                const { active, over } = event;
                if (!over || active.id === over.id) {
                  return;
                }
                const oldIndex = itemIds.indexOf(String(active.id));
                const newIndex = itemIds.indexOf(String(over.id));
                if (oldIndex < 0 || newIndex < 0) {
                  return;
                }
                onReorder({ taskId: active.id, newPosition: newIndex, groupKey });
              }}
            >
              <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
                {tasks.map((task, index) => (
                  <SortableTaskRow
                    key={task._id}
                    task={task}
                    rowStyle={{ animationDelay: `${index * 50}ms` }}
                    focusedTaskId={focusedTaskId}
                    onFocusTask={onFocusTask}
                    selected={selected}
                    onToggleSelected={onToggleSelected}
                    onInlinePatch={onInlinePatch}
                    onTimerToggle={onTimerToggle}
                    onTimerStop={onTimerStop}
                    isTimerActive={isTimerActive(String(task._id))}
                    isTimerPaused={isTimerPaused(String(task._id))}
                    timerElapsedSeconds={getTaskElapsedSeconds(String(task._id))}
                    timerState={timerState}
                    onOpenTask={onOpenTask}
                    onUnarchiveTask={onUnarchiveTask}
                    visibleColumns={visibleColumns}
                  />
                ))}
              </SortableContext>
            </DndContext>
          ) : (
            <div className="px-6 py-8 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-container-low text-on-surface-variant">
                <Icon name="assignment" className="text-2xl" />
              </div>
              <p className="text-sm text-on-surface-variant">No tasks in this group.</p>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}

function MyTasksPage() {
  const navigate = useNavigate();
  const { projectId, workspaceId } = useWorkspace();
  const { user } = useAuth();
  const {
    tasks,
    groups,
    meta,
    loading,
    error,
    quickCreateTask,
    updateMyTask,
    updateManyTasks,
    fetchTasks,
    reorderTask,
    isTimerActive,
    isTimerPaused,
    getTaskElapsedSeconds,
    startTaskTimer,
    stopTaskTimer,
    pauseTaskTimer,
    resumeTaskTimer,
    timerState,
  } = useMyTasks();

  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('dueDate');
  const [groupBy, setGroupBy] = useState('dueDate');
  const [archiveScope, setArchiveScope] = useState('all');
  const [issueTypeFilter, setIssueTypeFilter] = useState('all');
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [collapsed, setCollapsed] = useState({});
  const [selectedTaskIds, setSelectedTaskIds] = useState(new Set());
  const [focusedTaskId, setFocusedTaskId] = useState(null);
  const [timerMessage, setTimerMessage] = useState('');
  const [toast, setToast] = useState(null);
  const [draft, setDraft] = useState({ title: '', dueDate: '', priority: 'medium' });
  const [viewMode, setViewMode] = useState('list');
  const [visibleColumns, setVisibleColumns] = useState(new Set(DEFAULT_VISIBLE_COLUMNS));
  const [showColumnCustomizer, setShowColumnCustomizer] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [savedViews, setSavedViews] = useState([]);
  const [activeViewId, setActiveViewId] = useState(null);
  const [showSavedViewsMenu, setShowSavedViewsMenu] = useState(false);
  const [kanbanOrder, setKanbanOrder] = useState(() =>
    STATUS_OPTIONS.reduce((acc, status) => ({ ...acc, [status]: [] }), {}),
  );
  const savedViewsMenuRef = useRef(null);

  // Auto-dismiss toast after 3 seconds
  useEffect(() => {
    if (toast) {
      const timeout = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timeout);
    }
  }, [toast]);

  const totalOpen = Number(meta?.openCount || 0);
  const grouped = useMemo(() => groups || [], [groups]);
  const kanbanSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const taskById = useMemo(
    () => new Map((tasks || []).map((task) => [String(task._id), task])),
    [tasks],
  );

  const buildKanbanOrderFromTasks = useCallback(
    (sourceTasks) =>
      STATUS_OPTIONS.reduce((acc, status) => {
        acc[status] = (sourceTasks || [])
          .filter((task) => String(task.status || 'todo') === status)
          .map((task) => String(task._id));
        return acc;
      }, {}),
    [],
  );

  const reconcileKanbanOrder = useCallback((current, sourceTasks) => {
    const fromTasks = buildKanbanOrderFromTasks(sourceTasks);
    const next = {};
    let changed = false;

    for (const status of STATUS_OPTIONS) {
      const currentIds = (current?.[status] || []).map(String);
      const sourceIds = (fromTasks?.[status] || []).map(String);
      const sourceSet = new Set(sourceIds);

      const kept = currentIds.filter((id) => sourceSet.has(id));
      const missing = sourceIds.filter((id) => !kept.includes(id));
      const merged = [...kept, ...missing];
      next[status] = merged;

      if (!changed) {
        if (merged.length !== currentIds.length) {
          changed = true;
        } else {
          for (let i = 0; i < merged.length; i += 1) {
            if (merged[i] !== currentIds[i]) {
              changed = true;
              break;
            }
          }
        }
      }
    }

    return changed ? next : current;
  }, [buildKanbanOrderFromTasks]);

  useEffect(() => {
    setKanbanOrder((current) => reconcileKanbanOrder(current, tasks || []));
  }, [tasks, reconcileKanbanOrder]);

  useEffect(() => {
    if (!showSavedViewsMenu) return;
    const onPointerDown = (event) => {
      if (!savedViewsMenuRef.current?.contains(event.target)) {
        setShowSavedViewsMenu(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [showSavedViewsMenu]);

  // Load preferences from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('myTasks:preferences');
      if (saved) {
        const prefs = JSON.parse(saved);
        if (['list', 'kanban'].includes(prefs.viewMode)) setViewMode(prefs.viewMode);
        else if (prefs.viewMode === 'card') setViewMode('list');
        if (prefs.visibleColumns) setVisibleColumns(new Set(sanitizeVisibleColumns(prefs.visibleColumns)));
      }
      const savedViewsData = localStorage.getItem('myTasks:savedViews');
      if (savedViewsData) {
        const parsed = JSON.parse(savedViewsData);
        const normalized = (Array.isArray(parsed) ? parsed : []).map((view) => ({
          ...view,
          visibleColumns: sanitizeVisibleColumns(view?.visibleColumns),
        }));
        setSavedViews(normalized);
      }
    } catch (e) {
      console.error('Failed to load preferences:', e);
    }
  }, []);

  // Save preferences to localStorage
  const savePreferences = useCallback(() => {
    try {
      localStorage.setItem('myTasks:preferences', JSON.stringify({
        viewMode,
        visibleColumns: sanitizeVisibleColumns(Array.from(visibleColumns)),
      }));
    } catch (e) {
      console.error('Failed to save preferences:', e);
    }
  }, [viewMode, visibleColumns]);

  // Save preferences when they change
  useEffect(() => {
    savePreferences();
  }, [savePreferences]);

  useEffect(() => {
    if (!['list', 'kanban'].includes(viewMode)) {
      setViewMode('list');
    }
  }, [viewMode]);

  useEffect(() => {
    if (!timerState.error) return;
    setTimerMessage(timerState.error);
  }, [timerState.error]);

  useEffect(() => {
    const onKeyDown = (event) => {
      const tag = String(event.target?.tagName || '').toLowerCase();
      const isEditable = ['input', 'textarea', 'select'].includes(tag) || Boolean(event.target?.isContentEditable);
      if (isEditable) return;

      if (event.key.toLowerCase() === 'n') {
        event.preventDefault();
        setShowQuickCreate(true);
      }

      if (event.key.toLowerCase() === 't' && focusedTaskId) {
        event.preventDefault();
        const task = (tasks || []).find((item) => String(item._id) === String(focusedTaskId));
        if (task) {
          handleTimerToggle(task);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [focusedTaskId, tasks]);

  const onQuickCreate = async () => {
    if (!draft.title.trim()) return;
    await quickCreateTask({
      title: draft.title.trim(),
      dueDate: draft.dueDate || undefined,
      priority: draft.priority,
      projectId: projectId || undefined,
    });
    setDraft({ title: '', dueDate: '', priority: 'medium' });
    setShowQuickCreate(false);
  };

  const handleTimerToggle = async (task) => {
    const actorId = user?.id || window.localStorage.getItem('salevision:userId') || '';
    if (!actorId) {
      setTimerMessage('User ID not found. Please log in again.');
      return;
    }

    setTimerMessage('');
    try {
      if (isTimerActive(task._id)) {
        await pauseTaskTimer(task._id, actorId);
        setToast({ type: 'success', message: 'Timer paused' });
      } else if (isTimerPaused(task._id)) {
        await resumeTaskTimer(task._id, actorId);
        setToast({ type: 'success', message: 'Timer resumed' });
      } else {
        await startTaskTimer(task._id, actorId);
        setToast({ type: 'success', message: 'Timer started' });
      }
    } catch (error) {
      const errorMessage = error.message || 'Failed to update timer';
      if (errorMessage.includes('No active timer found') || errorMessage.includes('No paused timer found')) {
        setToast({ type: 'warning', message: 'No active timer found' });
      } else {
        setToast({ type: 'error', message: errorMessage });
      }
    }
  };

  const handleTimerStop = async (task) => {
    const actorId = user?.id || window.localStorage.getItem('salevision:userId') || '';
    if (!actorId) {
      setTimerMessage('User ID not found. Please log in again.');
      return;
    }

    setTimerMessage('');
    try {
      const response = await stopTaskTimer(task._id, actorId);
      const sessionSeconds = extractDurationSeconds(response?.data || response);
      setToast({ type: 'success', message: sessionSeconds > 0 ? `Timer ended (${formatDuration(sessionSeconds)})` : 'Timer ended' });
    } catch (error) {
      const errorMessage = error.message || 'Failed to stop timer';
      if (errorMessage.includes('No active timer found')) {
        setToast({ type: 'warning', message: 'No active timer found' });
      } else {
        setToast({ type: 'error', message: errorMessage });
      }
    }
  };

  const onFilterChange = async (nextFilter) => {
    setFilter(nextFilter);
    const archiveQuery =
      archiveScope === 'archived'
        ? { includeArchived: 'true', onlyArchived: 'true' }
        : { includeArchived: 'false', onlyArchived: 'false' };
    await fetchTasks({ filter: nextFilter, sort, groupBy, issueType: issueTypeFilter === 'all' ? undefined : issueTypeFilter, ...archiveQuery });
  };

  const onSortChange = async (nextSort) => {
    setSort(nextSort);
    const archiveQuery =
      archiveScope === 'archived'
        ? { includeArchived: 'true', onlyArchived: 'true' }
        : { includeArchived: 'false', onlyArchived: 'false' };
    await fetchTasks({ filter, sort: nextSort, groupBy, issueType: issueTypeFilter === 'all' ? undefined : issueTypeFilter, ...archiveQuery });
  };

  const onGroupByChange = async (nextGroupBy) => {
    setGroupBy(nextGroupBy);
    const archiveQuery =
      archiveScope === 'archived'
        ? { includeArchived: 'true', onlyArchived: 'true' }
        : { includeArchived: 'false', onlyArchived: 'false' };
    await fetchTasks({ filter, sort, groupBy: nextGroupBy, issueType: issueTypeFilter === 'all' ? undefined : issueTypeFilter, ...archiveQuery });
  };

  const onIssueTypeChange = async (nextIssueType) => {
    setIssueTypeFilter(nextIssueType);
    const archiveQuery =
      archiveScope === 'archived'
        ? { includeArchived: 'true', onlyArchived: 'true' }
        : { includeArchived: 'false', onlyArchived: 'false' };
    await fetchTasks({ filter, sort, groupBy, issueType: nextIssueType === 'all' ? undefined : nextIssueType, ...archiveQuery });
  };

  const onArchiveScopeChange = async (nextScope) => {
    setArchiveScope(nextScope);
    const archiveQuery =
      nextScope === 'archived'
        ? { includeArchived: 'true', onlyArchived: 'true' }
        : { includeArchived: 'false', onlyArchived: 'false' };
    await fetchTasks({ filter, sort, groupBy, issueType: issueTypeFilter === 'all' ? undefined : issueTypeFilter, ...archiveQuery });
  };

  const handleUnarchiveTask = async (task) => {
    const taskId = String(task?._id || '');
    if (!workspaceId || !taskId) return;
    const archiveQuery =
      archiveScope === 'archived'
        ? { includeArchived: 'true', onlyArchived: 'true' }
        : { includeArchived: 'false', onlyArchived: 'false' };
    try {
      await tasksApi.update(workspaceId, taskId, { archived: false });
      setToast({ type: 'success', message: 'Task unarchived' });
      await fetchTasks({ filter, sort, groupBy, issueType: issueTypeFilter === 'all' ? undefined : issueTypeFilter, ...archiveQuery });
    } catch (error) {
      setToast({ type: 'error', message: error.message || 'Failed to unarchive task' });
    }
  };

  const selectAllTasks = () => {
    const ids = (tasks || []).map((task) => String(task?._id || '')).filter(Boolean);
    setSelectedTaskIds(new Set(ids));
  };

  const clearAllSelectedTasks = () => {
    setSelectedTaskIds(new Set());
  };

  const handleBulkArchive = async () => {
    const ids = Array.from(selectedTaskIds);
    if (!ids.length) return;
    try {
      await updateManyTasks(ids, { archived: true });
      setToast({ type: 'success', message: `${ids.length} task${ids.length !== 1 ? 's' : ''} archived` });
      setSelectedTaskIds(new Set());
      const archiveQuery =
        archiveScope === 'archived'
          ? { includeArchived: 'true', onlyArchived: 'true' }
          : { includeArchived: 'false', onlyArchived: 'false' };
      await fetchTasks({
        filter,
        sort,
        groupBy,
        issueType: issueTypeFilter === 'all' ? undefined : issueTypeFilter,
        ...archiveQuery,
      });
    } catch (error) {
      setToast({ type: 'error', message: error.message || 'Failed to archive selected tasks' });
    }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedTaskIds);
    if (!ids.length) return;
    if (!confirm(`Delete ${ids.length} selected task${ids.length !== 1 ? 's' : ''}?`)) return;
    try {
      await updateManyTasks(ids, {}, 'delete');
      setToast({ type: 'success', message: `${ids.length} task${ids.length !== 1 ? 's' : ''} deleted` });
      setSelectedTaskIds(new Set());
      const archiveQuery =
        archiveScope === 'archived'
          ? { includeArchived: 'true', onlyArchived: 'true' }
          : { includeArchived: 'false', onlyArchived: 'false' };
      await fetchTasks({
        filter,
        sort,
        groupBy,
        issueType: issueTypeFilter === 'all' ? undefined : issueTypeFilter,
        ...archiveQuery,
      });
    } catch (error) {
      setToast({ type: 'error', message: error.message || 'Failed to delete selected tasks' });
    }
  };

  const toggleSelected = (taskId) => {
    setSelectedTaskIds((current) => {
      const next = new Set(current);
      if (next.has(String(taskId))) next.delete(String(taskId));
      else next.add(String(taskId));
      return next;
    });
  };

  const handleReorderInGroup = async ({ taskId, newPosition, groupKey }) => {
    await reorderTask({ taskId, newPosition, groupKey });
  };

  const resolveKanbanStatusById = useCallback((id, orderMap) => {
    const key = String(id || '');
    if (!key) return null;
    if (key.startsWith(KANBAN_COLUMN_PREFIX)) return key.slice(KANBAN_COLUMN_PREFIX.length);
    return STATUS_OPTIONS.find((status) => (orderMap?.[status] || []).includes(key)) || null;
  }, []);

  const handleKanbanDragEnd = async ({ active, over }) => {
    if (!active?.id || !over?.id) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    const sourceStatus = resolveKanbanStatusById(activeId, kanbanOrder);
    const targetStatus = resolveKanbanStatusById(overId, kanbanOrder);

    if (!sourceStatus || !targetStatus) return;
    if (!taskById.has(activeId)) return;

    const sourceItems = [...(kanbanOrder[sourceStatus] || [])];
    const targetItems = [...(kanbanOrder[targetStatus] || [])];
    const oldIndex = sourceItems.indexOf(activeId);
    if (oldIndex < 0) return;

    let newIndex = overId.startsWith(KANBAN_COLUMN_PREFIX)
      ? targetItems.length
      : targetItems.indexOf(overId);
    if (newIndex < 0) newIndex = targetItems.length;

    const previousOrder = kanbanOrder;

    if (sourceStatus === targetStatus) {
      if (oldIndex === newIndex) return;
      const moved = arrayMove(sourceItems, oldIndex, newIndex);
      setKanbanOrder((current) => ({ ...current, [sourceStatus]: moved }));
      try {
        await reorderTask({ taskId: activeId, newPosition: newIndex, groupKey: sourceStatus });
      } catch (error) {
        setKanbanOrder(previousOrder);
        setToast({ type: 'error', message: error.message || 'Failed to reorder task' });
      }
      return;
    }

    sourceItems.splice(oldIndex, 1);
    const clampedIndex = Math.max(0, Math.min(newIndex, targetItems.length));
    targetItems.splice(clampedIndex, 0, activeId);
    setKanbanOrder((current) => ({
      ...current,
      [sourceStatus]: sourceItems,
      [targetStatus]: targetItems,
    }));

    try {
      await updateMyTask(activeId, { status: targetStatus });
      await reorderTask({ taskId: activeId, newPosition: clampedIndex, groupKey: targetStatus });
      setToast({ type: 'success', message: `Moved to ${targetStatus.replace('_', ' ')}` });
    } catch (error) {
      setKanbanOrder(previousOrder);
      setToast({ type: 'error', message: error.message || 'Failed to move task' });
    }
  };

  const handleSaveView = () => {
    const viewName = prompt('Enter a name for this view:');
    if (!viewName?.trim()) return;

    const newView = {
      id: Date.now().toString(),
      name: viewName.trim(),
      viewMode,
      filter,
      sort,
      groupBy,
      issueTypeFilter,
      archiveScope,
      visibleColumns: sanitizeVisibleColumns(Array.from(visibleColumns)),
      createdAt: new Date().toISOString(),
    };

    const updatedViews = [...savedViews, newView];
    setSavedViews(updatedViews);
    try {
      localStorage.setItem('myTasks:savedViews', JSON.stringify(updatedViews));
    } catch (e) {
      console.error('Failed to save views:', e);
    }
    setActiveViewId(newView.id);
  };

  const handleLoadView = (view) => {
    setViewMode(['list', 'kanban'].includes(view.viewMode) ? view.viewMode : 'list');
    setFilter(view.filter);
    setSort(view.sort);
    setGroupBy(view.groupBy);
    setIssueTypeFilter(view.issueTypeFilter);
    setArchiveScope(view.archiveScope || 'all');
    setVisibleColumns(new Set(sanitizeVisibleColumns(view.visibleColumns)));
    setActiveViewId(view.id);
    const archiveQuery =
      (view.archiveScope || 'all') === 'archived'
        ? { includeArchived: 'true', onlyArchived: 'true' }
        : { includeArchived: 'false', onlyArchived: 'false' };
    fetchTasks({
      filter: view.filter,
      sort: view.sort,
      groupBy: view.groupBy,
      issueType: view.issueTypeFilter === 'all' ? undefined : view.issueTypeFilter,
      ...archiveQuery,
    });
  };

  const handleDeleteView = (viewId) => {
    if (!confirm('Are you sure you want to delete this saved view?')) return;
    const updatedViews = savedViews.filter((v) => v.id !== viewId);
    setSavedViews(updatedViews);
    if (activeViewId === viewId) setActiveViewId(null);
    try {
      localStorage.setItem('myTasks:savedViews', JSON.stringify(updatedViews));
    } catch (e) {
      console.error('Failed to delete view:', e);
    }
    setShowSavedViewsMenu(false);
  };

  const activeViewName = savedViews.find((view) => view.id === activeViewId)?.name || 'Saved Views';

  return (
    <main className="container-fluid px-0 py-3 py-lg-4 sv-mytasks-page">
      <div className="sv-mytasks-container">
        <section className="sv-card sv-mytasks-header p-3 p-lg-4">
          <div className="d-flex flex-column flex-xl-row align-items-xl-center justify-content-between gap-3 mb-3">
            <div className="d-flex align-items-center gap-3">
              <span className="sv-mytasks-icon-chip rounded-3 d-inline-flex align-items-center justify-content-center">
                <Icon name="check_circle" className="fs-4" />
              </span>
              <div>
                <h1 className="h2 mb-1 fw-bold sv-heading">My Tasks</h1>
                <p className="mb-0 small" style={{ color: 'var(--color-text-muted)' }}>
                  <span className="fw-semibold">{totalOpen}</span> open task{totalOpen !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

            <div className="d-flex flex-wrap align-items-center gap-2 sv-mytasks-toolbar">
              {/* Saved Views Dropdown */}
              {savedViews.length > 0 && (
                <div className="sv-savedviews-menu" ref={savedViewsMenuRef}>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary sv-ctl-btn sv-savedviews-trigger"
                    onClick={() => setShowSavedViewsMenu((current) => !current)}
                  >
                    {activeViewName}
                    <Icon name={showSavedViewsMenu ? 'expand_less' : 'expand_more'} />
                  </button>
                  {showSavedViewsMenu ? (
                    <div className="sv-savedviews-popover">
                      <button
                        type="button"
                        className={`sv-savedviews-item ${!activeViewId ? 'is-active' : ''}`}
                        onClick={() => {
                          setActiveViewId(null);
                          setShowSavedViewsMenu(false);
                        }}
                      >
                        <span>Saved Views</span>
                      </button>
                      {savedViews.map((view) => (
                        <div key={view.id} className={`sv-savedviews-item ${activeViewId === view.id ? 'is-active' : ''}`}>
                          <button
                            type="button"
                            className="sv-savedviews-name"
                            onClick={() => {
                              handleLoadView(view);
                              setShowSavedViewsMenu(false);
                            }}
                          >
                            {view.name}
                          </button>
                          <button
                            type="button"
                            className="sv-savedviews-remove"
                            title={`Delete ${view.name}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              handleDeleteView(view.id);
                            }}
                          >
                            <Icon name="close" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              )}

              {/* Save View Button */}
              <button
                type="button"
                onClick={handleSaveView}
                className="btn btn-sm btn-outline-secondary sv-ctl-btn"
                title="Save current view settings"
              >
                <Icon name="bookmark_add" className="me-1" />
                Save View
              </button>

              {/* View Mode Switcher */}
              <div className="btn-group sv-mode-switch" role="group" aria-label="View mode switcher">
                {['list', 'kanban'].map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setViewMode(mode)}
                    className={`btn btn-sm ${viewMode === mode ? 'btn-primary' : 'btn-outline-secondary'} sv-ctl-btn`}
                    title={`${mode.charAt(0).toUpperCase() + mode.slice(1)} view`}
                    aria-pressed={viewMode === mode}
                  >
                    <Icon name={mode === 'list' ? 'list' : 'view_kanban'} className="me-1" />
                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </button>
                ))}
              </div>

              {/* Column Customizer Button */}
              <button
                type="button"
                onClick={() => setShowColumnCustomizer(true)}
                className="btn btn-sm btn-outline-secondary sv-ctl-btn"
                title="Customize columns"
              >
                <Icon name="view_column" className="me-1" />
                Columns
              </button>

              {/* Filter Button */}
              <button
                type="button"
                onClick={() => setShowFilterPanel(true)}
                className="btn btn-sm btn-outline-secondary sv-ctl-btn"
                title="Advanced filters"
              >
                <Icon name="filter_list" className="me-1" />
                Filters
              </button>

              {/* Quick Create Button */}
              <button
                type="button"
                onClick={() => setShowQuickCreate((current) => !current)}
                className="btn btn-sm btn-primary sv-quickcreate-btn"
              >
                <Icon name="add" className="me-1" />
                Quick Create
              </button>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="d-flex flex-wrap align-items-center gap-2 pt-3 border-top sv-mytasks-filterbar">
            {['all', 'today', 'week', 'overdue'].map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => onFilterChange(item)}
                className={`btn btn-sm sv-filter-chip ${filter === item ? 'btn-primary' : 'btn-outline-secondary'}`}
              >
                {item === 'all' ? 'All' : item === 'week' ? 'This Week' : item[0].toUpperCase() + item.slice(1)}
              </button>
            ))}
          </div>
        </section>

        {selectedTaskIds.size ? (
          <div className="sv-card d-flex flex-wrap align-items-center gap-2 gap-lg-3 p-3">
            <div className="d-inline-flex align-items-center justify-content-center rounded-circle bg-primary text-white" style={{ width: '2rem', height: '2rem' }}>
              <Icon name="check" />
            </div>
            <span className="small fw-semibold">{selectedTaskIds.size} task{selectedTaskIds.size !== 1 ? 's' : ''} selected</span>
            <button
              type="button"
              onClick={selectAllTasks}
              className="btn btn-sm btn-outline-secondary"
            >
              Select All
            </button>
            <button
              type="button"
              onClick={clearAllSelectedTasks}
              className="btn btn-sm btn-outline-secondary"
            >
              Clear All
            </button>
            <button
              type="button"
              onClick={handleBulkArchive}
              className="btn btn-sm btn-outline-secondary"
            >
              Archive
            </button>
            <button
              type="button"
              onClick={handleBulkDelete}
              className="btn btn-sm btn-danger"
            >
              Delete
            </button>
          </div>
        ) : null}

        {showQuickCreate ? (
          <section className="sv-card p-3 p-lg-4 sv-quickcreate-inline sv-reveal">
            <input
              value={draft.title}
              onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
              placeholder="Task title..."
              className="form-control form-control-sm sv-ctl-input"
              autoFocus
            />
            <input
              type="date"
              value={draft.dueDate}
              onChange={(event) => setDraft((current) => ({ ...current, dueDate: event.target.value }))}
              className="form-control form-control-sm sv-ctl-input"
            />
            <select
              value={draft.priority}
              onChange={(event) => setDraft((current) => ({ ...current, priority: event.target.value }))}
              className="form-select form-select-sm sv-ctl-select"
            >
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <button
              type="button"
              onClick={onQuickCreate}
              className="btn btn-sm btn-primary sv-add-task-btn"
            >
              Add Task
            </button>
          </section>
        ) : null}

        {timerMessage ? (
          <div className="alert alert-danger py-2 px-3 mb-0">
            {timerMessage}
          </div>
        ) : null}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <section key={i} className="sv-card rounded-4 overflow-hidden">
                <div className="d-flex align-items-center justify-content-between px-3 px-lg-4 py-3">
                  <div className="d-flex align-items-center gap-3">
                    <div className="h-4 w-4 animate-pulse rounded bg-surface-container" />
                    <div className="h-4 w-24 animate-pulse rounded bg-surface-container" />
                  </div>
                  <div className="h-4 w-8 animate-pulse rounded bg-surface-container" />
                </div>
                <div className="sv-task-list-body">
                  {[1, 2, 3].map((j) => (
                    <div key={j} className="grid grid-cols-[12px_1fr_106px_96px_118px_118px_168px_92px] items-center gap-1 px-3 py-2 min-h-[40px]">
                      <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-surface-container" />
                      <div className="flex items-center gap-2">
                        <div className="h-5 w-10 animate-pulse rounded bg-surface-container" />
                        <div className="h-4 w-3/4 animate-pulse rounded bg-surface-container" />
                      </div>
                      <div className="h-5 w-20 animate-pulse rounded-full bg-surface-container" />
                      <div className="h-8 w-24 animate-pulse rounded bg-surface-container" />
                      <div className="h-8 w-24 animate-pulse rounded bg-surface-container" />
                      <div className="flex items-center gap-2">
                        <div className="h-5 w-16 animate-pulse rounded-full bg-surface-container" />
                        <div className="h-8 w-24 animate-pulse rounded bg-surface-container" />
                      </div>
                      <div className="h-8 w-16 animate-pulse rounded bg-surface-container" />
                      <div className="h-8 w-16 animate-pulse rounded bg-surface-container" />
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : null}
        {error ? (
          <div className="alert alert-danger p-3 text-center">
            <div className="mx-auto mb-3 d-inline-flex h-12 w-12 align-items-center justify-content-center rounded-circle bg-danger-subtle text-danger">
              <Icon name="error_outline" className="fs-4" />
            </div>
            <p className="mb-0 small">{error}</p>
          </div>
        ) : null}

        <div className="d-flex flex-column gap-3">
          {viewMode === 'list' && grouped.map((group) => (
            <GroupSection
              key={group.key || group.label}
              groupKey={group.key}
              title={group.label}
              tasks={group.items}
              collapsed={Boolean(collapsed[group.key || group.label])}
              onToggle={() => setCollapsed((current) => ({ ...current, [group.key || group.label]: !current[group.key || group.label] }))}
              focusedTaskId={focusedTaskId}
              onFocusTask={setFocusedTaskId}
              selected={selectedTaskIds}
              onToggleSelected={toggleSelected}
              onInlinePatch={updateMyTask}
              onTimerToggle={handleTimerToggle}
              onTimerStop={handleTimerStop}
              isTimerActive={isTimerActive}
              isTimerPaused={isTimerPaused}
              getTaskElapsedSeconds={getTaskElapsedSeconds}
              timerState={timerState}
              onReorder={handleReorderInGroup}
              onOpenTask={(taskRow) => navigate(`/tasks/${taskRow._id || taskRow.id}`)}
              onUnarchiveTask={handleUnarchiveTask}
              visibleColumns={visibleColumns}
            />
          ))}

          {viewMode === 'kanban' && (
            <DndContext sensors={kanbanSensors} collisionDetection={closestCenter} onDragEnd={handleKanbanDragEnd}>
              <div className="sv-kanban-board d-flex gap-3 pb-2">
                {STATUS_OPTIONS.map((status) => {
                  const statusTaskIds = kanbanOrder[status] || [];
                  const statusTasks = statusTaskIds
                    .map((id) => taskById.get(String(id)))
                    .filter(isRenderableKanbanTask);

                  return (
                    <div key={status} className="sv-card rounded-4 overflow-hidden sv-kanban-column">
                      <div className="sv-kanban-column-header px-3 py-3 border-bottom">
                        <div className="d-flex align-items-center justify-content-between">
                          <h3 className="sv-kanban-column-title text-sm font-bold text-on-surface capitalize">{status.replace('_', ' ')}</h3>
                          <span className="sv-kanban-column-count rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold text-primary border border-primary/20">
                            {statusTasks.length}
                          </span>
                        </div>
                      </div>
                      <KanbanDropZone status={status}>
                        <SortableContext items={statusTaskIds} strategy={verticalListSortingStrategy}>
                          {statusTasks.length ? (
                            statusTasks.map((task) => (
                              <SortableKanbanTaskCard
                                key={task._id}
                                status={status}
                                task={task}
                                selected={selectedTaskIds}
                                onToggleSelected={toggleSelected}
                                onInlinePatch={updateMyTask}
                                onTimerToggle={handleTimerToggle}
                                onTimerStop={handleTimerStop}
                                isTimerActive={isTimerActive(String(task._id))}
                                isTimerPaused={isTimerPaused(String(task._id))}
                                timerElapsedSeconds={getTaskElapsedSeconds(String(task._id))}
                                timerState={timerState}
                                onOpenTask={(taskRow) => navigate(`/tasks/${taskRow._id || taskRow.id}`)}
                                onUnarchiveTask={handleUnarchiveTask}
                              />
                            ))
                          ) : (
                            <div className="px-6 py-8 text-center">
                              <p className="text-sm text-on-surface-variant">No tasks</p>
                            </div>
                          )}
                        </SortableContext>
                      </KanbanDropZone>
                    </div>
                  );
                })}
              </div>
            </DndContext>
          )}

          {!grouped.length && !loading && viewMode === 'list' ? (
            <div className="sv-card rounded-4 border border-dashed p-4 p-lg-5 text-center">
              <div className="mx-auto mb-3 d-inline-flex h-16 w-16 align-items-center justify-content-center rounded-circle bg-body-secondary">
                <Icon name="assignment" className="fs-3" />
              </div>
              <p className="mb-1 small fw-semibold">No tasks found for this filter.</p>
              <p className="mb-0 small" style={{ color: 'var(--color-text-muted)' }}>Try adjusting your filters or create a new task.</p>
            </div>
          ) : null}
        </div>

        {focusedTaskId ? <p className="small mb-0" style={{ color: 'var(--color-text-muted)' }}>Shortcut: press `T` to toggle timer on focused task.</p> : null}
      </div>

      {/* Column Customizer Modal */}
      {showColumnCustomizer && (
        <div className="position-fixed top-0 start-0 end-0 bottom-0 z-50 d-flex align-items-center justify-content-center sv-modal-backdrop">
          <div className="sv-card w-100 sv-modal-panel p-4">
            <div className="mb-3 d-flex align-items-center justify-content-between">
              <h2 className="h5 mb-0 fw-bold sv-heading">Customize Columns</h2>
              <button
                type="button"
                onClick={() => setShowColumnCustomizer(false)}
                className="sv-modal-close-btn"
              >
                <Icon name="close" />
              </button>
            </div>
            <div className="d-flex flex-column gap-2">
              {[
                { key: 'checkbox', label: 'Checkbox' },
                { key: 'priority', label: 'Priority Dot' },
                { key: 'title', label: 'Title' },
                { key: 'project', label: 'Project' },
                { key: 'priorityDropdown', label: 'Priority Dropdown' },
                { key: 'dueDate', label: 'Due Date' },
                { key: 'status', label: 'Status' },
                { key: 'timer', label: 'Timer' },
                { key: 'open', label: 'Open Button' },
              ].map((column) => (
                <label key={column.key} className="d-flex align-items-center gap-2 rounded-3 px-2 py-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={visibleColumns.has(column.key)}
                    onChange={(e) => {
                      const next = new Set(visibleColumns);
                      if (e.target.checked) {
                        next.add(column.key);
                      } else {
                        next.delete(column.key);
                      }
                      setVisibleColumns(next);
                    }}
                  />
                  <span className="small fw-medium">{column.label}</span>
                </label>
              ))}
            </div>
            <div className="mt-3 d-flex gap-2">
              <button
                type="button"
                onClick={() => setVisibleColumns(new Set(DEFAULT_VISIBLE_COLUMNS))}
                className="btn btn-sm btn-outline-secondary flex-fill"
              >
                Reset to Default
              </button>
              <button
                type="button"
                onClick={() => setShowColumnCustomizer(false)}
                className="btn btn-sm btn-primary flex-fill"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filter Panel Modal */}
      {showFilterPanel && (
        <div className="position-fixed top-0 start-0 end-0 bottom-0 z-50 d-flex align-items-center justify-content-center sv-modal-backdrop">
          <div className="sv-card w-100 sv-modal-panel-lg p-4">
            <div className="mb-3 d-flex align-items-center justify-content-between">
              <h2 className="h5 mb-0 fw-bold sv-heading">Advanced Filters</h2>
              <button
                type="button"
                onClick={() => setShowFilterPanel(false)}
                className="sv-modal-close-btn"
              >
                <Icon name="close" />
              </button>
            </div>
            <div className="row g-3">
              <div className="col-sm-6">
                <label className="form-label small fw-semibold mb-1">Sort By</label>
                <select value={sort} onChange={(event) => onSortChange(event.target.value)} className="form-select form-select-sm sv-ctl-select">
                  <option value="dueDate">Due Date</option>
                  <option value="priority">Priority</option>
                  <option value="updatedAt">Updated</option>
                </select>
              </div>
              <div className="col-sm-6">
                <label className="form-label small fw-semibold mb-1">Group By</label>
                <select value={groupBy} onChange={(event) => onGroupByChange(event.target.value)} className="form-select form-select-sm sv-ctl-select">
                  {GROUP_MODES.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div className="col-sm-6">
                <label className="form-label small fw-semibold mb-1">Archive Scope</label>
                <select value={archiveScope} onChange={(event) => onArchiveScopeChange(event.target.value)} className="form-select form-select-sm sv-ctl-select">
                  <option value="all">All (Active)</option>
                  <option value="archived">Archived only</option>
                </select>
              </div>
              <div className="col-sm-6">
                <label className="form-label small fw-semibold mb-1">Issue Type</label>
                <select value={issueTypeFilter} onChange={(event) => onIssueTypeChange(event.target.value)} className="form-select form-select-sm sv-ctl-select">
                  <option value="all">All types</option>
                  <option value="epic">Epic</option>
                  <option value="task">Task</option>
                  <option value="subtask">Subtask</option>
                </select>
              </div>
            </div>
            <div className="mt-3 d-flex gap-2">
              <button
                type="button"
                onClick={() => {
                  onSortChange('dueDate');
                  onGroupByChange('dueDate');
                  onArchiveScopeChange('all');
                  onIssueTypeChange('all');
                  setShowFilterPanel(false);
                }}
                className="btn btn-sm btn-outline-secondary flex-fill"
              >
                Clear All
              </button>
              <button
                type="button"
                onClick={() => setShowFilterPanel(false)}
                className="btn btn-sm btn-primary flex-fill"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="position-fixed bottom-0 end-0 p-3 z-50">
          <div
            className={`sv-toast shadow ${
              toast.type === 'success'
                ? 'alert alert-success'
                : toast.type === 'warning'
                ? 'alert alert-warning'
                : 'alert alert-danger'
            }`}
          >
            <div className="d-flex align-items-center gap-2">
              <Icon name={toast.type === 'success' ? 'check_circle' : toast.type === 'warning' ? 'warning' : 'error'} />
              <span className="small fw-medium">{toast.message}</span>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default MyTasksPage;
