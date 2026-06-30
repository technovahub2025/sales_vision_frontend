import { useLayoutEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { projectRoute } from '../../routes/routePaths';
import DeniedActionButton from '../../components/ui/DeniedActionButton';
import { usePlanAccess } from '../../hooks/usePlanAccess';

const BASE_TABS = [
  { key: 'board', label: 'Board' },
  { key: 'backlog', label: 'Backlog' },
  { key: 'sprints', label: 'Sprints' },
  { key: 'roadmap', label: 'Roadmap', gated: true },
  { key: 'members', label: 'Members' },
  { key: 'overview', label: 'Overview' },
];

function ProjectTabs({ projectId }) {
  const { canUseFeature } = usePlanAccess();
  const location = useLocation();
  const roadmapAllowed = canUseFeature('roadmap');
  const tabsRef = useRef(null);
  const tabRefs = useRef(new Map());
  const [indicator, setIndicator] = useState(null);

  useLayoutEffect(() => {
    const tabsNode = tabsRef.current;
    if (!tabsNode) return undefined;

    const updateIndicator = () => {
      const activeNode = tabsNode.querySelector('.sv-board-tab.is-active');
      if (!activeNode) {
        setIndicator(null);
        return;
      }

      const tabsRect = tabsNode.getBoundingClientRect();
      const activeRect = activeNode.getBoundingClientRect();
      setIndicator({
        width: activeRect.width,
        height: activeRect.height,
        x: activeRect.left - tabsRect.left + tabsNode.scrollLeft,
        y: activeRect.top - tabsRect.top + tabsNode.scrollTop,
      });
    };

    updateIndicator();
    const resizeObserver = new ResizeObserver(updateIndicator);
    resizeObserver.observe(tabsNode);
    tabRefs.current.forEach((node) => {
      if (node) resizeObserver.observe(node);
    });
    window.addEventListener('resize', updateIndicator);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateIndicator);
    };
  }, [location.pathname, roadmapAllowed]);

  return (
    <div className="sv-card sv-board-tabs-wrap">
      <div className="sv-board-tabs" ref={tabsRef}>
        {indicator ? (
          <span
            className="sv-board-tab-indicator"
            style={{
              width: `${indicator.width}px`,
              height: `${indicator.height}px`,
              transform: `translate3d(${indicator.x}px, ${indicator.y}px, 0)`,
            }}
            aria-hidden="true"
          />
        ) : null}
        {BASE_TABS.map((tab) => {
          if (tab.gated && !roadmapAllowed) {
            return (
              <DeniedActionButton
                key={tab.key}
                role="owner"
                actionLabel="use roadmap"
                message="Free plan cannot access roadmap"
                className="sv-board-tab"
              >
                {tab.label}
              </DeniedActionButton>
            );
          }

          return (
            <NavLink
              key={tab.key}
              to={projectRoute(tab.key, projectId)}
              ref={(node) => {
                if (node) tabRefs.current.set(tab.key, node);
                else tabRefs.current.delete(tab.key);
              }}
              className={({ isActive }) => `sv-board-tab ${isActive ? 'is-active' : ''}`}
            >
              {tab.label}
            </NavLink>
          );
        })}
      </div>
    </div>
  );
}

export default ProjectTabs;
