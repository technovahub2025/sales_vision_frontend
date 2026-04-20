import { formatDistanceToNow } from 'date-fns';
import Icon from '../ui/Icon';

function iconByType(type) {
  switch (type) {
    case 'mention':
      return 'alternate_email';
    case 'task_assigned':
      return 'task';
    case 'task_due_soon':
      return 'schedule';
    case 'lead_assigned':
      return 'account_circle';
    case 'sprint_started':
      return 'rocket_launch';
    default:
      return 'notifications';
  }
}

function NotificationItem({ item, onRead, onDelete }) {
  const isRead = Boolean(item.read ?? item.isRead);
  const relativeTime = item.createdAt
    ? formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })
    : 'just now';

  return (
    <article className="flex h-full items-start gap-3 border-b border-outline-variant/10 px-4 py-3">
      <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon name={iconByType(item.type)} className="text-sm" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-on-surface">{item.title || 'Notification'}</p>
        <p className="truncate text-xs text-on-surface-variant">{item.body || ''}</p>
        <p className="mt-1 text-[11px] text-on-surface-variant">{relativeTime}</p>
      </div>
      {!isRead ? <span aria-label="Unread" className="mt-1 h-2 w-2 rounded-full bg-error" /> : null}
      {!isRead ? (
        <button type="button" onClick={() => onRead(item._id)} className="text-xs font-semibold text-primary">
          Read
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => onDelete(item._id)}
        className="sv-notification-remove-btn"
        aria-label="Remove notification"
        title="Remove"
      >
        <Icon name="close" className="text-sm" />
      </button>
    </article>
  );
}

export default NotificationItem;
