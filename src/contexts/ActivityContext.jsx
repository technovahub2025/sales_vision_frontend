import { createRealtimeCollectionContext } from './createRealtimeCollectionContext';
import { activityApi } from '../api';

const { Provider, useCollection } = createRealtimeCollectionContext({
  contextName: 'ActivityContext',
  moduleName: 'activity',
  entityName: 'activity',
  listFn: (workspaceId) => activityApi.list(workspaceId),
  createFn: async () => ({ data: null }),
  updateFn: async () => ({ data: null }),
  removeFn: async () => ({}),
});

export const ActivityProvider = Provider;
export const useActivity = useCollection;

