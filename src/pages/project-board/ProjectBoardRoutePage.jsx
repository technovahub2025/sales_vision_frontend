import ProjectBoardPage from './ProjectBoardPage';
import { useProjectRouteSync } from '../../hooks/useProjectRouteSync';
import ProjectTabs from './ProjectTabs';

function ProjectBoardRoutePage() {
  const projectId = useProjectRouteSync();
  return (
    <>
      <ProjectTabs projectId={projectId} />
      <ProjectBoardPage />
    </>
  );
}

export default ProjectBoardRoutePage;
