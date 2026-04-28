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

const FINAL_STATUS_KEYS = new Set(['completed', 'done', 'closed']);
const COMPLETED_STATUS_KEY = 'completed';
const LOCKED_STATUS_MESSAGE = 'Completed task cannot be moved back';

function normalizeStatusKey(value) {
  return String(value || '').trim().toLowerCase();
}

function isCompletedReopenBlocked(fromStatus, toStatus) {
  const from = normalizeStatusKey(fromStatus);
  const to = normalizeStatusKey(toStatus);
  return from === COMPLETED_STATUS_KEY && to && !FINAL_STATUS_KEYS.has(to);
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
  onBlockedMove,
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
      className={`group sv-card sv-board-task-card overflow-hidden ${isDragging ? 'sv-board-task-card-dragging' : ''}`}
      {...attributes}
      {...listeners}
    >
      <div className="sv-board-task-card-top">
        <div className="sv-board-task-chips">
          <span className={`sv-board-priority-chip ${statusBadgeClass(task.status)}`}>
            <span className={`h-2 w-2 rounded-full ${priorityDotClass(task.priority)}`} />
            {String(task.priority || 'medium')}
          </span>
          <span className="sv-board-type-chip">
            {String(task.issueType || 'task')}
          </span>
        </div>
        <div className="sv-board-task-actions">
          {onTimerToggle && (
            <div className="sv-board-task-timer-actions">
              <button
                type="button"
                disabled={timerState?.starting || timerState?.pausing || timerState?.resuming}
                onClick={(e) => {
                  e.stopPropagation();
                  onTimerToggle(task);
                }}
                className={`sv-board-icon-btn ${isTimerActive ? 'is-warning' : ''} ${isTimerPaused ? 'is-accent' : ''} ${
                  isTimerActive
                    ? ''
                    : isTimerPaused
                    ? ''
                    : 'is-primary'
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
                  className="sv-board-icon-btn is-danger"
                  title="End"
                >
                  <Icon name="stop" className="text-sm" />
                </button>
              )}
            </div>
          )}
          <div className="relative sv-board-task-menu-container">
          <button
            type="button"
            onClick={() => setMenuOpen((current) => !current)}
            className="sv-board-menu-btn"
            title="Task actions"
          >
            <span className="text-sm font-black leading-none">...</span>
          </button>
          {menuOpen ? (
            <div className="sv-board-menu-popover">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onOpen(task);
                }}
                className="sv-board-menu-item"
              >
                <Icon name="open_in_new" className="text-[14px]" />
                Edit
              </button>
              <div className="sv-board-menu-label px-3 py-1 text-[10px] font-semibold uppercase text-slate-400">Move to</div>
              {(columns || []).map((column) => {
                const blocked = isCompletedReopenBlocked(task.status, column.key);
                return (
                <button
                  key={column.key}
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    if (blocked) {
                      onBlockedMove?.(LOCKED_STATUS_MESSAGE);
                      return;
                    }
                    onMove(taskId, column.key);
                  }}
                  className="sv-board-menu-item"
                  title={blocked ? LOCKED_STATUS_MESSAGE : column.title}
                >
                  {blocked ? <Icon name="block" className="text-[12px] text-danger mr-1" /> : null}
                  {column.title}
                </button>
                );
              })}
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  navigator.clipboard.writeText(
                    new URL(`${import.meta.env.BASE_URL}tasks/${taskId}`, window.location.origin).toString(),
                  );
                }}
                className="sv-board-menu-item"
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
                className="sv-board-menu-item"
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
                className="sv-board-menu-item"
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
                className="sv-board-menu-item is-danger"
              >
                <Icon name="delete" className="text-[14px]" />
                Delete
              </button>
            </div>
          ) : null}
        </div>
      </div>
      </div>

      <h4 className="sv-board-task-title">{task.title}</h4>

      {Array.isArray(task.labels) && task.labels.length ? (
        <div className="sv-board-labels-row">
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

      <div className="sv-board-task-meta-top">
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

      <div className="sv-board-task-meta-bottom">
        <span className="sv-board-meta-item">
          <Icon name="calendar_today" className="text-[12px]" />
          {formatDueDate(task.dueDate)}
        </span>
        <span className="sv-board-meta-item">
          <Icon name="subdirectory_arrow_right" className="text-[12px]" />
          {task.subtaskCount || 0}
        </span>
        <span className="sv-board-meta-item">
          <Icon name="chat_bubble_outline" className="text-[12px]" />
          {task.commentsCount || 0}
        </span>
      </div>

      <div className="sv-board-task-footer mt-3 flex justify-end">
        <button
          type="button"
          onClick={() => onOpen(task)}
          className="sv-board-open-btn"
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
    <div className="sv-board-column-head">
      <button type="button" onClick={onToggleCollapse} className="sv-board-column-collapse-btn">
        <div className="sv-board-column-head-left">
          <h3 className="sv-board-column-title">{column.title}</h3>
          <span className="sv-board-column-count">
            {count}
          </span>
          {showWip ? (
            <span
              className={`sv-board-column-wip ${exceeded ? 'is-exceeded' : warning ? 'is-warning' : ''}`}
            >
              {count}/{wipLimit}
            </span>
          ) : null}
        </div>
        <Icon name={collapsed ? 'expand_more' : 'expand_less'} className="sv-board-column-collapse-icon" />
      </button>
      <div className="relative column-menu-container sv-board-column-menu-container">
        <button
          type="button"
          onClick={() => onToggleMenu(column.key)}
          className="sv-board-menu-btn"
          title="Column options"
        >
          <Icon name="more_vert" className="text-lg" />
        </button>
        {menuOpen && (
          <div className="sv-board-menu-popover">
            <button
              type="button"
              onClick={() => onEdit(column.key, column)}
              className="sv-board-menu-item"
            >
              <Icon name="edit" className="text-sm" />
              Edit
            </button>
            {!isDefaultColumn && (
              <button
                type="button"
                onClick={() => onDelete(column.key)}
                className="sv-board-menu-item is-danger"
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
  onBlockedMove,
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
    <div ref={setNodeRef} className="sv-board-column animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="sv-board-column-head-wrap">
        <div className="sv-board-column-head-grab" {...attributes} {...listeners}>
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
        <div className="sv-board-column-body">
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
                onBlockedMove={onBlockedMove}
                animationStyle={{ animationDelay: `${index * 50}ms` }}
                onTimerToggle={onTimerToggle}
                onTimerStop={onTimerStop}
                isTimerActive={onTimerToggle ? isTimerActive(String(task._id || task.id)) : false}
                isTimerPaused={onTimerToggle ? isTimerPaused(String(task._id || task.id)) : false}
                timerState={timerState}
              />
            ))}
          </SortableContext>

          <div className="sv-board-add-task-box">
            <div className="sv-board-add-task-label-wrap">
              <span className="sv-board-add-task-label">
                Create a New Task
              </span>
            </div>
            <button
              type="button"
              onClick={() => navigate('/tasks/new')}
              className="sv-board-add-task-btn"
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
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [blockedActionMessage, setBlockedActionMessage] = useState('');
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
    let movingTask = null;
    for (const column of columns) {
      const candidate = (column.tasks || []).find((task) => String(task._id || task.id) === String(taskId));
      if (candidate) {
        movingTask = candidate;
        break;
      }
    }
    if (isCompletedReopenBlocked(movingTask?.status, toColumnKey)) {
      setBlockedActionMessage(LOCKED_STATUS_MESSAGE);
      return;
    }
    setBlockedActionMessage('');
    moveTask({ taskId, toColumnKey, toPosition: 0 });
  }, [moveTask, columns]);

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
      const sourceColumn = columns.find((column) => column.key === activeData.columnKey);
      const movingTask = (sourceColumn?.tasks || []).find((task) => String(task._id || task.id) === String(taskId));
      if (isCompletedReopenBlocked(movingTask?.status, targetColumnKey)) {
        setBlockedActionMessage(LOCKED_STATUS_MESSAGE);
        return;
      }
      const targetIndex = (targetColumn.tasks || []).findIndex((task) => String(task._id || task.id) === String(overData.taskId));
      const position = targetIndex >= 0 ? targetIndex : (targetColumn.tasks || []).length;
      setBlockedActionMessage('');
      moveTask({ taskId, toColumnKey: targetColumnKey, toPosition: position });
    }
  }, [filteredColumns, boardGroupBy, columns, reorderColumns, moveTask]);

  if (boardLoading) {
    return (
      <section className="sv-board-page sv-board-skeleton animate-in fade-in duration-500">
        <div className="sv-board-skeleton-head" />
        <div className="sv-board-skeleton-filters">
          <div className="sv-board-skeleton-pill" />
          <div className="sv-board-skeleton-pill is-sm" />
        </div>
        <div className="sv-board-skeleton-columns">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="sv-board-skeleton-column" />
          ))}
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="sv-board-page">
      <section className="sv-card sv-board-hero animate-in fade-in duration-500">
        <div className="sv-board-hero-main">
            <p className="sv-board-eyebrow">Project Board</p>
            <h1 className="sv-board-title">
              {board.project?.name || 'Project Board'}
            </h1>
          </div>
          <div className="sv-board-hero-actions">
            <select
              value={boardGroupBy}
              onChange={(event) => setBoardGroupBy(event.target.value)}
              className="form-select sv-ctl-select sv-board-group-select"
            >
              <option value="none">No swimlanes</option>
              <option value="assignee">Swimlane: Assignee</option>
              <option value="epic">Swimlane: Epic</option>
            </select>
          </div>
        {error ? <p className="sv-board-error">{error}</p> : null}
        {blockedActionMessage ? <p className="sv-board-error">{blockedActionMessage}</p> : null}
      </section>

      <section className="sv-board-filters animate-in slide-in-from-top-4 duration-300">
        <button
          type="button"
          onClick={() => handleToggleFilter('myTasks')}
          className={`sv-ctl-btn sv-board-filter-btn btn ${filters.myTasks ? 'btn-primary is-active' : 'btn-light'}`}
        >
          My tasks
        </button>
        <button
          type="button"
          onClick={() => handleToggleFilter('overdue')}
          className={`sv-ctl-btn sv-board-filter-btn btn ${filters.overdue ? 'btn-primary is-active' : 'btn-light'}`}
        >
          Overdue
        </button>
        <button
          type="button"
          onClick={() => handleToggleFilter('unassigned')}
          className={`sv-ctl-btn sv-board-filter-btn btn ${filters.unassigned ? 'btn-primary is-active' : 'btn-light'}`}
        >
          Unassigned
        </button>
        <button
          type="button"
          onClick={() => setShowAdvancedFilters((current) => !current)}
          className={`sv-ctl-btn sv-board-filter-btn btn ${showAdvancedFilters ? 'btn-primary is-active' : 'btn-light'}`}
        >
          <Icon name="filter_list" className="me-1 text-[14px]" />
          Filters
        </button>
        {showAdvancedFilters ? (
          <div className="sv-board-filter-panel">
            <select
              value={filters.priority}
              onChange={(event) => handleFilterChange('priority', event.target.value)}
              className="form-select sv-ctl-select sv-board-filter-select"
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
              className="form-select sv-ctl-select sv-board-filter-select"
            >
              <option value="all">Label</option>
              {labelOptions.map((label) => (
                <option key={label._id} value={label._id}>{label.name}</option>
              ))}
            </select>
            <select
              value={filters.issueType}
              onChange={(event) => handleFilterChange('issueType', event.target.value)}
              className="form-select sv-ctl-select sv-board-filter-select"
            >
              <option value="all">Issue Type</option>
              <option value="epic">Epic</option>
              <option value="task">Task</option>
              <option value="subtask">Subtask</option>
            </select>
            <select
              value={filters.epic}
              onChange={(event) => handleFilterChange('epic', event.target.value)}
              className="form-select sv-ctl-select sv-board-filter-select"
            >
              <option value="all">Epic</option>
              {epicOptions.map((epic) => (
                <option key={epic._id || epic.id} value={epic._id || epic.id}>
                  {epic.title}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </section>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <section className="sv-board-canvas custom-scrollbar">
          <div className="sv-board-columns-row">
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
                        onBlockedMove={setBlockedActionMessage}
                        menuOpenColumn={menuOpenColumn}
                        onToggleColumnMenu={handleToggleColumnMenu}
                        onEditColumn={handleOpenEditColumn}
                        onDeleteColumn={handleOpenDeleteConfirm}
                        isDefaultColumn={isDefaultColumn}
                        navigate={navigate}
                      />
                    ))}
                  </SortableContext>
                  <div className="sv-board-add-column-wrap animate-in fade-in duration-300">
                    {!showAddColumn ? (
                      <button
                        type="button"
                        onClick={() => setShowAddColumn(true)}
                        className="sv-board-add-column-btn"
                      >
                        <Icon name="add" className="mr-2 text-lg" />
                        Add column
                      </button>
                    ) : (
                      <div className="sv-card sv-board-add-column-card animate-in slide-in-from-right-2 duration-200">
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
                          className="form-control sv-ctl-input sv-board-add-column-input"
                        />
                        {addColumnError && (
                          <p className="sv-board-add-column-error">{addColumnError}</p>
                        )}
                        <div className="sv-board-add-column-actions">
                          <button
                            type="button"
                            onClick={handleAddColumn}
                            disabled={isAddingColumn || !newColumnName.trim()}
                            className="btn btn-primary sv-ctl-btn sv-board-add-column-action"
                          >
                            {isAddingColumn ? 'Adding...' : 'Add'}
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelAddColumn}
                            disabled={isAddingColumn}
                            className="btn btn-light sv-ctl-btn sv-board-add-column-action"
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
                <div key={lane.key} className="sv-board-lane animate-in fade-in slide-in-from-bottom-4 duration-300" style={{ animationDelay: `${laneIndex * 100}ms` }}>
                  <div className="sv-board-lane-label">{lane.label}</div>
                  <div className="sv-board-lane-columns">
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
                        onBlockedMove={setBlockedActionMessage}
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
      </section>

      {/* Edit Column Modal */}
      {editColumnModalOpen && (
        <div className="sv-modal-backdrop fixed inset-0 z-50 d-flex align-items-center justify-content-center animate-in fade-in duration-200">
          <div className="sv-card sv-board-modal animate-in slide-in-from-bottom-8 duration-300">
            <div className="sv-board-modal-head">
              <h2 className="sv-board-modal-title">Edit Column</h2>
            </div>
            <div className="sv-board-modal-body">
              <div>
                <label className="sv-board-form-label">
                  Column Name <span className="text-error">*</span>
                </label>
                <input
                  type="text"
                  value={editColumnData.title}
                  onChange={(e) => setEditColumnData((current) => ({ ...current, title: e.target.value }))}
                  placeholder="Enter column name"
                  className="form-control sv-ctl-input sv-board-form-control"
                />
              </div>
              <div>
                <label className="sv-board-form-label">Color</label>
                <select
                  value={editColumnData.colorMeta}
                  onChange={(e) => setEditColumnData((current) => ({ ...current, colorMeta: e.target.value }))}
                  className="form-select sv-ctl-select sv-board-form-control"
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
                <label className="sv-board-form-label">WIP Limit (Optional)</label>
                <input
                  type="number"
                  min="0"
                  value={editColumnData.wipLimit}
                  onChange={(e) => setEditColumnData((current) => ({ ...current, wipLimit: e.target.value }))}
                  placeholder="No limit"
                  className="form-control sv-ctl-input sv-board-form-control"
                />
              </div>
              <div className="sv-board-checkbox-row">
                <input
                  type="checkbox"
                  id="isDoneColumn"
                  checked={editColumnData.isDoneColumn}
                  onChange={(e) => setEditColumnData((current) => ({ ...current, isDoneColumn: e.target.checked }))}
                  className="form-check-input sv-board-checkbox"
                />
                <label htmlFor="isDoneColumn" className="sv-board-checkbox-label">
                  Mark as "Done" column
                </label>
              </div>
              {editColumnError && (
                <p className="sv-board-modal-error">{editColumnError}</p>
              )}
            </div>
            <div className="sv-board-modal-actions">
              <button
                type="button"
                onClick={handleCloseEditColumn}
                disabled={isUpdatingColumn}
                className="btn btn-light sv-ctl-btn sv-board-modal-btn"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveColumn}
                disabled={isUpdatingColumn || !editColumnData.title.trim()}
                className="btn btn-primary sv-ctl-btn sv-board-modal-btn"
              >
                {isUpdatingColumn ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirmOpen && (
        <div className="sv-modal-backdrop fixed inset-0 z-50 d-flex align-items-center justify-content-center animate-in fade-in duration-200">
          <div className="sv-card sv-board-delete-modal animate-in slide-in-from-bottom-8 duration-300">
            <div className="sv-board-delete-icon">
              <Icon name="warning" className="text-2xl" />
            </div>
            <h2 className="sv-board-delete-title">Delete Column?</h2>
            <p className="sv-board-delete-text">
              This action cannot be undone. All tasks in this column will be moved to the first available column.
            </p>
            {deleteColumnError && (
              <p className="sv-board-delete-error">{deleteColumnError}</p>
            )}
            <div className="sv-board-modal-actions">
              <button
                type="button"
                onClick={handleCloseDeleteConfirm}
                disabled={isDeletingColumn}
                className="btn btn-light sv-ctl-btn sv-board-modal-btn"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeletingColumn}
                className="btn sv-ctl-btn sv-board-modal-btn sv-board-delete-btn"
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
