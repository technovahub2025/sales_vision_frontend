import { NavLink } from 'react-router-dom';
import { projectRoute } from '../../routes/routePaths';

function ProjectTabs({ projectId }) {
  return (
    <div className="sv-card sv-board-tabs-wrap">
      <div className="sv-board-tabs">
        <NavLink to={projectRoute('board', projectId)} className={({ isActive }) => `sv-board-tab ${isActive ? 'is-active' : ''}`}>
          Board
        </NavLink>
        <NavLink to={projectRoute('backlog', projectId)} className={({ isActive }) => `sv-board-tab ${isActive ? 'is-active' : ''}`}>
          Backlog
        </NavLink>
        <NavLink to={projectRoute('sprints', projectId)} className={({ isActive }) => `sv-board-tab ${isActive ? 'is-active' : ''}`}>
          Sprints
        </NavLink>
        <NavLink to={projectRoute('roadmap', projectId)} className={({ isActive }) => `sv-board-tab ${isActive ? 'is-active' : ''}`}>
          Roadmap
        </NavLink>
        <NavLink to={projectRoute('members', projectId)} className={({ isActive }) => `sv-board-tab ${isActive ? 'is-active' : ''}`}>
          Members
        </NavLink>
        <NavLink to={projectRoute('overview', projectId)} className={({ isActive }) => `sv-board-tab ${isActive ? 'is-active' : ''}`}>
          Overview
        </NavLink>
      </div>
    </div>
  );
}

export default ProjectTabs;
