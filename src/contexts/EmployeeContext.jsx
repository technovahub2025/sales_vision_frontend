import { createRealtimeCollectionContext } from './createRealtimeCollectionContext';
import { employeesApi } from '../api';

const { Provider, useCollection } = createRealtimeCollectionContext({
  contextName: 'EmployeeContext',
  moduleName: 'employees',
  entityName: 'employee',
  listFn: (workspaceId) => employeesApi.list(workspaceId, { page: 1, limit: 200 }),
  createFn: employeesApi.create,
  updateFn: employeesApi.update,
  removeFn: employeesApi.remove,
});

export const EmployeeProvider = Provider;
export const useEmployees = useCollection;

