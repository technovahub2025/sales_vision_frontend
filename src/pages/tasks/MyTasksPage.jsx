import { useEffect, useMemo, useState, useCallback, useRef, memo, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
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
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { tasksApi } from '../../api';
import { useMyTasks } from '../../hooks/useMyTasks';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useAuth } from '../../contexts/AuthContext';
import Icon from '../../components/ui/Icon';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react';

const GROUP_MODES = [
  { value: 'dueDate', label: 'Due Date' },
  { value: 'status', label: 'Status' },
  { value: 'priority', label: 'Priority' },
  { value: 'project', label: 'Project' },
];
const TASK_FILTER_TABS = [
  { value: 'all', label: 'All' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'overdue', label: 'Overdue' },
];
const TASK_VIEW_MODES = [
  { value: 'list', label: 'List', icon: 'list' },
  { value: 'kanban', label: 'Kanban', icon: 'view_kanban' },
];
const TASK_SORT_OPTIONS = [
  { value: 'dueDate', label: 'Due Date' },
  { value: 'priority', label: 'Priority' },
  { value: 'updatedAt', label: 'Updated' },
];
const TASK_COLUMN_OPTIONS = [
  { key: 'checkbox', label: 'Checkbox' },
  { key: 'priority', label: 'Priority Dot' },
  { key: 'title', label: 'Title' },
  { key: 'project', label: 'Project' },
  { key: 'priorityDropdown', label: 'Priority Dropdown' },
  { key: 'dueDate', label: 'Due Date' },
  { key: 'status', label: 'Status' },
  { key: 'timer', label: 'Timer' },
  { key: 'open', label: 'Open Button' },
];
const TASK_FILTER_PANEL_DEFAULTS = {
  sort: 'dueDate',
  groupBy: 'dueDate',
  archiveScope: 'all',
  issueTypeFilter: 'all',
};

const STATUS_OPTIONS = ['todo', 'in_progress', 'in_review', 'completed'];
const PRIORITY_OPTIONS = ['critical', 'high', 'medium', 'low'];
const KANBAN_COLUMN_PREFIX = 'kanban-column-';
const DEFAULT_VISIBLE_COLUMNS = ['priority', 'title', 'project', 'priorityDropdown', 'dueDate', 'status', 'timer', 'open'];
const ALLOWED_VISIBLE_COLUMNS = new Set(['checkbox', ...DEFAULT_VISIBLE_COLUMNS]);
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

