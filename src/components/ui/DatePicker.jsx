import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react';

const WEEKDAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

function parseLocalDate(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
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

const DatePicker = memo(function DatePicker({
  value,
  onChange,
  disabled = false,
  className = '',
  triggerClassName = '',
  menuClassName = '',
  placement = 'auto',
  align = 'left',
  placeholder = 'dd-mm-yyyy',
  displayFormat = 'dd MMM yyyy',
  ariaLabel = 'Select date',
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
    if (open) setCalendarMonth(selectedDate || new Date());
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
    const left = Math.min(Math.max(viewportPadding, leftBase), window.innerWidth - width - viewportPadding);

    setMenuStyle({ position: 'fixed', top, left, width, zIndex: 1220 });
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
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
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

  const selectDate = useCallback((date) => {
    onChange(format(date, 'yyyy-MM-dd'));
    setOpen(false);
    triggerRef.current?.focus();
  }, [onChange]);

  const clearDate = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    onChange('');
    setOpen(false);
    triggerRef.current?.focus();
  }, [onChange]);

  const selectToday = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    selectDate(new Date());
  }, [selectDate]);

  return (
    <div className={`sv-page-calendar ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        className={`sv-page-calendar__trigger ${triggerClassName} ${open ? 'is-open' : ''} ${selectedDate ? 'has-value' : 'is-empty'}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
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
            aria-label={ariaLabel}
          >
            <div className="sv-page-calendar__header">
              <button type="button" className="sv-page-calendar__nav" onClick={() => setCalendarMonth((current) => subMonths(current, 1))} aria-label="Previous month">
                <ChevronLeft size={16} strokeWidth={2.4} />
              </button>
              <div className="sv-page-calendar__title">{format(calendarMonth, 'MMMM, yyyy')}</div>
              <button type="button" className="sv-page-calendar__nav" onClick={() => setCalendarMonth((current) => addMonths(current, 1))} aria-label="Next month">
                <ChevronRight size={16} strokeWidth={2.4} />
              </button>
            </div>

            <div className="sv-page-calendar__weekdays">
              {WEEKDAY_LABELS.map((day) => <span key={day} className="sv-page-calendar__weekday">{day}</span>)}
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
                      selectDate(day);
                    }}
                    aria-pressed={active}
                  >
                    {format(day, 'd')}
                  </button>
                );
              })}
            </div>

            <div className="sv-page-calendar__footer">
              <button type="button" className="sv-page-calendar__action" onClick={clearDate}>
                <X size={13} strokeWidth={2.5} />
                Clear
              </button>
              <button type="button" className="sv-page-calendar__action" onClick={selectToday}>
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

export default DatePicker;
