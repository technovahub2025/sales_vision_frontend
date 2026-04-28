import SaasLayout from '../layouts/SaasLayout';
import GlobalProviders from '../contexts/GlobalProviders';
import { SocketProvider } from '../contexts/SocketContext';
import { WorkspaceProvider } from '../contexts/WorkspaceContext';

export default function WorkspaceAppLayout() {
  return (
    <WorkspaceProvider>
      <SocketProvider>
        <GlobalProviders>
          <SaasLayout />
        </GlobalProviders>
      </SocketProvider>
    </WorkspaceProvider>
  );
}
