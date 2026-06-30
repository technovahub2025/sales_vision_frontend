import { NavLink } from 'react-router-dom';
import Icon from '../../components/ui/Icon';
import { ROUTES } from '../../routes/routePaths';

const SETTINGS_TABS = [
  { to: ROUTES.settings, label: 'General', icon: 'tune', end: true },
  { to: ROUTES.settingsWorkspace, label: 'Workspace', icon: 'business' },
  { to: ROUTES.settingsMembers, label: 'Members', icon: 'groups' },
  { to: ROUTES.settingsSecurity, label: 'Security', icon: 'shield' },
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
          <Icon name={tab.icon} className="sv-settings-tab-icon" />
          {tab.label}
        </NavLink>
      ))}
    </div>
  );
}

export default SettingsTabs;
