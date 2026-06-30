import { formatDistanceToNow } from 'date-fns';
import {
  Bell,
  CheckSquare2,
  CircleAlert,
  CircleDashed,
  CircleUserRound,
  Clock3,
  MessageSquareMore,
  Rocket,
  X,
} from 'lucide-react';

function iconByType(type) {
  switch (type) {
    case 'mention':
      return CircleUserRound;
    case 'task_assigned':
      return CheckSquare2;
    case 'task_due_soon':
      return Clock3;
    case 'lead_assigned':
      return Bell;
    case 'sprint_started':
      return Rocket;
    case 'comment':
      return MessageSquareMore;
    case 'system':
      return CircleAlert;
    default:
      return CircleDashed;
  }
}

function NotificationItem({ item, onDelete }) {
  const isRead = Boolean(item.read ?? item.isRead);
  const TypeIcon = iconByType(item.type);
  const relativeTime = item.createdAt
    ? formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })
    : 'just now';

  return (
    <article className={`sv-notification-item ${isRead ? '' : 'is-unread'}`}>
      <div className="sv-notification-icon">
        <TypeIcon size={16} strokeWidth={2.2} />
      </div>
      <div className="sv-notification-content">
        <div className="sv-notification-title-row">
          <p className="sv-notification-title">{item.title || 'Notification'}</p>
          {!isRead ? <span aria-label="Unread" className="sv-notification-dot" /> : null}
        </div>
        <p className="sv-notification-body">{item.body || ''}</p>
        <div className="sv-notification-meta">
          <span className="sv-notification-time">{relativeTime}</span>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onDelete(item._id)}
        className="sv-notification-remove-btn"
        aria-label="Dismiss notification"
        title="Dismiss"
      >
        <X size={14} />
      </button>
    </article>
  );
}

export default NotificationItem;
