import { CampaignProvider } from './CampaignContext';
import { LeadProvider } from './LeadContext';
import { ContactProvider } from './ContactContext';
import { EmployeeProvider } from './EmployeeContext';
import { SettingsProvider } from './SettingsContext';
import { ActivityProvider } from './ActivityContext';
import { DashboardProvider } from './DashboardContext';
import { TaskProvider } from './TaskContext';
import { NewTaskProvider } from './NewTaskContext';
import { TeamProvider } from './TeamContext';
import { SprintProvider } from './SprintContext';
import { NotificationProvider } from './NotificationContext';
import { RoadmapProvider } from './RoadmapContext';
import { useWorkspace } from '../contexts/WorkspaceContext';

export default function GlobalProviders({ children }) {
  const { workspaceId, projectId } = useWorkspace();

  return (
    <DashboardProvider workspaceId={workspaceId}>
      <NotificationProvider workspaceId={workspaceId}>
        <TaskProvider workspaceId={workspaceId} projectId={projectId}>
          <SprintProvider workspaceId={workspaceId} projectId={projectId}>
            <RoadmapProvider workspaceId={workspaceId} projectId={projectId}>
              <TeamProvider workspaceId={workspaceId}>
                <CampaignProvider workspaceId={workspaceId}>
                  <LeadProvider workspaceId={workspaceId}>
                    <ContactProvider workspaceId={workspaceId}>
                      <EmployeeProvider workspaceId={workspaceId}>
                        <SettingsProvider workspaceId={workspaceId}>
                          <ActivityProvider workspaceId={workspaceId}>
                            <NewTaskProvider>{children}</NewTaskProvider>
                          </ActivityProvider>
                        </SettingsProvider>
                      </EmployeeProvider>
                    </ContactProvider>
                  </LeadProvider>
                </CampaignProvider>
              </TeamProvider>
            </RoadmapProvider>
          </SprintProvider>
        </TaskProvider>
      </NotificationProvider>
    </DashboardProvider>
  );
}


