import { createRealtimeCollectionContext } from './createRealtimeCollectionContext';
import { campaignsApi } from '../api';

const { Provider, useCollection } = createRealtimeCollectionContext({
  contextName: 'CampaignContext',
  moduleName: 'campaigns',
  entityName: 'campaign',
  listFn: (workspaceId) => campaignsApi.list(workspaceId, { page: 1, limit: 200, sort: 'recent', includeArchived: true }),
  createFn: campaignsApi.create,
  updateFn: campaignsApi.update,
  removeFn: campaignsApi.remove,
});

export const CampaignProvider = Provider;
export const useCampaigns = useCollection;

