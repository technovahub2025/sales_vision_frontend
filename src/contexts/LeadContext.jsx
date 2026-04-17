import { createRealtimeCollectionContext } from './createRealtimeCollectionContext';
import { leadsApi } from '../api';

const { Provider, useCollection } = createRealtimeCollectionContext({
  contextName: 'LeadContext',
  moduleName: 'leads',
  entityName: 'lead',
  listFn: (workspaceId) => leadsApi.list(workspaceId, { page: 1, limit: 200, includeArchived: true }),
  createFn: leadsApi.create,
  updateFn: leadsApi.update,
  removeFn: leadsApi.remove,
});

export const LeadProvider = Provider;
export const useLeads = useCollection;

