import Icon from './Icon';
import { deniedMessage } from '../../lib/permissions';

export default function DeniedActionButton({
  role,
  actionLabel,
  message,
  children,
  className = 'sv-settings-btn sv-settings-btn-danger',
}) {
  const deniedLabel = message || deniedMessage(role, actionLabel);

  return (
    <button
      type="button"
      disabled
      className={`${className} sv-denied-action`}
      title={deniedLabel}
      aria-label={deniedLabel}
    >
      <Icon name="block" className="text-[0.95rem]" />
      {children}
    </button>
  );
}
