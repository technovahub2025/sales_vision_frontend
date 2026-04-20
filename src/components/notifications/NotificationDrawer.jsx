import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { isThisWeek, isToday, isYesterday } from 'date-fns';
import { List } from 'react-window';
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

function DrawerRow({ index, style, rows, onRead, onDelete }) {
  const row = rows?.[index];
  if (!row) return null;

  if (row.type === 'header') {
    return (
      <div style={style} className="flex items-center border-b border-outline-variant/10 bg-surface-container-low px-4 text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">
        {row.label}
      </div>
    );
  }

  return (
    <div style={style}>
      <NotificationItem item={row.item} onRead={onRead} onDelete={onDelete} />
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
  onRead,
  onReadAll,
  onDelete,
  onLoadMore,
}) {
  const panelRef = useRef(null);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const rows = useGroupedRows(items, selectedFilter);
  const deletingAllRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !hasNextPage || loadingMore) {
      return;
    }
    const itemRows = rows.filter((row) => row.type === 'item').length;
    if (itemRows < 25) {
      onLoadMore();
    }
  }, [open, hasNextPage, loadingMore, rows, onLoadMore]);

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

  if (!open) return null;

  return createPortal(
    <div className="sv-notifications-layer fixed inset-0 z-[60]" role="presentation">
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
        <div className="sv-notifications-head flex items-start justify-between border-b border-outline-variant/10 px-4 py-3">
          <h3 className="sv-notifications-title text-sm font-semibold text-on-surface">Notifications</h3>
          <div className="sv-notifications-head-actions">
            <button
              type="button"
              onClick={handleClearAll}
              className="sv-notifications-clearall text-xs fw-semibold"
            >
              Clear all
            </button>
            <button type="button" onClick={onReadAll} className="sv-notifications-markall text-xs font-semibold text-primary">
              Mark all read
            </button>
          </div>
        </div>

        <div className="sv-notifications-filters flex gap-2 border-b border-outline-variant/10 px-3 py-2">
          {FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => setSelectedFilter(filter.value)}
              className={`sv-notifications-filter-chip rounded-full px-2.5 py-1 text-[11px] font-medium ${
                selectedFilter === filter.value
                  ? 'is-active bg-primary text-on-primary'
                  : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
              }`}
              aria-pressed={selectedFilter === filter.value}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div className="sv-notifications-body">
          {loading ? (
            <div className="sv-notifications-loading space-y-2 px-4 py-4">
              <div className="h-12 animate-pulse rounded-lg bg-surface-container" />
              <div className="h-12 animate-pulse rounded-lg bg-surface-container" />
              <div className="h-12 animate-pulse rounded-lg bg-surface-container" />
            </div>
          ) : null}

          {!loading && error ? (
            <div className="flex h-full items-center justify-center px-6">
              <p className="text-sm text-error">{error}</p>
            </div>
          ) : null}

          {!loading && !error && !rows.length ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-on-surface-variant">You&apos;re all caught up</p>
            </div>
          ) : null}

          {!loading && !error && rows.length ? (
            <div className="sv-notifications-list">
              <List
                rowComponent={DrawerRow}
                rowCount={rows.length}
                rowHeight={(index) => (rows[index]?.type === 'header' ? 32 : 82)}
                rowProps={{ rows, onRead, onDelete }}
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
