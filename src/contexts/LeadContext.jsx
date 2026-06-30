import { createRealtimeCollectionContext } from './createRealtimeCollectionContext';
import { leadsApi } from '../api';

const { Provider, useCollection } = createRealtimeCollectionContext({
  contextName: 'LeadContext',
  moduleName: 'leads',
  entityName: 'lead',
  listFn: (workspaceId, params = {}, signal) => leadsApi.list(workspaceId, { includeArchived: true, sort: 'newest', ...params }, signal),
  createFn: leadsApi.create,
  updateFn: leadsApi.update,
  removeFn: leadsApi.remove,
});

export const LeadProvider = Provider;
export const useLeads = useCollection;

