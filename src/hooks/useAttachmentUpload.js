import { useCallback, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { axiosClient } from '../api/axiosClient';
import { wsV1 } from '../api/ws';

function normalizeFiles(fileList) {
  return Array.from(fileList || []).filter(Boolean);
}

function buildUploadUrl(workspaceId, entityType, entityId) {
  if (!workspaceId || !entityType) return '';
  if (entityType === 'task') return wsV1(workspaceId, `/tasks/${entityId}/attachments`);
  if (entityType === 'lead') return wsV1(workspaceId, `/leads/${entityId}/attachments`);
  if (entityType === 'comment') return wsV1(workspaceId, `/comments/${entityId}/attachments`);
  return wsV1(workspaceId, '/attachments/upload');
}

function createPlaceholder(file, tempId) {
  return {
    _id: tempId,
    url: '',
    secureUrl: '',
    publicId: '',
    mimeType: file.type || 'application/octet-stream',
    size: Number(file.size || 0),
    originalName: file.name,
    uploadedAt: new Date().toISOString(),
    isTemporary: true,
  };
}

export function useAttachmentUpload({ workspaceId, entityType, entityId }) {
  const queryClient = useQueryClient();
  const [uploads, setUploads] = useState([]);

  const uploadFiles = useCallback(
    async (fileList, override = {}) => {
      const files = normalizeFiles(fileList);
      if (!files.length) return [];

      const targetWorkspaceId = override.workspaceId || workspaceId;
      const targetEntityType = override.entityType || entityType;
      const targetEntityId = override.entityId || entityId;
      const uploadUrl = buildUploadUrl(targetWorkspaceId, targetEntityType, targetEntityId);

      if (!uploadUrl) throw new Error('Attachment upload target is missing');

      const placeholders = files.map((file) => {
        const id = `temp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        return { id, file, progress: 0, status: 'uploading', result: null, error: null };
      });

      setUploads((prev) => [...placeholders, ...prev]);

      const cacheKey = ['attachments', targetEntityType, String(targetEntityId || '')];
      queryClient.setQueryData(cacheKey, (old = []) => {
        const items = Array.isArray(old) ? old : [];
        const tempItems = placeholders.map((item) => createPlaceholder(item.file, item.id));
        return [...tempItems, ...items];
      });

      const results = [];
      for (const placeholder of placeholders) {
        const formData = new FormData();
        formData.append('files', placeholder.file);
        if (targetEntityType && !['task', 'lead', 'comment'].includes(targetEntityType)) {
          formData.append('entityType', targetEntityType);
          formData.append('entityId', String(targetEntityId || ''));
        }

        try {
          const response = await axiosClient.post(uploadUrl, formData, {
            withCredentials: true,
            onUploadProgress: (event) => {
              const percent = event.total ? Math.round((event.loaded / event.total) * 100) : 0;
              setUploads((prev) =>
                prev.map((item) => (item.id === placeholder.id ? { ...item, progress: percent } : item)),
              );
            },
          });
          const created = response?.data?.data || response?.data || [];
          const createdItems = Array.isArray(created) ? created : [created];
          results.push(...createdItems);

          queryClient.setQueryData(cacheKey, (old = []) => {
            const items = Array.isArray(old) ? old : [];
            const withoutTemp = items.filter((item) => item._id !== placeholder.id);
            return [...createdItems, ...withoutTemp];
          });

          setUploads((prev) =>
            prev.map((item) => (item.id === placeholder.id ? { ...item, status: 'done', result: createdItems } : item)),
          );
        } catch (error) {
          queryClient.setQueryData(cacheKey, (old = []) => {
            const items = Array.isArray(old) ? old : [];
            return items.filter((item) => item._id !== placeholder.id);
          });

          setUploads((prev) =>
            prev.map((item) => (item.id === placeholder.id ? { ...item, status: 'error', error } : item)),
          );
          throw error;
        }
      }

      return results;
    },
    [workspaceId, entityType, entityId, queryClient],
  );

  const clearCompleted = useCallback(() => {
    setUploads((prev) => prev.filter((item) => item.status === 'uploading'));
  }, []);

  return useMemo(
    () => ({
      uploadFiles,
      uploads,
      clearCompleted,
    }),
    [uploadFiles, uploads, clearCompleted],
  );
}
