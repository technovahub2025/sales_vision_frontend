import { NavLink } from 'react-router-dom';
import { projectRoute } from '../../routes/routePaths';

function ProjectTabs({ projectId }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 pb-0">
      <NavLink to={projectRoute('board', projectId)} className={({ isActive }) => `rounded-lg px-3 py-1.5 text-sm font-semibold ${isActive ? 'bg-primary text-white' : 'bg-surface-container-low text-on-surface-variant'}`}>
        Board
      </NavLink>
      <NavLink to={projectRoute('backlog', projectId)} className={({ isActive }) => `rounded-lg px-3 py-1.5 text-sm font-semibold ${isActive ? 'bg-primary text-white' : 'bg-surface-container-low text-on-surface-variant'}`}>
        Backlog
      </NavLink>
      <NavLink to={projectRoute('sprints', projectId)} className={({ isActive }) => `rounded-lg px-3 py-1.5 text-sm font-semibold ${isActive ? 'bg-primary text-white' : 'bg-surface-container-low text-on-surface-variant'}`}>
        Sprints
      </NavLink>
      <NavLink to={projectRoute('roadmap', projectId)} className={({ isActive }) => `rounded-lg px-3 py-1.5 text-sm font-semibold ${isActive ? 'bg-primary text-white' : 'bg-surface-container-low text-on-surface-variant'}`}>
        Roadmap
      </NavLink>
      <NavLink to={projectRoute('members', projectId)} className={({ isActive }) => `rounded-lg px-3 py-1.5 text-sm font-semibold ${isActive ? 'bg-primary text-white' : 'bg-surface-container-low text-on-surface-variant'}`}>
        Members
      </NavLink>
      <NavLink to={projectRoute('overview', projectId)} className={({ isActive }) => `rounded-lg px-3 py-1.5 text-sm font-semibold ${isActive ? 'bg-primary text-white' : 'bg-surface-container-low text-on-surface-variant'}`}>
        Overview
      </NavLink>
    </div>
  );
}

export default ProjectTabs;