function formatDropdownLabel(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function parseLocalDate(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const isoDateOnly = /^(\d{4})-(\d{2})-(\d{2})$/;
    const match = trimmed.match(isoDateOnly);
    if (match) {
      const [, y, m, d] = match;
      const date = new Date(Number(y), Number(m) - 1, Number(d));
      return Number.isNaN(date.getTime()) ? null : date;
    }
    const parsedIso = parseISO(trimmed);
    if (!Number.isNaN(parsedIso.getTime())) return parsedIso;
    const fallback = new Date(trimmed);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }
  const fallback = new Date(value);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

const PageDropdown = memo(function PageDropdown({
  value,
  options,
  onChange,
  disabled = false,
  className = '',
  triggerClassName = '',
  menuClassName = '',
  optionClassName = '',
  align = 'left',
  renderValue,
  renderOption,
  placement = 'auto',
}) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  const selectedOption = useMemo(
    () => (options || []).find((option) => String(option.value) === String(value)) || null,
    [options, value],
  );

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const viewportPadding = 12;
    const estimatedHeight = Math.min(320, ((options?.length || 0) * 40) + 12);
    const estimatedWidth = Math.max(rect.width, 180);
    const fitsBelow = rect.bottom + estimatedHeight + 12 <= window.innerHeight;
    const top = placement === 'top'
      ? Math.max(viewportPadding, rect.top - estimatedHeight - 8)
      : fitsBelow
        ? rect.bottom + 8
        : Math.max(viewportPadding, rect.top - estimatedHeight - 8);
    const width = Math.min(estimatedWidth, window.innerWidth - viewportPadding * 2);
    const leftBase = align === 'right' ? rect.right - width : rect.left;
    const left = Math.min(
      Math.max(viewportPadding, leftBase),
      window.innerWidth - width - viewportPadding,
    );

    setMenuStyle({
      position: 'fixed',
      top,
      left,
      width,
      zIndex: 1200,
    });
  }, [align, options?.length, placement]);

  useLayoutEffect(() => {
    if (!open) return undefined;
    updateMenuPosition();
    const handleResize = () => updateMenuPosition();
    const handleScroll = () => updateMenuPosition();
    const handlePointerDown = (event) => {
      if (triggerRef.current?.contains(event.target)) return;
      if (menuRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll, true);
    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll, true);
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, updateMenuPosition]);

  const resolvedValue = selectedOption ? (renderValue ? renderValue(selectedOption) : selectedOption.label) : renderValue ? renderValue(null) : formatDropdownLabel(value);

  return (
    <div className={`sv-page-dropdown ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        className={`sv-page-dropdown__trigger ${triggerClassName} ${open ? 'is-open' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
      >
        <span className="sv-page-dropdown__value">{resolvedValue}</span>
        <ChevronDown size={14} strokeWidth={2.5} className="sv-page-dropdown__chevron" />
      </button>

      {open && typeof document !== 'undefined'
        ? createPortal(
          <div
            ref={menuRef}
            className={`sv-page-dropdown__menu ${menuClassName}`}
            style={menuStyle || undefined}
            role="listbox"
          >
            {(options || []).map((option) => {
              const selected = String(option.value) === String(value);
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={`sv-page-dropdown__option ${selected ? 'is-selected' : ''} ${optionClassName}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onChange(option.value);
                    setOpen(false);
                  }}
                >
                  {renderOption ? renderOption(option, selected) : (
                    <>
                      <span className="sv-page-dropdown__option-check">{selected ? <Icon name="check" /> : null}</span>
                      <span className="sv-page-dropdown__option-label">{option.label}</span>
                    </>
                  )}
                </button>
              );
            })}
          </div>,
          document.body,
        )
        : null}
    </div>
  );
});

const WEEKDAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

const PageDatePicker = memo(function PageDatePicker({
  value,
  onChange,
  disabled = false,
  className = '',
  triggerClassName = '',
  menuClassName = '',
  placement = 'auto',
  align = 'left',
  placeholder = 'dd-mm-yyyy',
  displayFormat = 'dd MMM',
}) {
  const [open, setOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => parseLocalDate(value) || new Date());
  const [menuStyle, setMenuStyle] = useState(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  const selectedDate = useMemo(() => parseLocalDate(value), [value]);
  const displayValue = useMemo(() => {
    const parsed = parseLocalDate(value);
    if (!parsed) return placeholder;
    return format(parsed, displayFormat);
  }, [displayFormat, placeholder, value]);

  useEffect(() => {
    if (open) {
      setCalendarMonth(selectedDate || new Date());
    }
  }, [open, selectedDate]);

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const viewportPadding = 12;
    const estimatedWidth = 286;
    const estimatedHeight = 336;
    const fitsBelow = rect.bottom + estimatedHeight + 12 <= window.innerHeight;
    const top = placement === 'top'
      ? Math.max(viewportPadding, rect.top - estimatedHeight - 8)
      : fitsBelow
        ? rect.bottom + 8
        : Math.max(viewportPadding, rect.top - estimatedHeight - 8);
    const width = Math.min(Math.max(rect.width, estimatedWidth), window.innerWidth - viewportPadding * 2);
    const leftBase = align === 'right' ? rect.right - width : rect.left;
    const left = Math.min(
      Math.max(viewportPadding, leftBase),
      window.innerWidth - width - viewportPadding,
    );

    setMenuStyle({
      position: 'fixed',
      top,
      left,
      width,
      zIndex: 1220,
    });
  }, [align, placement]);

  useLayoutEffect(() => {
    if (!open) return undefined;
    updateMenuPosition();
    const handleResize = () => updateMenuPosition();
    const handleScroll = () => updateMenuPosition();
    const handlePointerDown = (event) => {
      if (triggerRef.current?.contains(event.target)) return;
      if (menuRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll, true);
    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll, true);
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, updateMenuPosition]);

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(calendarMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(calendarMonth), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [calendarMonth]);

  const handleSelect = useCallback((date) => {
    if (!date) return;
    onChange(format(date, 'yyyy-MM-dd'));
    setOpen(false);
  }, [onChange]);

  const handleClear = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    onChange('');
    setOpen(false);
  }, [onChange]);

  const handleToday = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    onChange(format(new Date(), 'yyyy-MM-dd'));
    setOpen(false);
  }, [onChange]);

  return (
    <div className={`sv-page-calendar ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        className={`sv-page-calendar__trigger ${triggerClassName} ${open ? 'is-open' : ''} ${selectedDate ? 'has-value' : 'is-empty'}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
      >
        <CalendarDays size={14} strokeWidth={2.2} className="sv-page-calendar__icon" />
        <span className="sv-page-calendar__value">{displayValue}</span>
        <ChevronDown size={14} strokeWidth={2.5} className="sv-page-calendar__chevron" />
      </button>

      {open && typeof document !== 'undefined'
        ? createPortal(
          <div
            ref={menuRef}
            className={`sv-page-calendar__menu ${menuClassName}`}
            style={menuStyle || undefined}
            role="dialog"
            aria-label="Select date"
          >
            <div className="sv-page-calendar__header">
              <button
                type="button"
                className="sv-page-calendar__nav"
                onClick={() => setCalendarMonth((current) => subMonths(current, 1))}
                aria-label="Previous month"
              >
                <ChevronLeft size={16} strokeWidth={2.4} />
              </button>
              <div className="sv-page-calendar__title">{format(calendarMonth, 'MMMM, yyyy')}</div>
              <button
                type="button"
                className="sv-page-calendar__nav"
                onClick={() => setCalendarMonth((current) => addMonths(current, 1))}
                aria-label="Next month"
              >
                <ChevronRight size={16} strokeWidth={2.4} />
              </button>
            </div>

            <div className="sv-page-calendar__weekdays">
              {WEEKDAY_LABELS.map((day) => (
                <span key={day} className="sv-page-calendar__weekday">{day}</span>
              ))}
            </div>

            <div className="sv-page-calendar__grid" role="grid">
              {calendarDays.map((day) => {
                const active = selectedDate ? isSameDay(day, selectedDate) : false;
                const inMonth = isSameMonth(day, calendarMonth);
                const currentDay = isToday(day);
                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    className={`sv-page-calendar__day ${active ? 'is-selected' : ''} ${!inMonth ? 'is-outside' : ''} ${currentDay ? 'is-today' : ''}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      handleSelect(day);
                    }}
                    aria-pressed={active}
                  >
                    {format(day, 'd')}
                  </button>
                );
              })}
            </div>

            <div className="sv-page-calendar__footer">
              <button type="button" className="sv-page-calendar__action" onClick={handleClear}>
                <X size={13} strokeWidth={2.5} />
                Clear
              </button>
              <button type="button" className="sv-page-calendar__action" onClick={handleToday}>
                Today
              </button>
            </div>
          </div>,
          document.body,
        )
        : null}
    </div>
  );
});

