import { useCallback, useEffect, useMemo, useState, memo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import Icon from '../../components/ui/Icon';
import { useTasks } from '../../hooks/useTasks';
import { useAuth } from '../../contexts/AuthContext';
import { useTimeTracker } from '../../hooks/useTimeTracker';

// Custom debounce hook
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
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

function statusBadgeClass(status) {
  if (status === 'completed') return 'bg-emerald-100 text-emerald-700';
  if (status === 'in_progress') return 'bg-blue-100 text-blue-700';
  if (status === 'in_review') return 'bg-amber-100 text-amber-700';
  return 'bg-slate-100 text-slate-700';
}

function formatDueDate(value) {
  if (!value) return 'No due date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No due date';
  return date.toLocaleDateString();
}

const TaskCard = memo(function TaskCard({
  task,
  onOpen,
  onDuplicate,
  onArchive,
  onDelete,
  onMove,
  columnKey,
  laneKey,
  columns,
  animationStyle,
  onTimerToggle,
  onTimerStop,
  isTimerActive,
  isTimerPaused,
  timerState,
}) {
  const taskId = String(task._id || task.id);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `task:${taskId}`,
    data: { type: 'task', taskId, columnKey, laneKey },
  });

  const dndStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <article
      ref={setNodeRef}
      style={{ ...dndStyle, ...animationStyle }}
      className={`group overflow-hidden rounded-2xl border border-outline-variant/50 bg-gradient-to-br from-surface-container-low via-surface-container-low to-surface-container-low/50 p-3 shadow-lg backdrop-blur-sm transition-all hover:shadow-xl hover:border-primary/40 hover:-translate-y-1 ${isDragging ? 'opacity-60 scale-95' : ''}`}
      {...attributes}
      {...listeners}
    >
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${statusBadgeClass(task.status)}`}>
            <span className={`h-2 w-2 rounded-full ${priorityDotClass(task.priority)}`} />
            {String(task.priority || 'medium')}
          </span>
          <span className="inline-flex items-center rounded-full bg-surface-container/80 px-2 py-0.5 text-[10px] font-semibold uppercase text-on-surface-variant backdrop-blur-sm">
            {String(task.issueType || 'task')}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {onTimerToggle && (
            <div className="flex items-center gap-1 mr-2">
              <button
                type="button"
                disabled={timerState?.starting || timerState?.pausing || timerState?.resuming}
                onClick={(e) => {
                  e.stopPropagation();
                  onTimerToggle(task);
                }}
                className={`rounded-lg p-1.5 text-xs font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                  isTimerActive
                    ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                    : isTimerPaused
                    ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                    : 'bg-primary/10 text-primary hover:bg-primary/20'
                }`}
                title={isTimerActive ? 'Pause' : isTimerPaused ? 'Resume' : 'Start'}
              >
                <Icon name={isTimerActive ? 'pause' : isTimerPaused ? 'play_arrow' : 'play_arrow'} className="text-sm" />
              </button>
              {(isTimerActive || isTimerPaused) && (
                <button
                  type="button"
                  disabled={timerState?.stopping}
                  onClick={(e) => {
                    e.stopPropagation();
                    onTimerStop(task);
                  }}
                  className="rounded-lg p-1.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  title="End"
                >
                  <Icon name="stop" className="text-sm" />
                </button>
              )}
            </div>
          )}
          <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((current) => !current)}
            className="rounded p-1 text-slate-400 hover:bg-slate-100"
            title="Task actions"
          >
            <span className="text-sm font-black leading-none">...</span>
          </button>
          {menuOpen ? (
            <div className="absolute right-0 top-8 z-20 min-w-40 rounded-lg border border-outline-variant bg-white p-1 shadow-lg">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onOpen(task);
                }}
                className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-xs font-semibold text-on-surface hover:bg-slate-100"
              >
                <Icon name="open_in_new" className="text-[14px]" />
                Edit
              </button>
              <div className="px-3 py-1 text-[10px] font-semibold uppercase text-slate-400">Move to</div>
              {(columns || []).map((column) => (
                <button
                  key={column.key}
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onMove(taskId, column.key);
                  }}
                  className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-xs font-semibold text-on-surface hover:bg-slate-100"
                >
                  {column.title}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  navigator.clipboard.writeText(`${window.location.origin}/tasks/${taskId}`);
                }}
                className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-xs font-semibold text-on-surface hover:bg-slate-100"
              >
                <Icon name="link" className="text-[14px]" />
                Copy link
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onDuplicate(taskId);
                }}
                className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-xs font-semibold text-on-surface hover:bg-slate-100"
              >
                <Icon name="content_copy" className="text-[14px]" />
                Duplicate
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onArchive(taskId);
                }}
                className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-xs font-semibold text-on-surface hover:bg-slate-100"
              >
                <Icon name="archive" className="text-[14px]" />
                Archive
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onDelete(taskId);
                }}
                className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-xs font-semibold text-red-600 hover:bg-red-50"
              >
                <Icon name="delete" className="text-[14px]" />
                Delete
              </button>
            </div>
          ) : null}
        </div>
      </div>
      </div>

      <h4 className="mb-2 text-sm font-semibold leading-relaxed text-on-surface">{task.title}</h4>

      {Array.isArray(task.labels) && task.labels.length ? (
        <div className="mb-2 flex flex-wrap gap-1">
          {task.labels.map((label) => (
            <span
              key={label._id}
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{ backgroundColor: `${label.color}22`, color: label.color }}
            >
              {label.name}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mb-3 flex items-center gap-2">
        {(task.assignees || []).slice(0, 2).map((assignee) => (
          <span
            key={assignee._id}
            className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-700"
            title={assignee.displayName || 'Assignee'}
          >
            {(assignee.displayName || '?').slice(0, 1).toUpperCase()}
          </span>
        ))}
        <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${statusBadgeClass(task.status)}`}>
          {String(task.status || 'todo').replace('_', ' ')}
        </span>
      </div>

      <div className="flex items-center justify-between text-slate-500">
        <span className="inline-flex items-center gap-1 text-[10px] font-medium">
          <Icon name="calendar_today" className="text-[12px]" />
          {formatDueDate(task.dueDate)}
        </span>
        <span className="inline-flex items-center gap-1 text-[10px] font-medium">
          <Icon name="subdirectory_arrow_right" className="text-[12px]" />
          {task.subtaskCount || 0}
        </span>
        <span className="inline-flex items-center gap-1 text-[10px] font-medium">
          <Icon name="chat_bubble_outline" className="text-[12px]" />
          {task.commentsCount || 0}
        </span>
      </div>

      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={() => onOpen(task)}
          className="rounded-xl bg-surface-container/80 px-3 py-1.5 text-[11px] font-semibold text-on-surface transition-all hover:bg-gradient-to-r hover:from-primary hover:to-primary/90 hover:text-on-primary hover:shadow-lg hover:shadow-primary/30 backdrop-blur-sm active:scale-95"
        >
          Open
        </button>
      </div>
    </article>
  );
});

