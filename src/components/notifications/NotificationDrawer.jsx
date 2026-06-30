import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { isThisWeek, isToday, isYesterday } from 'date-fns';
import { List } from 'react-window';
import { ArchiveRestore, Inbox, LoaderCircle, MailOpen, X } from 'lucide-react';
import NotificationItem from './NotificationItem';

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'mentions', label: 'Mentions' },
  { value: 'assignments', label: 'Assignments' },
  { value: 'updates', label: 'Updates' },
  { value: 'system', label: 'System' },
];

function classifyFilter(item) {
  if (item.type === 'mention') return 'mentions';
  if (item.type === 'task_assigned' || item.type === 'lead_assigned') return 'assignments';
  if (item.type === 'task_due_soon' || item.type === 'comment' || item.type === 'sprint_started') return 'updates';
  return 'system';
}

function classifyGroup(item) {
  const timestamp = item.createdAt ? new Date(item.createdAt) : new Date();
  if (isToday(timestamp)) return 'Today';
  if (isYesterday(timestamp)) return 'Yesterday';
  if (isThisWeek(timestamp, { weekStartsOn: 1 })) return 'This Week';
  return 'Earlier';
}

function useGroupedRows(items, selectedFilter) {
  return useMemo(() => {
    const source = Array.isArray(items) ? items : [];
    const filtered =
      selectedFilter === 'all' ? source : source.filter((item) => classifyFilter(item) === selectedFilter);
    const groups = new Map();
    for (const item of filtered) {
      const group = classifyGroup(item);
      if (!groups.has(group)) {
        groups.set(group, []);
      }
      groups.get(group).push(item);
    }

    const orderedGroups = ['Today', 'Yesterday', 'This Week', 'Earlier'];
    const rows = [];
    for (const groupName of orderedGroups) {
      const groupItems = groups.get(groupName) || [];
      if (!groupItems.length) continue;
      rows.push({ type: 'header', id: `header-${groupName}`, label: groupName });
      for (const item of groupItems) {
        rows.push({ type: 'item', id: String(item._id), item });
      }
    }
    return rows;
  }, [items, selectedFilter]);
}

function DrawerRow({ index, style, rows, onDelete }) {
  const row = rows?.[index];
  if (!row) return null;

  if (row.type === 'header') {
    return (
      <div style={style} className="sv-notifications-section-header">
        {row.label}
      </div>
    );
  }

  return (
    <div style={style}>
      <NotificationItem item={row.item} onDelete={onDelete} />
    </div>
  );
}

