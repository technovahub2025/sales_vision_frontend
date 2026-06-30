import useThemeMode from '../../hooks/useThemeMode';

function ThemeModeToggle({ className = '' }) {
  const { effectiveTheme, setMode } = useThemeMode();
  
  const toggleTheme = () => {
    setMode(effectiveTheme === 'dark' ? 'light' : 'dark');
  };
  
  const nextThemeIcon = effectiveTheme === 'dark' ? 'bi-sun' : 'bi-moon-stars';
  const nextThemeLabel = effectiveTheme === 'dark' ? 'Light' : 'Dark';

  return (
    <button
      type="button"
      className={`btn btn-sm btn-outline-secondary sv-focus-ring sv-theme-toggle-btn d-flex align-items-center justify-content-center ${className}`.trim()}
      onClick={toggleTheme}
      title={`Switch to ${nextThemeLabel.toLowerCase()} mode`}
      aria-label={`Switch to ${nextThemeLabel.toLowerCase()} mode`}
    >
      <i className={`bi ${nextThemeIcon}`} aria-hidden="true" />
    </button>
  );
}

export default ThemeModeToggle;
