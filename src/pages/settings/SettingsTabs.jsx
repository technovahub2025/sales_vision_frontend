import { NavLink } from 'react-router-dom';
import { ROUTES } from '../../routes/routePaths';

const SETTINGS_TABS = [
  { to: ROUTES.settings, label: 'General', end: true },
  { to: ROUTES.settingsWorkspace, label: 'Workspace' },
  { to: ROUTES.settingsMembers, label: 'Members' },
  { to: ROUTES.settingsSecurity, label: 'Security' },
];

function SettingsTabs() {
  return (
    <div className="sv-settings-tabs">
      {SETTINGS_TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) => `sv-settings-tab ${isActive ? 'is-active' : ''}`}
        >
          {tab.label}
        </NavLink>
      ))}
    </div>
  );
}

export default SettingsTabs;
