function Icon({ name, className = '', fill = 0 }) {
  const iconName = String(name || '');
  const isBootstrapIcon = iconName.startsWith('bi-') || iconName.startsWith('bi ');

  if (isBootstrapIcon) {
    return <i className={`bi ${iconName} ${className}`.trim()} aria-hidden="true" />;
  }

  return (
    <span
      className={`material-symbols-outlined ${className}`.trim()}
      style={{ fontVariationSettings: `'FILL' ${fill}, 'wght' 400, 'GRAD' 0, 'opsz' 24` }}
      aria-hidden="true"
    >
      {iconName}
    </span>
  )
}

export default Icon
