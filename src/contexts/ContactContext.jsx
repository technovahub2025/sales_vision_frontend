import { createRealtimeCollectionContext } from './createRealtimeCollectionContext';
import { contactsApi } from '../api';

const { Provider, useCollection } = createRealtimeCollectionContext({
  contextName: 'ContactContext',
  moduleName: 'contacts',
  entityName: 'contact',
  listFn: (workspaceId) => contactsApi.list(workspaceId, { page: 1, limit: 200 }),
  createFn: contactsApi.create,
  updateFn: contactsApi.update,
  removeFn: contactsApi.remove,
});

export const ContactProvider = Provider;
export const useContacts = useCollection;

