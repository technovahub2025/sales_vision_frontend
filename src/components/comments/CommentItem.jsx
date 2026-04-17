function CommentItem({ item, onDelete }) {
  return (
    <article className="rounded-lg border border-outline-variant/20 bg-white p-3">
      <div className="mb-1 flex items-center justify-between">
        <p className="text-xs font-semibold text-on-surface">{item.authorName || 'User'}</p>
        <button type="button" onClick={() => onDelete(item._id)} className="text-xs text-on-surface-variant">
          Delete
        </button>
      </div>
      <p className="text-sm text-on-surface-variant">{item.content || item.body}</p>
    </article>
  );
}

export default CommentItem;
