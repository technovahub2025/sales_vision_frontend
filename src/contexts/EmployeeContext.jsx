import { createRealtimeCollectionContext } from './createRealtimeCollectionContext';
import { employeesApi } from '../api';

const { Provider, useCollection } = createRealtimeCollectionContext({
  contextName: 'EmployeeContext',
  moduleName: 'employees',
  entityName: 'employee',
  listFn: (workspaceId, params = {}, signal) => employeesApi.list(workspaceId, { sort: 'newest', ...params }, signal),
  createFn: employeesApi.create,
  updateFn: employeesApi.update,
  removeFn: employeesApi.remove,
});

export const EmployeeProvider = Provider;
export const useEmployees = useCollection;