const SortableTaskRow = memo(function SortableTaskRow({
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
  showBlockedStatusIcon,
}) {
  const { setNodeRef, transform, transition, isDragging } = useSortable({ id: String(task._id) });

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
    if (visibleColumns.has('title')) cols.push('minmax(300px, 1.5fr)');
    if (visibleColumns.has('project')) cols.push('136px');
    if (visibleColumns.has('priorityDropdown')) cols.push('118px');
    if (visibleColumns.has('dueDate')) cols.push('136px');
    if (visibleColumns.has('status')) cols.push('136px');
    if (visibleColumns.has('timer')) cols.push('150px');
    if (visibleColumns.has('open')) cols.push('104px');
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
        <div className={`sv-task-title-cell flex items-center gap-2 ${titlePadClass}`}>
          <span className="rounded-lg bg-gradient-to-r from-surface-container to-surface-container-low px-2 py-0.5 text-[10px] font-semibold uppercase text-on-surface-variant shadow-sm">
            {issueType}
          </span>
          {task?.archived ? (
            <span className="rounded-lg bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-700">
              archived
            </span>
          ) : null}
          <span className="sv-task-title-text truncate text-sm font-semibold text-on-surface">
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
        <PageDropdown
          value={task.priority || 'medium'}
          options={PRIORITY_OPTIONS.map((value) => ({ value, label: formatDropdownLabel(value) }))}
          onChange={(nextValue) => onInlinePatch(task._id, { priority: nextValue })}
          className="sv-task-dropdown"
          triggerClassName="sv-task-mini-control sv-task-dropdown-trigger sv-task-dropdown-trigger--priority"
          renderValue={(option) => (option ? option.label : formatDropdownLabel(task.priority || 'medium'))}
          renderOption={(option, selected) => (
            <>
              <span className={`sv-page-dropdown__option-bullet ${selected ? 'is-selected' : ''} ${priorityDotClass(option.value)}`} />
              <span className="sv-page-dropdown__option-label">{option.label}</span>
            </>
          )}
        />
      )}

      {visibleColumns.has('dueDate') && (
        <PageDatePicker
          value={toDateInputValue(task.dueDate)}
          onChange={(nextValue) => onInlinePatch(task._id, { dueDate: nextValue || null })}
          className="sv-task-dropdown sv-task-dropdown--form"
          triggerClassName="sv-task-mini-control sv-task-date-trigger sv-task-mini-calendar-trigger"
        />
      )}

      {visibleColumns.has('status') && (
        <div className="sv-task-status-field">
          <PageDropdown
            value={task.status || 'todo'}
            options={STATUS_OPTIONS.map((value) => ({ value, label: formatDropdownLabel(value) }))}
            onChange={(nextValue) => onInlinePatch(task._id, { status: nextValue }, task)}
            className="sv-task-dropdown"
            triggerClassName={`sv-task-mini-control sv-task-dropdown-trigger sv-task-dropdown-trigger--status ${
              task.status === 'completed'
                ? 'is-completed'
                : task.status === 'in_progress'
                ? 'is-in-progress'
                : task.status === 'in_review'
                ? 'is-in-review'
                : 'is-todo'
            }`}
            renderValue={(option) => (option ? option.label : formatDropdownLabel(task.status || 'todo'))}
          />
          {showBlockedStatusIcon ? (
            <span className="sv-task-status-lock-icon" aria-label="Blocked status change">
              <Icon name="block" className="text-[12px]" />
            </span>
          ) : null}
        </div>
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
});

