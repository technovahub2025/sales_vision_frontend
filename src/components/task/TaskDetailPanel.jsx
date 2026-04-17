import { useQuery } from '@tanstack/react-query';
import { tasksApi } from '../../api';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import AttachmentZone from '../attachments/AttachmentZone';
import TimerButton from '../timer/TimerButton';
import CommentThread from '../comments/CommentThread';

function TaskDetailPanel({ open, task, onClose }) {
  const { workspaceId } = useWorkspace();
  const taskId = task?._id || task?.id;

  const attachmentsQuery = useQuery({
    queryKey: ['attachments', 'task', String(taskId || '')],
    enabled: Boolean(open && workspaceId && taskId),
    queryFn: () => tasksApi.listAttachments(workspaceId, taskId).then((res) => res.data || []),
  });

  const onDeleteAttachment = async (attachment) => {
    if (!workspaceId || !taskId || !attachment?._id) return;
    await tasksApi.removeAttachment(workspaceId, taskId, attachment._id);
    attachmentsQuery.refetch();
  };

  if (!open || !task) return null;

  return (
    <div className="fixed inset-0 z-[70]">
      <button type="button" onClick={onClose} className="absolute inset-0 bg-black/20" />
      <aside className="absolute right-0 top-0 h-full w-full max-w-3xl overflow-y-auto bg-surface-container-lowest shadow-none">
        <div className="sticky top-0 flex items-center justify-between border-b border-outline-variant/10 bg-surface-container-lowest px-6 py-4">
          <h3 className="text-lg font-semibold text-on-surface">{task.title}</h3>
          <button type="button" onClick={onClose} className="text-sm font-semibold text-on-surface-variant">
            Close
          </button>
        </div>
        <div className="space-y-6 p-6">
          <p className="text-sm text-on-surface-variant">{task.description || 'No description'}</p>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-surface-container px-2 py-0.5 text-xs font-semibold uppercase">
              {task.status}
            </span>
            <span className="rounded-full bg-surface-container px-2 py-0.5 text-xs font-semibold uppercase">
              {task.priority}
            </span>
            <TimerButton taskId={task._id || task.id} />
          </div>
          <div>
            <p className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-on-surface">Attachments</p>
            {attachmentsQuery.isLoading ? (
              <div className="space-y-2">
                <div className="h-12 animate-pulse rounded-lg bg-surface-container" />
                <div className="h-12 animate-pulse rounded-lg bg-surface-container" />
              </div>
            ) : attachmentsQuery.isError ? (
              <p className="text-xs text-error">Failed to load attachments.</p>
            ) : (
              <AttachmentZone
                workspaceId={workspaceId}
                entityType="task"
                entityId={taskId}
                attachments={attachmentsQuery.data || []}
                onDelete={onDeleteAttachment}
              />
            )}
          </div>
          <CommentThread entityType="task" entityId={task._id || task.id} />
        </div>
      </aside>
    </div>
  );
}

export default TaskDetailPanel;
