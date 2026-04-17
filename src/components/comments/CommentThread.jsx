import { useState } from 'react';
import { useComments } from '../../hooks/useComments';
import { useAttachmentUpload } from '../../hooks/useAttachmentUpload';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import CommentItem from './CommentItem';

function CommentThread({ entityType, entityId }) {
  const { workspaceId } = useWorkspace();
  const { items, loading, error, createComment, removeComment } = useComments(entityType, entityId);
  const [draft, setDraft] = useState('');
  const [showAttach, setShowAttach] = useState(false);
  const [pendingFiles, setPendingFiles] = useState([]);
  const { uploadFiles, uploads } = useAttachmentUpload({ workspaceId, entityType: 'comment', entityId: null });

  const onSubmit = async () => {
    if (!draft.trim()) return;
    const created = await createComment({ body: draft.trim() });
    if (created && pendingFiles.length) {
      await uploadFiles(pendingFiles, { entityType: 'comment', entityId: created._id || created.id });
      setPendingFiles([]);
      setShowAttach(false);
    }
    setDraft('');
  };

  return (
    <section className="space-y-3">
      {loading ? <p className="text-sm text-on-surface-variant">Loading comments...</p> : null}
      {error ? <p className="text-sm text-error">{error}</p> : null}
      {(items || []).map((item) => (
        <CommentItem key={item._id} item={item} onDelete={removeComment} />
      ))}
      <div className="rounded-lg border border-outline-variant/20 bg-white p-2">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Add comment..."
          rows={3}
          className="w-full resize-none border-none bg-transparent p-2 text-sm focus:ring-0"
        />
        <div className="flex items-center justify-between px-2 pb-1">
          <button
            type="button"
            onClick={() => setShowAttach((current) => !current)}
            className="text-xs font-semibold text-on-surface-variant"
          >
            {showAttach ? 'Hide attachments' : 'Attach files'}
          </button>
          <button type="button" onClick={onSubmit} className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white">
            Comment
          </button>
        </div>
        {showAttach ? (
          <div className="space-y-2 px-2 pb-2">
            <input
              type="file"
              multiple
              onChange={(event) => setPendingFiles(Array.from(event.target.files || []))}
              className="text-xs text-on-surface-variant"
            />
            {pendingFiles.length ? (
              <div className="text-xs text-on-surface-variant">
                {pendingFiles.map((file) => (
                  <div key={file.name}>{file.name}</div>
                ))}
              </div>
            ) : null}
            {uploads.filter((item) => item.status === 'uploading').length ? (
              <div className="space-y-1">
                {uploads
                  .filter((item) => item.status === 'uploading')
                  .map((item) => (
                    <div key={item.id} className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container">
                      <div className="h-full bg-primary" style={{ width: `${item.progress}%` }} />
                    </div>
                  ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default CommentThread;
