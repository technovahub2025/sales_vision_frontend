import { createRealtimeCollectionContext } from './createRealtimeCollectionContext';
import { contactsApi } from '../api';

const { Provider, useCollection } = createRealtimeCollectionContext({
  contextName: 'ContactContext',
  moduleName: 'contacts',
  entityName: 'contact',
  listFn: (workspaceId, params = {}, signal) => contactsApi.list(workspaceId, { sort: 'newest', ...params }, signal),
  createFn: contactsApi.create,
  updateFn: contactsApi.update,
  removeFn: contactsApi.remove,
});

export const ContactProvider = Provider;
export const useContacts = useCollection;

