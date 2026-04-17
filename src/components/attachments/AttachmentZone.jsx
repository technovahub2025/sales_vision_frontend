import { useCallback, useMemo, useState } from 'react';
import { useAttachmentUpload } from '../../hooks/useAttachmentUpload';

function isImage(mimeType = '') {
  return mimeType.startsWith('image/');
}

function formatSize(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function withCloudinaryTransform(url) {
  if (!url) return '';
  if (!/res\.cloudinary\.com/.test(url)) return url;
  if (url.includes('/upload/')) {
    return url.replace('/upload/', '/upload/q_auto,f_auto,w_160/');
  }
  return url;
}

function FileTypeIcon({ mimeType }) {
  const label = mimeType?.split('/')?.[1] || 'file';
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-container text-xs font-semibold text-on-surface-variant">
      {label.toUpperCase()}
    </div>
  );
}

function UploadRow({ item }) {
  return (
    <div className="rounded-lg border border-outline-variant/20 bg-surface-container-lowest p-3">
      <div className="flex items-center justify-between">
        <p className="truncate text-sm font-semibold text-on-surface">{item.file?.name}</p>
        <span className="text-xs text-on-surface-variant">{item.progress}%</span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-container">
        <div className="h-full bg-primary" style={{ width: `${item.progress}%` }} />
      </div>
    </div>
  );
}

function AttachmentCard({ attachment, onDelete, readOnly }) {
  const url = attachment.secureUrl || attachment.url;
  const previewUrl = isImage(attachment.mimeType) ? withCloudinaryTransform(url) : '';

  return (
    <div className="rounded-lg border border-outline-variant/10 bg-surface-container-lowest p-3">
      <div className="flex items-start gap-3">
        {previewUrl ? (
          <img src={previewUrl} alt={attachment.originalName} className="h-12 w-12 rounded-md object-cover" loading="lazy" />
        ) : (
          <FileTypeIcon mimeType={attachment.mimeType} />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-on-surface">{attachment.originalName || 'Attachment'}</p>
          <p className="text-xs text-on-surface-variant">{formatSize(attachment.size)}</p>
        </div>
        {!readOnly ? (
          <button
            type="button"
            onClick={() => onDelete?.(attachment)}
            className="text-xs font-semibold text-error"
          >
            Delete
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default function AttachmentZone({
  workspaceId,
  entityType,
  entityId,
  attachments = [],
  onDelete,
  readOnly = false,
}) {
  const [dragActive, setDragActive] = useState(false);
  const { uploadFiles, uploads } = useAttachmentUpload({ workspaceId, entityType, entityId });

  const onFilesSelected = useCallback(
    async (files) => {
      if (readOnly || !files?.length) return;
      await uploadFiles(files);
    },
    [uploadFiles, readOnly],
  );

  const onDrop = useCallback(
    async (event) => {
      event.preventDefault();
      event.stopPropagation();
      setDragActive(false);
      if (readOnly) return;
      await onFilesSelected(event.dataTransfer?.files);
    },
    [onFilesSelected, readOnly],
  );

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!readOnly) setDragActive(true);
  }, [readOnly]);

  const onDragLeave = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
  }, []);

  const activeUploads = useMemo(() => uploads.filter((item) => item.status === 'uploading'), [uploads]);

  return (
    <section className="space-y-3">
      {!readOnly ? (
        <div
          className={`rounded-xl border border-dashed p-4 text-center text-sm transition ${
            dragActive ? 'border-primary bg-primary/5 text-primary' : 'border-outline-variant/30 text-on-surface-variant'
          }`}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
        >
          <input
            type="file"
            multiple
            onChange={(event) => onFilesSelected(event.target.files)}
            className="hidden"
            id={`attachment-input-${entityType}-${entityId}`}
          />
          <label htmlFor={`attachment-input-${entityType}-${entityId}`} className="cursor-pointer">
            Drag and drop files here, or click to upload
          </label>
        </div>
      ) : null}

      {activeUploads.length ? (
        <div className="space-y-2">
          {activeUploads.map((item) => (
            <UploadRow key={item.id} item={item} />
          ))}
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        {(attachments || []).map((attachment) => (
          <AttachmentCard key={attachment._id} attachment={attachment} onDelete={onDelete} readOnly={readOnly} />
        ))}
      </div>
    </section>
  );
}