const ColumnHeader = memo(function ColumnHeader({ column, collapsed, onToggleCollapse, menuOpen, onToggleMenu, onEdit, onDelete, isDefaultColumn }) {
  const wipLimit = column.wipLimit;
  const count = column.count || 0;
  const showWip = Number.isFinite(wipLimit) && wipLimit !== null;
  const exceeded = showWip && count > wipLimit;
  const warning = showWip && count >= wipLimit && !exceeded;

  return (
    <div className="flex items-center justify-between px-2">
      <button type="button" onClick={onToggleCollapse} className="flex flex-1 items-center justify-between rounded-xl hover:bg-surface-container-low/50 transition-all">
        <div className="flex items-center gap-2">
          <h3 className="font-bold tracking-tight text-on-surface">{column.title}</h3>
          <span className="rounded-full bg-slate-100/80 px-2 py-0.5 text-[10px] font-bold backdrop-blur-sm">
            {count}
          </span>
          {showWip ? (
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold backdrop-blur-sm ${exceeded ? 'bg-red-100 text-red-700' : warning ? 'bg-amber-100 text-amber-700' : 'bg-slate-100/80 text-slate-600'}`}
            >
              {count}/{wipLimit}
            </span>
          ) : null}
        </div>
        <Icon name={collapsed ? 'expand_more' : 'expand_less'} className="text-slate-400 transition-transform" />
      </button>
      <div className="relative column-menu-container">
        <button
          type="button"
          onClick={() => onToggleMenu(column.key)}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-surface-container-low hover:text-on-surface transition-all"
          title="Column options"
        >
          <Icon name="more_vert" className="text-lg" />
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-full z-20 min-w-32 rounded-xl border border-outline-variant/50 bg-surface-container-low/80 p-1 shadow-lg backdrop-blur-sm animate-in slide-in-from-top-2 duration-200">
            <button
              type="button"
              onClick={() => onEdit(column.key, column)}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-on-surface hover:bg-surface-container transition-colors"
            >
              <Icon name="edit" className="text-sm" />
              Edit
            </button>
            {!isDefaultColumn && (
              <button
                type="button"
                onClick={() => onDelete(column.key)}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors"
              >
                <Icon name="delete" className="text-sm" />
                Delete
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

const BoardColumn = memo(function BoardColumn({
  column,
  laneKey,
  enableColumnDrag,
  collapsed,
  onToggleCollapse,
  onOpenTask,
  onDuplicateTask,
  onArchiveTask,
  onDeleteTask,
  onMoveTask,
  columns,
  menuOpenColumn,
  onToggleColumnMenu,
  onEditColumn,
  onDeleteColumn,
  isDefaultColumn,
  onTimerToggle,
  onTimerStop,
  isTimerActive,
  isTimerPaused,
  timerState,
  navigate,
}) {
  const columnId = `column:${laneKey}:${column.key}`;
  const { setNodeRef: setSortableRef, attributes, listeners } = useSortable({
    id: columnId,
    data: { type: 'column', columnKey: column.key, laneKey },
    disabled: !enableColumnDrag,
  });
  const { setNodeRef: setDropRef } = useDroppable({
    id: `drop:${laneKey}:${column.key}`,
    data: { type: 'column', columnKey: column.key, laneKey },
  });
  const setNodeRef = (node) => {
    setSortableRef(node);
    setDropRef(node);
  };

  return (
    <div ref={setNodeRef} className="flex w-80 flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex min-h-[48px] items-center justify-between px-2">
        <div className="flex w-full items-center justify-between" {...attributes} {...listeners}>
          <ColumnHeader
            column={column}
            collapsed={collapsed}
            onToggleCollapse={onToggleCollapse}
            menuOpen={menuOpenColumn === column.key}
            onToggleMenu={onToggleColumnMenu}
            onEdit={onEditColumn}
            onDelete={onDeleteColumn}
            isDefaultColumn={isDefaultColumn(column.key)}
          />
        </div>
      </div>

      {!collapsed ? (
        <div className="flex flex-col gap-3">
          <SortableContext items={(column.tasks || []).map((task) => `task:${task._id || task.id}`)} strategy={verticalListSortingStrategy}>
            {(column.tasks || []).map((task, index) => (
              <TaskCard
                key={task._id || task.id}
                task={task}
                columnKey={column.key}
                laneKey={laneKey}
                columns={columns}
                onOpen={onOpenTask}
                onDuplicate={onDuplicateTask}
                onArchive={onArchiveTask}
                onDelete={onDeleteTask}
                onMove={onMoveTask}
                animationStyle={{ animationDelay: `${index * 50}ms` }}
                onTimerToggle={onTimerToggle}
                onTimerStop={onTimerStop}
                isTimerActive={onTimerToggle ? isTimerActive(String(task._id || task.id)) : false}
                isTimerPaused={onTimerToggle ? isTimerPaused(String(task._id || task.id)) : false}
                timerState={timerState}
              />
            ))}
          </SortableContext>

          <div className="rounded-2xl border border-dashed border-outline-variant/50 bg-surface-container-low/80 p-3 backdrop-blur-sm transition-all hover:border-primary/30">
            <div className="mb-2 flex items-center justify-center">
              <span className="text-xs font-semibold text-on-surface-variant">
                Create a New Task
              </span>
            </div>
            <button
              type="button"
              onClick={() => navigate('/tasks/new')}
              className="w-full rounded-xl bg-gradient-to-r from-primary to-primary/90 px-3 py-1.5 text-xs font-semibold text-on-primary shadow-lg shadow-primary/30 transition-all hover:shadow-primary/40 active:scale-95"
            >
              Add Task
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
});

function ProjectBoardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    board,
    boardLoading,
    error,
    moveTask,
    removeTask,
    duplicateTask,
    archiveTask,
    reorderColumns,
    boardGroupBy,
    setBoardGroupBy,
    addColumn,
    updateColumn,
    removeColumn: deleteColumn,
  } = useTasks();

  const [collapsedColumns, setCollapsedColumns] = useState(() => new Set());
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [addColumnError, setAddColumnError] = useState('');
  const addColumnInputRef = useRef(null);
  const [menuOpenColumn, setMenuOpenColumn] = useState(null);
  const [editColumnModalOpen, setEditColumnModalOpen] = useState(false);
  const [editingColumnKey, setEditingColumnKey] = useState(null);
  const [editColumnData, setEditColumnData] = useState({ title: '', colorMeta: '', wipLimit: '', isDoneColumn: false });
  const [isUpdatingColumn, setIsUpdatingColumn] = useState(false);
  const [editColumnError, setEditColumnError] = useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingColumnKey, setDeletingColumnKey] = useState(null);
  const [isDeletingColumn, setIsDeletingColumn] = useState(false);
  const [deleteColumnError, setDeleteColumnError] = useState('');
  const [activeTimers, setActiveTimers] = useState(() => new Set());
  const [pausedTimers, setPausedTimers] = useState(() => new Set());
  const [filters, setFilters] = useState({
    myTasks: false,
    overdue: false,
    unassigned: false,
    priority: 'all',
    label: 'all',
    issueType: 'all',
    epic: 'all',
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Auto-focus the add column input when shown
  useEffect(() => {
    if (showAddColumn && addColumnInputRef.current) {
      addColumnInputRef.current.focus();
      addColumnInputRef.current.select();
    }
  }, [showAddColumn]);

  // Close column menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuOpenColumn && !event.target.closest('.column-menu-container')) {
        setMenuOpenColumn(null);
      }
    };

    if (menuOpenColumn) {
      document.addEventListener('click', handleClickOutside);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [menuOpenColumn]);

  const columns = board.columns || [];
  const swimlanes = boardGroupBy && boardGroupBy !== 'none' ? board.swimlanes || [] : [];

  const labelOptions = useMemo(() => {
    const map = new Map();
    for (const column of columns) {
      for (const task of column.tasks || []) {
        (task.labels || []).forEach((label) => map.set(String(label._id), label));
      }
    }
    return Array.from(map.values());
  }, [columns]);

  const epicOptions = useMemo(() => {
    const map = new Map();
    for (const column of columns) {
      for (const task of column.tasks || []) {
        if (String(task.issueType || 'task') === 'epic') {
          map.set(String(task._id || task.id), task);
        }
      }
    }
    return Array.from(map.values());
  }, [columns]);

  const filteredColumns = useMemo(() => {
    const now = new Date();
    const isOverdue = (task) => task.dueDate && new Date(task.dueDate) < now;
    const hasLabel = (task) => (task.labels || []).some((label) => String(label._id) === String(filters.label));
    return columns.map((column) => {
      const tasks = (column.tasks || []).filter((task) => {
        if (filters.myTasks) {
          const assignedIds = (task.assignees || []).map((assignee) => String(assignee._id));
          if (!assignedIds.includes(String(user?.id || ''))) return false;
        }
        if (filters.overdue && !isOverdue(task)) return false;
        if (filters.unassigned && (task.assignees || []).length) return false;
        if (filters.priority !== 'all' && String(task.priority) !== String(filters.priority)) return false;
        if (filters.label !== 'all' && !hasLabel(task)) return false;
        if (filters.issueType !== 'all' && String(task.issueType || 'task') !== String(filters.issueType)) return false;
        if (filters.epic !== 'all') {
          const taskId = String(task._id || task.id || '');
          const parentId = String(task.parentTaskId || '');
          if (taskId !== String(filters.epic) && parentId !== String(filters.epic)) {
            return false;
          }
        }
        return true;
      });
      return { ...column, tasks, count: tasks.length };
    });
  }, [columns, filters, user?.id]);

  const filteredSwimlanes = useMemo(() => {
    if (!swimlanes.length) return [];
    return swimlanes.map((lane) => ({
      ...lane,
      columns: (lane.columns || []).map((column) => {
        const baseColumn = filteredColumns.find((item) => item.key === column.key) || column;
        const taskIds = new Set((baseColumn.tasks || []).map((task) => String(task._id || task.id)));
        const tasks = (column.tasks || []).filter((task) => taskIds.has(String(task._id || task.id)));
        return { ...column, tasks, count: tasks.length };
      }),
    }));
  }, [swimlanes, filteredColumns]);

  const toggleCollapse = useCallback((columnKey) => {
    setCollapsedColumns((current) => {
      const next = new Set(current);
      if (next.has(columnKey)) next.delete(columnKey);
      else next.add(columnKey);
      return next;
    });
  }, []);

  const handleAddColumn = useCallback(async () => {
    const title = newColumnName.trim();
    if (!title) {
      setAddColumnError('Column name is required');
      return;
    }
    setIsAddingColumn(true);
    setAddColumnError('');
    try {
      await addColumn(title);
      setNewColumnName('');
      setShowAddColumn(false);
    } catch (err) {
      setAddColumnError(err.message || 'Failed to add column');
    } finally {
      setIsAddingColumn(false);
    }
  }, [newColumnName, addColumn]);

  const handleCancelAddColumn = useCallback(() => {
    setShowAddColumn(false);
    setNewColumnName('');
    setAddColumnError('');
  }, []);

  const handleToggleFilter = useCallback((filterKey) => {
    setFilters((current) => ({ ...current, [filterKey]: !current[filterKey] }));
  }, []);

  const handleFilterChange = useCallback((filterKey, value) => {
    setFilters((current) => ({ ...current, [filterKey]: value }));
  }, []);

  const handleOpenEditColumn = useCallback((columnKey, column) => {
    setEditingColumnKey(columnKey);
    setEditColumnData({
      title: column.title || '',
      colorMeta: column.colorMeta || '',
      wipLimit: column.wipLimit || '',
      isDoneColumn: column.isDoneColumn || false,
    });
    setEditColumnError('');
    setEditColumnModalOpen(true);
    setMenuOpenColumn(null);
  }, []);

  const handleCloseEditColumn = useCallback(() => {
    setEditColumnModalOpen(false);
    setEditingColumnKey(null);
    setEditColumnData({ title: '', colorMeta: '', wipLimit: '', isDoneColumn: false });
    setEditColumnError('');
  }, []);

  const handleSaveColumn = useCallback(async () => {
    if (!editingColumnKey) return;
    const title = editColumnData.title.trim();
    if (!title) {
      setEditColumnError('Column name is required');
      return;
    }
    setIsUpdatingColumn(true);
    setEditColumnError('');
    try {
      await updateColumn(editingColumnKey, {
        title,
        colorMeta: editColumnData.colorMeta || undefined,
        wipLimit: editColumnData.wipLimit ? Number(editColumnData.wipLimit) : undefined,
        isDoneColumn: editColumnData.isDoneColumn,
      });
      handleCloseEditColumn();
    } catch (err) {
      setEditColumnError(err.message || 'Failed to update column');
    } finally {
      setIsUpdatingColumn(false);
    }
  }, [editingColumnKey, editColumnData, updateColumn, handleCloseEditColumn]);

  const handleOpenDeleteConfirm = useCallback((columnKey) => {
    setDeletingColumnKey(columnKey);
    setDeleteColumnError('');
    setDeleteConfirmOpen(true);
    setMenuOpenColumn(null);
  }, []);

  const handleCloseDeleteConfirm = useCallback(() => {
    setDeleteConfirmOpen(false);
    setDeletingColumnKey(null);
    setDeleteColumnError('');
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!deletingColumnKey) return;
    setIsDeletingColumn(true);
    setDeleteColumnError('');
    try {
      await deleteColumn(deletingColumnKey);
      handleCloseDeleteConfirm();
    } catch (err) {
      setDeleteColumnError(err.message || 'Failed to delete column');
    } finally {
      setIsDeletingColumn(false);
    }
  }, [deletingColumnKey, deleteColumn, handleCloseDeleteConfirm]);

  const DEFAULT_COLUMNS = useMemo(() => ['todo', 'in_progress', 'in_review', 'completed'], []);

  const isDefaultColumn = useCallback((columnKey) => DEFAULT_COLUMNS.includes(columnKey), [DEFAULT_COLUMNS]);

  const handleToggleColumnMenu = useCallback((columnKey) => {
    setMenuOpenColumn((current) => (current === columnKey ? null : columnKey));
  }, []);

  // Close modals on Escape key press
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setEditColumnModalOpen(false);
        setDeleteConfirmOpen(false);
        setMenuOpenColumn(null);
        setShowAddColumn(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const handleMoveTask = useCallback((taskId, toColumnKey) => {
    moveTask({ taskId, toColumnKey, toPosition: 0 });
  }, [moveTask]);

  const onDragEnd = useCallback((event) => {
    const { active, over } = event;
    if (!over) return;
    const activeData = active.data?.current || {};
    const overData = over.data?.current || {};

    if (activeData.type === 'column' && overData.type === 'column' && boardGroupBy === 'none') {
      if (activeData.columnKey && overData.columnKey && activeData.columnKey !== overData.columnKey) {
        const newIndex = filteredColumns.findIndex((column) => column.key === overData.columnKey);
        reorderColumns(activeData.columnKey, newIndex);
      }
      return;
    }

    if (activeData.type === 'task') {
      const taskId = activeData.taskId;
      const targetColumnKey = overData.columnKey || activeData.columnKey;
      if (!taskId || !targetColumnKey) return;
      const targetColumn = columns.find((column) => column.key === targetColumnKey);
      if (!targetColumn) return;
      const targetIndex = (targetColumn.tasks || []).findIndex((task) => String(task._id || task.id) === String(overData.taskId));
      const position = targetIndex >= 0 ? targetIndex : (targetColumn.tasks || []).length;
      moveTask({ taskId, toColumnKey: targetColumnKey, toPosition: position });
    }
  }, [filteredColumns, boardGroupBy, columns, reorderColumns, moveTask]);

  if (boardLoading) {
    return (
      <section className="animate-in fade-in duration-500">
        <div className="mb-6 h-12 w-64 animate-pulse rounded-2xl bg-surface-container" />
        <div className="mb-4 flex gap-3">
          <div className="h-8 w-32 animate-pulse rounded-lg bg-surface-container" />
          <div className="h-8 w-24 animate-pulse rounded-lg bg-surface-container" />
        </div>
        <div className="flex gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-96 w-80 animate-pulse rounded-2xl bg-surface-container-low" />
          ))}
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="pb-4 pt-8 animate-in fade-in duration-500">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end rounded-2xl bg-gradient-to-br from-surface via-surface to-surface-container-low/50 p-6 shadow-lg backdrop-blur-sm border border-outline-variant/20">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Project Board</p>
            <h1 className="text-3xl font-extrabold tracking-tight text-on-surface">
              {board.project?.name || 'Project Board'}
            </h1>
          </div>
          <div className="flex flex-wrap gap-3">
            <select
              value={boardGroupBy}
              onChange={(event) => setBoardGroupBy(event.target.value)}
              className="appearance-none rounded-xl border border-outline-variant/50 bg-surface-container-low/80 px-4 py-2.5 text-sm font-semibold text-on-surface outline-none transition-all backdrop-blur-sm focus:border-primary focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest"
            >
              <option value="none">No swimlanes</option>
              <option value="assignee">Swimlane: Assignee</option>
              <option value="epic">Swimlane: Epic</option>
            </select>
          </div>
        </div>
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      </section>

      <section className="mb-6 flex flex-wrap gap-2 animate-in slide-in-from-top-4 duration-300">
        <button
          type="button"
          onClick={() => handleToggleFilter('myTasks')}
          className={`rounded-xl px-4 py-2 text-xs font-semibold transition-all ${filters.myTasks ? 'bg-gradient-to-r from-primary to-primary/90 text-on-primary shadow-lg shadow-primary/30' : 'bg-surface-container-low/80 text-on-surface-variant hover:bg-surface-container backdrop-blur-sm'}`}
        >
          My tasks
        </button>
        <button
          type="button"
          onClick={() => handleToggleFilter('overdue')}
          className={`rounded-xl px-4 py-2 text-xs font-semibold transition-all ${filters.overdue ? 'bg-gradient-to-r from-primary to-primary/90 text-on-primary shadow-lg shadow-primary/30' : 'bg-surface-container-low/80 text-on-surface-variant hover:bg-surface-container backdrop-blur-sm'}`}
        >
          Overdue
        </button>
        <button
          type="button"
          onClick={() => handleToggleFilter('unassigned')}
          className={`rounded-xl px-4 py-2 text-xs font-semibold transition-all ${filters.unassigned ? 'bg-gradient-to-r from-primary to-primary/90 text-on-primary shadow-lg shadow-primary/30' : 'bg-surface-container-low/80 text-on-surface-variant hover:bg-surface-container backdrop-blur-sm'}`}
        >
          Unassigned
        </button>
        <select
          value={filters.priority}
          onChange={(event) => handleFilterChange('priority', event.target.value)}
          className="appearance-none rounded-xl border border-outline-variant/50 bg-surface-container-low/80 px-4 py-2 text-xs font-semibold transition-all backdrop-blur-sm focus:border-primary focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest"
        >
          <option value="all">Priority</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select
          value={filters.label}
          onChange={(event) => handleFilterChange('label', event.target.value)}
          className="appearance-none rounded-xl border border-outline-variant/50 bg-surface-container-low/80 px-4 py-2 text-xs font-semibold transition-all backdrop-blur-sm focus:border-primary focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest"
        >
          <option value="all">Label</option>
          {labelOptions.map((label) => (
            <option key={label._id} value={label._id}>{label.name}</option>
          ))}
        </select>
        <select
          value={filters.issueType}
          onChange={(event) => handleFilterChange('issueType', event.target.value)}
          className="appearance-none rounded-xl border border-outline-variant/50 bg-surface-container-low/80 px-4 py-2 text-xs font-semibold transition-all backdrop-blur-sm focus:border-primary focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest"
        >
          <option value="all">Issue Type</option>
          <option value="epic">Epic</option>
          <option value="task">Task</option>
          <option value="subtask">Subtask</option>
        </select>
        <select
          value={filters.epic}
          onChange={(event) => handleFilterChange('epic', event.target.value)}
          className="appearance-none rounded-xl border border-outline-variant/50 bg-surface-container-low/80 px-4 py-2 text-xs font-semibold transition-all backdrop-blur-sm focus:border-primary focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest"
        >
          <option value="all">Epic</option>
          {epicOptions.map((epic) => (
            <option key={epic._id || epic.id} value={epic._id || epic.id}>
              {epic.title}
            </option>
          ))}
        </select>
      </section>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <section className="custom-scrollbar flex-1 overflow-x-auto pb-8">
          <div className="flex h-full min-w-max gap-6 py-4">
            {boardGroupBy === 'none'
              ? (
                <>
                  <SortableContext items={filteredColumns.map((column) => `column:base:${column.key}`)} strategy={verticalListSortingStrategy}>
                    {filteredColumns.map((column) => (
                      <BoardColumn
                        key={column.key}
                        column={column}
                        laneKey="base"
                        enableColumnDrag
                        columns={filteredColumns}
                        collapsed={collapsedColumns.has(column.key)}
                        onToggleCollapse={() => toggleCollapse(column.key)}
                        onOpenTask={(task) => navigate(`/tasks/${task._id || task.id}`)}
                        onDuplicateTask={duplicateTask}
                        onArchiveTask={archiveTask}
                        onDeleteTask={removeTask}
                        onMoveTask={handleMoveTask}
                        menuOpenColumn={menuOpenColumn}
                        onToggleColumnMenu={handleToggleColumnMenu}
                        onEditColumn={handleOpenEditColumn}
                        onDeleteColumn={handleOpenDeleteConfirm}
                        isDefaultColumn={isDefaultColumn}
                        navigate={navigate}
                      />
                    ))}
                  </SortableContext>
                  <div className="flex w-80 flex-col gap-4 animate-in fade-in duration-300">
                    {!showAddColumn ? (
                      <button
                        type="button"
                        onClick={() => setShowAddColumn(true)}
                        className="flex min-h-[48px] w-full items-center justify-center rounded-2xl border-2 border-dashed border-outline-variant/50 bg-surface-container-low/50 px-4 py-3 text-sm font-semibold text-on-surface-variant transition-all hover:border-primary/50 hover:bg-surface-container-low hover:text-primary backdrop-blur-sm"
                      >
                        <Icon name="add" className="mr-2 text-lg" />
                        Add column
                      </button>
                    ) : (
                      <div className="rounded-2xl border border-outline-variant/50 bg-surface-container-low/80 p-4 shadow-lg backdrop-blur-sm animate-in slide-in-from-right-2 duration-200">
                        <input
                          ref={addColumnInputRef}
                          type="text"
                          value={newColumnName}
                          onChange={(e) => setNewColumnName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleAddColumn();
                            } else if (e.key === 'Escape') {
                              handleCancelAddColumn();
                            }
                          }}
                          placeholder="New column name..."
                          className="mb-3 w-full rounded-xl border border-outline-variant/50 bg-surface-container-low/80 px-4 py-2.5 text-sm outline-none transition-all backdrop-blur-sm focus:border-primary focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest"
                        />
                        {addColumnError && (
                          <p className="mb-3 text-xs text-error">{addColumnError}</p>
                        )}
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={handleAddColumn}
                            disabled={isAddingColumn || !newColumnName.trim()}
                            className="flex-1 rounded-xl bg-gradient-to-r from-primary to-primary/90 px-4 py-2 text-sm font-semibold text-on-primary shadow-lg shadow-primary/30 transition-all hover:shadow-primary/40 active:scale-95 disabled:opacity-60 disabled:shadow-none"
                          >
                            {isAddingColumn ? 'Adding...' : 'Add'}
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelAddColumn}
                            disabled={isAddingColumn}
                            className="flex-1 rounded-xl border border-outline-variant/50 bg-surface-container-low/80 px-4 py-2 text-sm font-semibold text-on-surface transition-all hover:bg-surface-container backdrop-blur-sm disabled:opacity-60"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )
              : filteredSwimlanes.map((lane, laneIndex) => (
                <div key={lane.key} className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-300" style={{ animationDelay: `${laneIndex * 100}ms` }}>
                  <div className="px-2 text-xs font-semibold uppercase tracking-wider text-on-surface-variant">{lane.label}</div>
                  <div className="flex gap-6">
                    {lane.columns.map((column) => (
                      <BoardColumn
                        key={`${lane.key}-${column.key}`}
                        column={column}
                        laneKey={lane.key}
                        enableColumnDrag={false}
                        columns={columns}
                        collapsed={collapsedColumns.has(column.key)}
                        onToggleCollapse={() => toggleCollapse(column.key)}
                        onOpenTask={(task) => navigate(`/tasks/${task._id || task.id}`)}
                        onDuplicateTask={duplicateTask}
                        onArchiveTask={archiveTask}
                        onDeleteTask={removeTask}
                        onMoveTask={handleMoveTask}
                        menuOpenColumn={menuOpenColumn}
                        onToggleColumnMenu={handleToggleColumnMenu}
                        onEditColumn={handleOpenEditColumn}
                        onDeleteColumn={handleOpenDeleteConfirm}
                        isDefaultColumn={isDefaultColumn}
                        navigate={navigate}
                      />
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </section>
      </DndContext>

      {/* Edit Column Modal */}
      {editColumnModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl border border-outline-variant/50 bg-surface-container-lowest p-6 shadow-2xl backdrop-blur-sm animate-in slide-in-from-bottom-8 duration-300">
            <h2 className="mb-4 text-xl font-bold text-on-surface">Edit Column</h2>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-on-surface">
                  Column Name <span className="text-error">*</span>
                </label>
                <input
                  type="text"
                  value={editColumnData.title}
                  onChange={(e) => setEditColumnData((current) => ({ ...current, title: e.target.value }))}
                  placeholder="Enter column name"
                  className="w-full rounded-xl border border-outline-variant/50 bg-surface-container-low/80 px-4 py-2.5 text-sm outline-none transition-all backdrop-blur-sm focus:border-primary focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-on-surface">Color</label>
                <select
                  value={editColumnData.colorMeta}
                  onChange={(e) => setEditColumnData((current) => ({ ...current, colorMeta: e.target.value }))}
                  className="w-full appearance-none rounded-xl border border-outline-variant/50 bg-surface-container-low/80 px-4 py-2.5 text-sm font-semibold outline-none transition-all backdrop-blur-sm focus:border-primary focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest"
                >
                  <option value="">Default</option>
                  <option value="slate">Slate (Gray)</option>
                  <option value="red">Red</option>
                  <option value="orange">Orange</option>
                  <option value="amber">Amber</option>
                  <option value="green">Green</option>
                  <option value="blue">Blue</option>
                  <option value="purple">Purple</option>
                  <option value="pink">Pink</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-on-surface">WIP Limit (Optional)</label>
                <input
                  type="number"
                  min="0"
                  value={editColumnData.wipLimit}
                  onChange={(e) => setEditColumnData((current) => ({ ...current, wipLimit: e.target.value }))}
                  placeholder="No limit"
                  className="w-full rounded-xl border border-outline-variant/50 bg-surface-container-low/80 px-4 py-2.5 text-sm outline-none transition-all backdrop-blur-sm focus:border-primary focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isDoneColumn"
                  checked={editColumnData.isDoneColumn}
                  onChange={(e) => setEditColumnData((current) => ({ ...current, isDoneColumn: e.target.checked }))}
                  className="h-4 w-4 rounded border-outline-variant bg-surface-container-low text-primary focus:ring-2 focus:ring-primary/20"
                />
                <label htmlFor="isDoneColumn" className="text-sm font-semibold text-on-surface">
                  Mark as "Done" column
                </label>
              </div>
              {editColumnError && (
                <p className="text-sm text-error">{editColumnError}</p>
              )}
            </div>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={handleCloseEditColumn}
                disabled={isUpdatingColumn}
                className="flex-1 rounded-xl border border-outline-variant/50 bg-surface-container-low/80 px-4 py-2.5 text-sm font-semibold text-on-surface transition-all hover:bg-surface-container backdrop-blur-sm disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveColumn}
                disabled={isUpdatingColumn || !editColumnData.title.trim()}
                className="flex-1 rounded-xl bg-gradient-to-r from-primary to-primary/90 px-4 py-2.5 text-sm font-semibold text-on-primary shadow-lg shadow-primary/30 transition-all hover:shadow-primary/40 active:scale-95 disabled:opacity-60 disabled:shadow-none"
              >
                {isUpdatingColumn ? 'Saving...' : 'Save'}
              </button>
            </div>
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
            <h2 className="mb-2 text-xl font-bold text-on-surface">Delete Column?</h2>
            <p className="mb-4 text-sm text-on-surface-variant">
              This action cannot be undone. All tasks in this column will be moved to the first available column.
            </p>
            {deleteColumnError && (
              <p className="mb-4 text-sm text-error">{deleteColumnError}</p>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleCloseDeleteConfirm}
                disabled={isDeletingColumn}
                className="flex-1 rounded-xl border border-outline-variant/50 bg-surface-container-low/80 px-4 py-2.5 text-sm font-semibold text-on-surface transition-all hover:bg-surface-container backdrop-blur-sm disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeletingColumn}
                className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-red-600/30 transition-all hover:bg-red-700 hover:shadow-red-700/40 active:scale-95 disabled:opacity-60 disabled:shadow-none"
              >
                {isDeletingColumn ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default ProjectBoardPage;
