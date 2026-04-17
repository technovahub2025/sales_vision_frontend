import useThemeMode from '../../hooks/useThemeMode';

function ThemeModeToggle({ className = '' }) {
  const { mode, setMode } = useThemeMode();
  
  // Toggle between light and dark
  const toggleTheme = () => {
    setMode(mode === 'light' ? 'dark' : 'light');
  };
  
  // Show the icon for the theme we would switch TO
  const nextThemeIcon = mode === 'light' ? 'bi-moon-stars' : 'bi-sun';
  const nextThemeLabel = mode === 'light' ? 'Dark' : 'Light';

  return (
    <button
      type="button"
      className={`btn btn-sm btn-outline-secondary sv-focus-ring d-flex align-items-center justify-content-center ${className}`.trim()}
      onClick={toggleTheme}
      style={{ width: 38, height: 38, padding: 0 }}
      title={`Switch to ${nextThemeLabel.toLowerCase()} mode`}
      aria-label={`Switch to ${nextThemeLabel.toLowerCase()} mode`}
    >
      <i className={`bi ${nextThemeIcon}`} aria-hidden="true" />
    </button>
  );
}

export default ThemeModeToggle;