function NotificationDrawer({
  open,
  items,
  loading,
  error,
  hasNextPage,
  loadingMore,
  onClose,
  onReadAll,
  onDelete,
  onLoadMore,
}) {
  const panelRef = useRef(null);
  const filtersTrackRef = useRef(null);
  const filterButtonRefs = useRef({});
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [filterIndicator, setFilterIndicator] = useState({ left: 0, width: 0, ready: false });
  const [rendered, setRendered] = useState(open);
  const [visible, setVisible] = useState(open);
  const rows = useGroupedRows(items, selectedFilter);
  const deletingAllRef = useRef(false);
  const unreadCount = useMemo(
    () => (Array.isArray(items) ? items.reduce((count, item) => count + Number(!(item.read ?? item.isRead)), 0) : 0),
    [items],
  );

  useEffect(() => {
    if (open) {
      setRendered(true);
      const frame = window.requestAnimationFrame(() => setVisible(true));
      return () => window.cancelAnimationFrame(frame);
    }

    setVisible(false);
    const timeout = window.setTimeout(() => setRendered(false), 220);
    return () => window.clearTimeout(timeout);
  }, [open]);

  useEffect(() => {
    if (!rendered) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [rendered]);

  useEffect(() => {
    if (!rendered) return;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [rendered, onClose]);

  useEffect(() => {
    if (!rendered || !hasNextPage || loadingMore) {
      return;
    }
    const itemRows = rows.filter((row) => row.type === 'item').length;
    if (itemRows < 25) {
      onLoadMore();
    }
  }, [rendered, hasNextPage, loadingMore, rows, onLoadMore]);

  useEffect(() => {
    if (!rendered) return;

    const syncIndicator = () => {
      const track = filtersTrackRef.current;
      const activeButton = filterButtonRefs.current[selectedFilter];
      if (!track || !activeButton) return;
      const trackRect = track.getBoundingClientRect();
      const buttonRect = activeButton.getBoundingClientRect();
      setFilterIndicator({
        left: buttonRect.left - trackRect.left + track.scrollLeft + 3,
        width: Math.max(0, buttonRect.width - 6),
        ready: true,
      });
    };

    const frame = window.requestAnimationFrame(syncIndicator);
    const ro = new ResizeObserver(syncIndicator);
    if (filtersTrackRef.current) ro.observe(filtersTrackRef.current);
    Object.values(filterButtonRefs.current).forEach((button) => {
      if (button) ro.observe(button);
    });
    window.addEventListener('resize', syncIndicator);

    return () => {
      window.cancelAnimationFrame(frame);
      ro.disconnect();
      window.removeEventListener('resize', syncIndicator);
    };
  }, [rendered, selectedFilter]);

  const handleClearAll = async () => {
    if (deletingAllRef.current) return;
    const deletableIds = (Array.isArray(items) ? items : [])
      .map((item) => String(item?._id || ''))
      .filter(Boolean);
    if (!deletableIds.length) return;
    const confirmed = window.confirm(`Clear ${deletableIds.length} loaded notifications?`);
    if (!confirmed) return;

    deletingAllRef.current = true;
    try {
      await Promise.all(deletableIds.map((id) => onDelete(id)));
    } finally {
      deletingAllRef.current = false;
    }
  };

  if (!rendered) return null;

  return createPortal(
    <div className={`sv-notifications-layer fixed inset-0 z-[60] ${visible ? 'is-visible' : ''}`} role="presentation">
      <button
        type="button"
        className="sv-notifications-backdrop absolute inset-0 bg-black/20"
        aria-label="Close notifications drawer"
        onClick={onClose}
      />
      <aside
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Notifications"
        className="sv-notifications-drawer absolute right-0 top-0 h-full w-[400px] border-l border-outline-variant bg-surface-container-lowest shadow-xl outline-none"
      >
        <div className="sv-notifications-head">
          <div className="sv-notifications-head-top">
            <h3 className="sv-notifications-title">Notifications</h3>
            <button type="button" onClick={onClose} className="sv-notifications-close" aria-label="Close notifications drawer">
              <X size={16} />
            </button>
          </div>

          <div className="sv-notifications-head-actions">
            <button
              type="button"
              onClick={handleClearAll}
              className="sv-notifications-clearall"
            >
              <ArchiveRestore size={13} />
              Clear all
            </button>
            <button type="button" onClick={onReadAll} className="sv-notifications-markall">
              <MailOpen size={13} />
              Mark all read
            </button>
          </div>
        </div>

        <div className="sv-notifications-filters" ref={filtersTrackRef}>
          <span
            className={`sv-notifications-filter-indicator ${filterIndicator.ready ? 'is-ready' : ''}`}
            style={{
              width: `${filterIndicator.width}px`,
              transform: `translateX(${Math.round(filterIndicator.left)}px)`,
            }}
            aria-hidden="true"
          />
          {FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              ref={(node) => {
                if (node) {
                  filterButtonRefs.current[filter.value] = node;
                }
              }}
              onClick={() => setSelectedFilter(filter.value)}
              className={`sv-notifications-filter-chip rounded-full px-2.5 py-1 text-[11px] font-medium ${
                selectedFilter === filter.value ? 'is-active text-on-surface' : 'text-on-surface-variant'
              }`}
              aria-pressed={selectedFilter === filter.value}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div className="sv-notifications-body">
          {loading ? (
            <div className="sv-notifications-loading">
              <LoaderCircle className="sv-spin" size={18} />
              <p>Loading notifications...</p>
            </div>
          ) : null}

          {!loading && error ? (
            <div className="flex h-full items-center justify-center px-6">
              <p className="text-sm text-error">{error}</p>
            </div>
          ) : null}

          {!loading && !error && !rows.length ? (
            <div className="sv-notifications-empty">
              <span className="sv-notifications-empty-icon" aria-hidden="true">
                <Inbox size={22} />
              </span>
              <p>You&apos;re all caught up</p>
              <small>No new updates need your attention right now.</small>
              {unreadCount ? <span>{unreadCount} unread notifications</span> : null}
            </div>
          ) : null}

          {!loading && !error && rows.length ? (
            <div className="sv-notifications-list">
              <List
                rowComponent={DrawerRow}
                rowCount={rows.length}
                rowHeight={(index) => (rows[index]?.type === 'header' ? 36 : 118)}
                rowProps={{ rows, onDelete }}
                style={{ height: '100%', width: '100%' }}
                onRowsRendered={({ stopIndex }) => {
                  if (!hasNextPage || loadingMore) return;
                  if (stopIndex >= rows.length - 6) {
                    onLoadMore();
                  }
                }}
              />
            </div>
          ) : null}
        </div>
      </aside>
    </div>,
    document.body,
  );
}

export default NotificationDrawer;
