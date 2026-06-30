import { createRealtimeCollectionContext } from './createRealtimeCollectionContext';
import { campaignsApi } from '../api';

const { Provider, useCollection } = createRealtimeCollectionContext({
  contextName: 'CampaignContext',
  moduleName: 'campaigns',
  entityName: 'campaign',
  listFn: (workspaceId, params = {}, signal) => campaignsApi.list(workspaceId, { sort: 'newest', includeArchived: true, ...params }, signal),
  createFn: campaignsApi.create,
  updateFn: campaignsApi.update,
  removeFn: campaignsApi.remove,
});

export const CampaignProvider = Provider;
export const useCampaigns = useCollection;