const TaskCard = memo(function TaskCard({
  task,
  selected,
  onInlinePatch,
  onTimerToggle,
  onTimerStop,
  isTimerActive,
  isTimerPaused,
  timerElapsedSeconds,
  timerState,
  onOpenTask,
  onUnarchiveTask,
  showBlockedStatusIcon,
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
          <PageDropdown
            value={task.priority || 'medium'}
            options={PRIORITY_OPTIONS.map((value) => ({ value, label: formatDropdownLabel(value) }))}
            onChange={(nextValue) => onInlinePatch(task._id, { priority: nextValue })}
            className="sv-task-dropdown"
            triggerClassName="sv-task-mini-control sv-task-card-control sv-task-dropdown-trigger sv-task-dropdown-trigger--priority"
            renderValue={(option) => (option ? option.label : formatDropdownLabel(task.priority || 'medium'))}
            renderOption={(option, selected) => (
              <>
                <span className={`sv-page-dropdown__option-bullet ${selected ? 'is-selected' : ''} ${priorityDotClass(option.value)}`} />
                <span className="sv-page-dropdown__option-label">{option.label}</span>
              </>
            )}
          />
          <PageDatePicker
            value={toDateInputValue(task.dueDate)}
            onChange={(nextValue) => onInlinePatch(task._id, { dueDate: nextValue || null })}
            className="sv-task-dropdown"
            triggerClassName="sv-task-mini-control sv-task-card-control sv-task-date-trigger sv-task-mini-calendar-trigger"
          />
          <PageDropdown
            value={task.status || 'todo'}
            options={STATUS_OPTIONS.map((value) => ({ value, label: formatDropdownLabel(value) }))}
            onChange={(nextValue) => onInlinePatch(task._id, { status: nextValue }, task)}
            className="sv-task-dropdown"
            triggerClassName={`sv-task-mini-control sv-task-card-control sv-task-dropdown-trigger sv-task-dropdown-trigger--status ${
              task.status === 'completed'
                ? 'is-completed'
                : task.status === 'in_progress'
                ? 'is-in-progress'
                : task.status === 'in_review'
                ? 'is-in-review'
                : 'is-todo'
            }`}
            renderValue={(option) => (option ? option.label : formatDropdownLabel(task.status || 'todo'))}
          />
          {showBlockedStatusIcon ? (
            <span className="sv-task-status-lock-icon" aria-label="Blocked status change">
              <Icon name="block" className="text-[12px]" />
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );
});

const SortableKanbanTaskCard = memo(function SortableKanbanTaskCard({
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
});

const KanbanDropZone = memo(function KanbanDropZone({ status, children }) {
  const { setNodeRef, isOver } = useDroppable({ id: `${KANBAN_COLUMN_PREFIX}${status}`, data: { type: 'column', status } });
  return (
    <div ref={setNodeRef} className={`p-3 d-flex flex-column gap-2 sv-kanban-scroll ${isOver ? 'sv-kanban-dropzone-over' : ''}`}>
      {children}
    </div>
  );
});

const GroupSection = memo(function GroupSection({
  groupKey,
  title,
  tasks,
  collapsed,
  onToggleGroup,
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
  blockedStatusTaskId,
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const itemIds = tasks.map((task) => String(task._id));
  const handleToggle = useCallback(() => onToggleGroup(groupKey), [groupKey, onToggleGroup]);

  return (
    <section className="sv-card rounded-4 overflow-hidden sv-task-group group">
      <button
        type="button"
        onClick={handleToggle}
        className="sv-task-group__toggle d-flex w-100 align-items-center justify-content-between px-3 px-lg-4 py-3 text-start border-0 bg-transparent"
      >
        <div className="flex items-center gap-3">
          <Icon name={collapsed ? 'chevron_right' : 'expand_more'} className="text-on-surface-variant transition-transform flex-shrink-0" />
          <p className="sv-task-group__title text-sm font-bold text-on-surface m-0">{title}</p>
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
                    showBlockedStatusIcon={String(blockedStatusTaskId) === String(task._id)}
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
});

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
  const [showSaveViewModal, setShowSaveViewModal] = useState(false);
  const [saveViewName, setSaveViewName] = useState('');
  const [savedViews, setSavedViews] = useState([]);
  const [activeViewId, setActiveViewId] = useState(null);
  const [showSavedViewsMenu, setShowSavedViewsMenu] = useState(false);
  const [blockedStatusTaskId, setBlockedStatusTaskId] = useState('');
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

  useEffect(() => {
    if (!blockedStatusTaskId) return undefined;
    const timeout = setTimeout(() => setBlockedStatusTaskId(''), 1400);
    return () => clearTimeout(timeout);
  }, [blockedStatusTaskId]);

  const totalOpen = Number(meta?.openCount || 0);
  const taskGroups = useMemo(() => groups || [], [groups]);
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

  const onQuickCreate = useCallback(async () => {
    if (!draft.title.trim()) return;
    await quickCreateTask({
      title: draft.title.trim(),
      dueDate: draft.dueDate || undefined,
      priority: draft.priority,
      projectId: projectId || undefined,
    });
    setDraft({ title: '', dueDate: '', priority: 'medium' });
    setShowQuickCreate(false);
  }, [draft, projectId, quickCreateTask]);

  const handleTimerToggle = useCallback(async (task) => {
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
  }, [isTimerActive, isTimerPaused, pauseTaskTimer, resumeTaskTimer, startTaskTimer, user?.id]);

  const handleTimerStop = useCallback(async (task) => {
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
  }, [stopTaskTimer, user?.id]);

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
  }, [focusedTaskId, handleTimerToggle, tasks]);

  const onFilterChange = useCallback(async (nextFilter) => {
    setFilter(nextFilter);
    const archiveQuery =
      archiveScope === 'archived'
        ? { includeArchived: 'true', onlyArchived: 'true' }
        : { includeArchived: 'false', onlyArchived: 'false' };
    await fetchTasks({ filter: nextFilter, sort, groupBy, issueType: issueTypeFilter === 'all' ? undefined : issueTypeFilter, ...archiveQuery });
  }, [archiveScope, fetchTasks, groupBy, issueTypeFilter, sort]);

  const onSortChange = useCallback(async (nextSort) => {
    setSort(nextSort);
    const archiveQuery =
      archiveScope === 'archived'
        ? { includeArchived: 'true', onlyArchived: 'true' }
        : { includeArchived: 'false', onlyArchived: 'false' };
    await fetchTasks({ filter, sort: nextSort, groupBy, issueType: issueTypeFilter === 'all' ? undefined : issueTypeFilter, ...archiveQuery });
  }, [archiveScope, fetchTasks, filter, groupBy, issueTypeFilter]);

  const onGroupByChange = useCallback(async (nextGroupBy) => {
    setGroupBy(nextGroupBy);
    const archiveQuery =
      archiveScope === 'archived'
        ? { includeArchived: 'true', onlyArchived: 'true' }
        : { includeArchived: 'false', onlyArchived: 'false' };
    await fetchTasks({ filter, sort, groupBy: nextGroupBy, issueType: issueTypeFilter === 'all' ? undefined : issueTypeFilter, ...archiveQuery });
  }, [archiveScope, fetchTasks, filter, issueTypeFilter, sort]);

  const onIssueTypeChange = useCallback(async (nextIssueType) => {
    setIssueTypeFilter(nextIssueType);
    const archiveQuery =
      archiveScope === 'archived'
        ? { includeArchived: 'true', onlyArchived: 'true' }
        : { includeArchived: 'false', onlyArchived: 'false' };
    await fetchTasks({ filter, sort, groupBy, issueType: nextIssueType === 'all' ? undefined : nextIssueType, ...archiveQuery });
  }, [archiveScope, fetchTasks, filter, groupBy, sort]);

  const onArchiveScopeChange = useCallback(async (nextScope) => {
    setArchiveScope(nextScope);
    const archiveQuery =
      nextScope === 'archived'
        ? { includeArchived: 'true', onlyArchived: 'true' }
        : { includeArchived: 'false', onlyArchived: 'false' };
    await fetchTasks({ filter, sort, groupBy, issueType: issueTypeFilter === 'all' ? undefined : issueTypeFilter, ...archiveQuery });
  }, [fetchTasks, filter, groupBy, issueTypeFilter, sort]);

  const handleUnarchiveTask = useCallback(async (task) => {
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
  }, [archiveScope, fetchTasks, filter, groupBy, issueTypeFilter, sort, workspaceId]);

  const selectAllTasks = useCallback(() => {
    const ids = (tasks || []).map((task) => String(task?._id || '')).filter(Boolean);
    setSelectedTaskIds(new Set(ids));
  }, [tasks]);

  const clearAllSelectedTasks = useCallback(() => {
    setSelectedTaskIds(new Set());
  }, []);

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

  const toggleSelected = useCallback((taskId) => {
    setSelectedTaskIds((current) => {
      const next = new Set(current);
      if (next.has(String(taskId))) next.delete(String(taskId));
      else next.add(String(taskId));
      return next;
    });
  }, []);

  const handleReorderInGroup = useCallback(async ({ taskId, newPosition, groupKey }) => {
    await reorderTask({ taskId, newPosition, groupKey });
  }, [reorderTask]);

  const handleInlinePatch = useCallback(
    async (taskId, patch, taskRow = null) => {
      if (!patch || typeof patch !== 'object') return;
      if (patch.status !== undefined) {
        const sourceTask = taskRow || taskById.get(String(taskId));
        const fromStatus = sourceTask?.status;
        const nextStatus = patch.status;
        if (isCompletedReopenBlocked(fromStatus, nextStatus)) {
          setToast({ type: 'error', message: LOCKED_STATUS_MESSAGE });
          setBlockedStatusTaskId(String(taskId));
          return;
        }
      }
      await updateMyTask(taskId, patch);
    },
    [taskById, updateMyTask],
  );

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
      const movingTask = taskById.get(activeId);
      if (isCompletedReopenBlocked(movingTask?.status, targetStatus)) {
        setKanbanOrder(previousOrder);
        setToast({ type: 'error', message: LOCKED_STATUS_MESSAGE });
        return;
      }
      await updateMyTask(activeId, { status: targetStatus });
      await reorderTask({ taskId: activeId, newPosition: clampedIndex, groupKey: targetStatus });
      setToast({ type: 'success', message: `Moved to ${targetStatus.replace('_', ' ')}` });
    } catch (error) {
      setKanbanOrder(previousOrder);
      setToast({ type: 'error', message: error.message || 'Failed to move task' });
    }
  };

  const handleSaveView = useCallback(() => {
    setSaveViewName('');
    setShowSaveViewModal(true);
  }, []);

  const confirmSaveView = useCallback(() => {
    const viewName = saveViewName.trim();
    if (!viewName) return;

    const newView = {
      id: Date.now().toString(),
      name: viewName,
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
    setShowSaveViewModal(false);
  }, [archiveScope, filter, groupBy, issueTypeFilter, saveViewName, savedViews, sort, viewMode, visibleColumns]);

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
  const kanbanColumns = useMemo(() => (
    STATUS_OPTIONS.map((status) => {
      const taskIds = kanbanOrder[status] || [];
      const tasksForStatus = taskIds
        .map((id) => taskById.get(String(id)))
        .filter(isRenderableKanbanTask);
      return {
        status,
        title: status.replace('_', ' '),
        taskIds,
        tasks: tasksForStatus,
      };
    })
  ), [kanbanOrder, taskById]);

  const toggleCollapsedGroup = useCallback((groupKey) => {
    setCollapsed((current) => ({ ...current, [groupKey]: !current[groupKey] }));
  }, []);

  const openTask = useCallback((taskRow) => {
    navigate(`/tasks/${taskRow._id || taskRow.id}`);
  }, [navigate]);

  const visibleColumnCount = visibleColumns.size;

  return (
    <main className="container-fluid px-0 py-3 py-lg-4 sv-mytasks-page">
      <div className="sv-mytasks-container">
        <section className="sv-card sv-mytasks-header p-3 p-lg-4">
          <div className="d-flex flex-column flex-xl-row align-items-xl-center justify-content-between gap-3 mb-3 sv-mytasks-page-head">
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
                {TASK_VIEW_MODES.map((mode) => (
                  <button
                    key={mode.value}
                    type="button"
                    onClick={() => setViewMode(mode.value)}
                    className={`btn btn-sm ${viewMode === mode.value ? 'btn-primary' : 'btn-outline-secondary'} sv-ctl-btn`}
                    title={`${mode.label} view`}
                    aria-pressed={viewMode === mode.value}
                  >
                    <Icon name={mode.icon} className="me-1" />
                    {mode.label}
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
            {TASK_FILTER_TABS.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => onFilterChange(item.value)}
                className={`btn btn-sm sv-filter-chip ${filter === item.value ? 'btn-primary' : 'btn-outline-secondary'}`}
              >
                {item.label}
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
            <PageDatePicker
          value={draft.dueDate}
          onChange={(nextValue) => setDraft((current) => ({ ...current, dueDate: nextValue }))}
          className="sv-task-dropdown sv-task-dropdown--form"
          triggerClassName="sv-ctl-select sv-custom-select-trigger sv-task-date-trigger w-100"
          placeholder="Due date"
          displayFormat="dd MMM"
        />
            <PageDropdown
              value={draft.priority}
              options={PRIORITY_OPTIONS.map((value) => ({ value, label: formatDropdownLabel(value) }))}
              onChange={(nextValue) => setDraft((current) => ({ ...current, priority: nextValue }))}
              className="sv-task-dropdown sv-task-dropdown--form"
              triggerClassName="sv-ctl-select sv-custom-select-trigger"
              renderValue={(option) => (option ? option.label : formatDropdownLabel(draft.priority))}
            />
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
          {viewMode === 'list' && taskGroups.map((group) => (
            <GroupSection
              key={group.key || group.label}
              groupKey={group.key}
              title={group.label}
              tasks={group.items}
              collapsed={Boolean(collapsed[group.key || group.label])}
              onToggleGroup={toggleCollapsedGroup}
              focusedTaskId={focusedTaskId}
              onFocusTask={setFocusedTaskId}
              selected={selectedTaskIds}
              onToggleSelected={toggleSelected}
              onInlinePatch={handleInlinePatch}
              onTimerToggle={handleTimerToggle}
              onTimerStop={handleTimerStop}
              isTimerActive={isTimerActive}
              isTimerPaused={isTimerPaused}
              getTaskElapsedSeconds={getTaskElapsedSeconds}
              timerState={timerState}
              onReorder={handleReorderInGroup}
              onOpenTask={openTask}
              onUnarchiveTask={handleUnarchiveTask}
              visibleColumns={visibleColumns}
              blockedStatusTaskId={blockedStatusTaskId}
            />
          ))}

          {viewMode === 'kanban' && (
            <DndContext sensors={kanbanSensors} collisionDetection={closestCenter} onDragEnd={handleKanbanDragEnd}>
              <div className="sv-kanban-board d-flex gap-3 pb-2">
                {kanbanColumns.map((column) => {
                  return (
                    <div key={column.status} className="sv-card rounded-4 overflow-hidden sv-kanban-column">
                      <div className="sv-kanban-column-header px-3 py-3 border-bottom">
                        <div className="d-flex align-items-center justify-content-between">
                          <h3 className="sv-kanban-column-title text-sm font-bold text-on-surface capitalize">{column.title}</h3>
                          <span className="sv-kanban-column-count rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold text-primary border border-primary/20">
                            {column.tasks.length}
                          </span>
                        </div>
                      </div>
                      <KanbanDropZone status={column.status}>
                        <SortableContext items={column.taskIds} strategy={verticalListSortingStrategy}>
                          {column.tasks.length ? (
                            column.tasks.map((task) => (
                              <SortableKanbanTaskCard
                                key={task._id}
                                status={column.status}
                                task={task}
                                selected={selectedTaskIds}
                                onToggleSelected={toggleSelected}
                                onInlinePatch={handleInlinePatch}
                                onTimerToggle={handleTimerToggle}
                                onTimerStop={handleTimerStop}
                                isTimerActive={isTimerActive(String(task._id))}
                                isTimerPaused={isTimerPaused(String(task._id))}
                                timerElapsedSeconds={getTaskElapsedSeconds(String(task._id))}
                                timerState={timerState}
                                onOpenTask={openTask}
                                onUnarchiveTask={handleUnarchiveTask}
                                showBlockedStatusIcon={String(blockedStatusTaskId) === String(task._id)}
                              />
                            ))
                          ) : (
                            <div className="sv-kanban-empty-state">
                              <div className="sv-kanban-empty-state__icon">
                                <Icon name="inbox" />
                              </div>
                              <p className="sv-kanban-empty-state__title">No tasks here</p>
                              <p className="sv-kanban-empty-state__text">Drop a task into this column or create a new one.</p>
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

          {!taskGroups.length && !loading && viewMode === 'list' ? (
            <div className="sv-card rounded-4 border border-dashed p-4 p-lg-5 text-center sv-task-empty-state">
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

      {showSaveViewModal && (
        <div className="position-fixed top-0 start-0 end-0 bottom-0 z-50 d-flex align-items-center justify-content-center sv-modal-backdrop">
          <div className="sv-card w-100 sv-modal-panel sv-modal-panel--saveview p-4">
            <div className="sv-modal-header sv-modal-header--saveview">
              <div>
                <h2 className="h5 mb-1 fw-bold sv-heading">Save View</h2>
                <p className="sv-modal-note mb-0">Name this layout to return to it later.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowSaveViewModal(false)}
                className="sv-modal-close-btn"
              >
                <Icon name="close" />
              </button>
            </div>

            <div className="sv-modal-body-scroll sv-saveview-body">
              <label className="form-label small fw-semibold mb-1">View Name</label>
              <input
                type="text"
                value={saveViewName}
                onChange={(event) => setSaveViewName(event.target.value)}
                placeholder="e.g. My Work Today"
                className="sv-saveview-input form-control"
                autoFocus
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    confirmSaveView();
                  }
                }}
              />
            </div>

            <div className="sv-saveview-actions">
              <button
                type="button"
                onClick={() => setShowSaveViewModal(false)}
                className="btn btn-sm btn-outline-secondary sv-saveview-btn"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmSaveView}
                disabled={!saveViewName.trim()}
                className="btn btn-sm btn-primary sv-saveview-btn"
              >
                Save View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Column Customizer Modal */}
      {showColumnCustomizer && (
        <div className="position-fixed top-0 start-0 end-0 bottom-0 z-50 d-flex align-items-center justify-content-center sv-modal-backdrop">
          <div className="sv-card w-100 sv-modal-panel sv-modal-panel--compact p-4">
            <div className="sv-modal-header">
              <div>
                <h2 className="h5 mb-1 fw-bold sv-heading">Customize Columns</h2>
                <p className="sv-modal-note mb-0">Choose which fields are visible in the task board.</p>
              </div>
              <span className="sv-modal-pill">{visibleColumnCount} shown</span>
            </div>
            <div className="sv-modal-body-scroll sv-column-grid">
              {TASK_COLUMN_OPTIONS.map((column) => (
                <label key={column.key} className="sv-column-option">
                  <span className="sv-column-option__check">
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
                  </span>
                  <span className="sv-column-option__body">
                    <span className="sv-column-option__title">{column.label}</span>
                    <span className="sv-column-option__meta">
                      {column.key === 'checkbox' ? 'Select multiple tasks quickly' : 'Shown in task list and board cards'}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            <div className="mt-4 d-flex gap-2">
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
            <button
              type="button"
              onClick={() => setShowColumnCustomizer(false)}
              className="sv-modal-close-btn sv-modal-close-btn--floating"
            >
              <Icon name="close" />
            </button>
          </div>
        </div>
      )}

      {/* Filter Panel Modal */}
      {showFilterPanel && (
        <div className="position-fixed top-0 start-0 end-0 bottom-0 z-50 d-flex align-items-center justify-content-center sv-modal-backdrop">
          <div className="sv-card w-100 sv-modal-panel-lg sv-modal-panel--filters p-4">
            <div className="sv-modal-header">
              <div>
                <h2 className="h5 mb-1 fw-bold sv-heading">Advanced Filters</h2>
                <p className="sv-modal-note mb-0">Refine sort order, grouping, and which tasks are shown.</p>
              </div>
              <span className="sv-modal-pill">{TASK_SORT_OPTIONS.length + GROUP_MODES.length} controls</span>
            </div>
            <div className="sv-modal-body-scroll">
              <div className="sv-filter-grid">
                <div className="sv-filter-field">
                  <label className="form-label small fw-semibold mb-1">Sort By</label>
                  <PageDropdown
                    value={sort}
                    options={TASK_SORT_OPTIONS}
                    onChange={onSortChange}
                    className="sv-task-dropdown sv-task-dropdown--form"
                    triggerClassName="sv-ctl-select sv-custom-select-trigger w-100"
                    renderValue={(option) => (option ? option.label : 'Due Date')}
                  />
                </div>
                <div className="sv-filter-field">
                  <label className="form-label small fw-semibold mb-1">Group By</label>
                  <PageDropdown
                    value={groupBy}
                    options={GROUP_MODES}
                    onChange={onGroupByChange}
                    className="sv-task-dropdown sv-task-dropdown--form"
                    triggerClassName="sv-ctl-select sv-custom-select-trigger w-100"
                    renderValue={(option) => (option ? option.label : 'Due Date')}
                  />
                </div>
                <div className="sv-filter-field">
                  <label className="form-label small fw-semibold mb-1">Archive Scope</label>
                  <PageDropdown
                    value={archiveScope}
                    options={[
                      { value: 'all', label: 'All (Active)' },
                      { value: 'archived', label: 'Archived only' },
                    ]}
                    onChange={onArchiveScopeChange}
                    className="sv-task-dropdown sv-task-dropdown--form"
                    triggerClassName="sv-ctl-select sv-custom-select-trigger w-100"
                    renderValue={(option) => (option ? option.label : 'All (Active)')}
                  />
                </div>
                <div className="sv-filter-field">
                  <label className="form-label small fw-semibold mb-1">Issue Type</label>
                  <PageDropdown
                    value={issueTypeFilter}
                    options={[
                      { value: 'all', label: 'All types' },
                      { value: 'epic', label: 'Epic' },
                      { value: 'task', label: 'Task' },
                      { value: 'subtask', label: 'Subtask' },
                    ]}
                    onChange={onIssueTypeChange}
                    className="sv-task-dropdown sv-task-dropdown--form"
                    triggerClassName="sv-ctl-select sv-custom-select-trigger w-100"
                    renderValue={(option) => (option ? option.label : 'All types')}
                  />
                </div>
              </div>
            </div>
            <div className="mt-4 d-flex gap-2">
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
            <button
              type="button"
              onClick={() => setShowFilterPanel(false)}
              className="sv-modal-close-btn sv-modal-close-btn--floating"
            >
              <Icon name="close" />
            </button>
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
